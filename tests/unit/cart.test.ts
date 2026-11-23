import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ rows: [] as any[], sum: null as number | null }));
vi.mock("@/lib/db", () => ({ db: { cartItem: { findMany: async () => h.rows, aggregate: async () => ({ _sum: { quantity: h.sum } }) } } }));

import { getCart, getCartCount } from "@/lib/cart";

const row = (id: string, qty: number, o: { stock?: number; price?: number; sale?: number | null; published?: boolean } = {}) => ({
  id, quantity: qty,
  variant: { id: `v-${id}`, size: "M", color: "Black", stock: o.stock ?? 10, product: { name: `P${id}`, slug: `p${id}`, price: o.price ?? 100000, salePrice: o.sale ?? null, published: o.published ?? true, images: [] } },
});
beforeEach(() => { h.rows = []; h.sum = null; });

describe("getCart", () => {
  it("totals quantity times price, preferring the sale price", async () => {
    h.rows = [row("a", 2, { price: 100000 }), row("b", 1, { price: 90000, sale: 70000 })];
    const c = await getCart("u");
    expect(c.lines.map((l) => l.lineTotal)).toEqual([200000, 70000]);
    expect(c.subtotal).toBe(270000);
    expect(c.count).toBe(3);
    expect(c.hasIssues).toBe(false);
  });
  it("flags sold-out items and leaves them out of the total", async () => {
    h.rows = [row("a", 1, { stock: 0 }), row("b", 1)];
    const c = await getCart("u");
    expect(c.lines[0]).toMatchObject({ issue: "Out of stock", lineTotal: 0 });
    expect(c.subtotal).toBe(100000);
    expect(c.hasIssues).toBe(true);
  });
  it("flags quantity above stock and unpublished products", async () => {
    h.rows = [row("a", 5, { stock: 2 }), row("b", 1, { published: false })];
    const c = await getCart("u");
    expect(c.lines[0].issue).toBe("Only 2 left");
    expect(c.lines[1].issue).toBe("No longer available");
    expect(c.subtotal).toBe(0);
  });
  it("caps the selectable quantity at the stock or 10, whichever is lower", async () => {
    h.rows = [row("a", 1, { stock: 3 }), row("b", 1, { stock: 99 })];
    expect((await getCart("u")).lines.map((l) => l.maxQty)).toEqual([3, 10]);
  });
  it("handles an empty cart", async () => {
    expect(await getCart("u")).toMatchObject({ lines: [], subtotal: 0, count: 0, hasIssues: false });
  });
});

describe("getCartCount", () => {
  it("sums quantities and treats an empty cart as 0", async () => {
    h.sum = 4; expect(await getCartCount("u")).toBe(4);
    h.sum = null; expect(await getCartCount("u")).toBe(0);
  });
});
