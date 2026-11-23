import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state: any = { cart: [], orders: [], stock: {} };
  const tx = {
    cartItem: { findMany: vi.fn(async () => state.cart), deleteMany: vi.fn(async () => { state.cart = []; return { count: 1 }; }) },
    variant: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        if ((state.stock[where.id] ?? 0) < where.stock.gte) return { count: 0 };
        state.stock[where.id] -= data.stock.decrement; return { count: 1 };
      }),
    },
    order: {
      create: vi.fn(async ({ data }: any) => {
        const { items, ...rest } = data;
        const o = { id: `o${state.orders.length + 1}`, ...rest, items: items.create };
        state.orders.push(o); return o;
      }),
    },
  };
  const db = {
    order: { findUnique: vi.fn(async ({ where }: any) => state.orders.find((o: any) => o.idempotencyKey === where.idempotencyKey) ?? null) },
    setting: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (cb: any) => {
      const snap = structuredClone(state);
      try { return await cb(tx); } catch (e) { Object.assign(state, snap); throw e; }
    }),
  };
  return { state, db };
});
vi.mock("@/lib/db", () => ({ db: h.db }));

import { CheckoutError, createOrderFromCart } from "@/lib/checkout";

const s = h.state;
const ship = { fullName: "Asha Rao", phone: "9876543210", line1: "12 Main Road", city: "Chennai", state: "Tamil Nadu", pincode: "600001" };
const line = (id: string, vid: string, qty: number, stock: number, price: number, extra: { sale?: number; published?: boolean } = {}) => ({
  id, quantity: qty,
  variant: { id: vid, size: "M", color: "Black", stock, product: { name: `Product ${vid}`, price, salePrice: extra.sale ?? null, published: extra.published ?? true } },
});

beforeEach(() => {
  s.orders = [];
  s.stock = { v1: 5, v2: 3 };
  s.cart = [line("c1", "v1", 2, 5, 349900), line("c2", "v2", 1, 3, 299900, { sale: 249900 })];
});

describe("createOrderFromCart", () => {
  it("prices everything from the database, using sale prices", async () => {
    const o = await createOrderFromCart("u1", ship, "key-1");
    expect(o.subtotal).toBe(2 * 349900 + 249900);
    expect(o.shipping).toBe(0); // above the free-shipping threshold
    expect(o.total).toBe(o.subtotal + o.shipping + o.tax);
    expect(o.items.map((i: any) => i.unitPrice)).toEqual([349900, 249900]);
  });
  it("adds the shipping charge on small orders", async () => {
    s.cart = [line("c1", "v1", 1, 5, 100000)];
    const o = await createOrderFromCart("u1", ship, "key-2");
    expect(o).toMatchObject({ subtotal: 100000, shipping: 9900, total: 109900 });
  });
  it("reserves stock, clears the cart and snapshots the delivery address", async () => {
    const o = await createOrderFromCart("u1", ship, "key-3");
    expect(s.stock).toEqual({ v1: 3, v2: 2 });
    expect(s.cart).toEqual([]);
    expect(o).toMatchObject({ userId: "u1", shipName: "Asha Rao", shipPincode: "600001", idempotencyKey: "key-3" });
  });
  it("returns the same order for a repeated key without taking stock twice", async () => {
    const a = await createOrderFromCart("u1", ship, "same-key");
    s.cart = [line("c1", "v1", 2, 5, 349900)];
    const b = await createOrderFromCart("u1", ship, "same-key");
    expect(b.id).toBe(a.id);
    expect(s.orders).toHaveLength(1);
    expect(s.stock).toEqual({ v1: 3, v2: 2 });
  });
  it("won't hand one customer another customer's order", async () => {
    await createOrderFromCart("u1", ship, "shared");
    await expect(createOrderFromCart("u2", ship, "shared")).rejects.toThrow(CheckoutError);
  });
  it.each([
    ["an empty cart", () => { s.cart = []; }, /empty/],
    ["not enough stock", () => { s.cart = [line("c1", "v1", 2, 1, 1000)]; }, /enough stock/],
    ["an unpublished product", () => { s.cart = [line("c1", "v1", 1, 5, 1000, { published: false })]; }, /no longer available/],
    ["more than 10 of one item", () => { s.cart = [line("c1", "v1", 11, 50, 1000)]; s.stock.v1 = 50; }, /enough stock/],
  ])("rejects %s and creates no order", async (_n, setup, msg) => {
    setup();
    await expect(createOrderFromCart("u1", ship, "k")).rejects.toThrow(msg);
    expect(s.orders).toHaveLength(0);
  });
  it("rolls everything back if stock runs out mid-checkout (lost race)", async () => {
    s.stock = { v1: 5, v2: 0 }; // the cart snapshot says 3 left, but someone else just bought them
    await expect(createOrderFromCart("u1", ship, "k")).rejects.toThrow(/sold out/);
    expect(s.stock).toEqual({ v1: 5, v2: 0 }); // the first line's reservation was undone
    expect(s.orders).toHaveLength(0);
    expect(s.cart).toHaveLength(2); // cart untouched so the customer can adjust it
  });
});
