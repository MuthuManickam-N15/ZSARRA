import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory stand-in for the database, with transaction rollback.
const h = vi.hoisted(() => {
  const state: any = { payment: {}, order: {}, items: [], stock: {} };
  const match = (p: any, w: any) => Object.entries(w).every(([k, v]: any) => k === "status" ? (typeof v === "string" ? p.status === v : v.in.includes(p.status)) : p[k] === v);
  const paymentUpdateMany = vi.fn(async ({ where, data }: any) => (match(state.payment, where) ? (Object.assign(state.payment, data), { count: 1 }) : { count: 0 }));
  const tx = {
    payment: {
      findUnique: vi.fn(async ({ where }: any) => (where.gatewayOrderId === state.payment.gatewayOrderId ? { ...state.payment, order: { ...state.order, items: state.items } } : null)),
      updateMany: paymentUpdateMany,
    },
    order: {
      updateMany: vi.fn(async ({ where, data }: any) => (match(state.order, where) ? (Object.assign(state.order, data), { count: 1 }) : { count: 0 })),
      update: vi.fn(async ({ data }: any) => Object.assign(state.order, data)),
    },
    variant: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        if ((state.stock[where.id] ?? 0) < where.stock.gte) return { count: 0 };
        state.stock[where.id] -= data.stock.decrement; return { count: 1 };
      }),
      update: vi.fn(async ({ where, data }: any) => { state.stock[where.id] += data.stock.increment; }),
    },
  };
  const db = {
    $transaction: vi.fn(async (cb: any) => {
      const snap = structuredClone(state);
      try { return await cb(tx); } catch (e) { Object.assign(state, snap); throw e; }
    }),
    payment: { updateMany: paymentUpdateMany },
    order: { findMany: vi.fn(async () => (state.order.status === "PENDING" ? [{ ...state.order, items: state.items }] : [])) },
  };
  return { state, db };
});
vi.mock("@/lib/db", () => ({ db: h.db }));

import { expireStaleOrders, markPaymentFailed, markPaymentSuccess, markRefunded } from "@/lib/payments";

const s = h.state;
const paid = { gatewayOrderId: "order_1", gatewayPaymentId: "pay_1", amount: 10000 };

beforeEach(() => {
  s.payment = { id: "p1", orderId: "o1", gatewayOrderId: "order_1", gatewayPaymentId: null, amount: 10000, status: "PENDING" };
  s.order = { id: "o1", status: "PENDING" };
  s.items = [{ variantId: "v1", quantity: 2 }];
  s.stock = { v1: 5 };
});

describe("markPaymentSuccess", () => {
  it("marks the payment successful and confirms the order", async () => {
    expect(await markPaymentSuccess(paid)).toBe("paid");
    expect(s.payment).toMatchObject({ status: "SUCCESS", gatewayPaymentId: "pay_1" });
    expect(s.order.status).toBe("CONFIRMED");
  });
  it("ignores duplicate notifications: nothing changes the second or third time", async () => {
    await markPaymentSuccess(paid);
    expect(await markPaymentSuccess(paid)).toBe("already");
    expect(await markPaymentSuccess({ ...paid, gatewayPaymentId: "pay_other" })).toBe("already");
    expect(s.payment.gatewayPaymentId).toBe("pay_1");
    expect(s.order.status).toBe("CONFIRMED");
    expect(s.stock.v1).toBe(5);
  });
  it("refuses a payment for a different amount than the order's", async () => {
    expect(await markPaymentSuccess({ ...paid, amount: 100 })).toBe("mismatch");
    expect(s.payment.status).toBe("PENDING");
    expect(s.order.status).toBe("PENDING");
  });
  it("ignores payments for unknown gateway orders", async () => {
    expect(await markPaymentSuccess({ ...paid, gatewayOrderId: "order_x" })).toBe("unknown");
  });
  it("accepts a successful retry after an earlier failed attempt", async () => {
    s.payment.status = "FAILED";
    expect(await markPaymentSuccess(paid)).toBe("paid");
    expect(s.order.status).toBe("CONFIRMED");
  });
  it("revives an expired order and re-takes its stock when the money arrives late", async () => {
    s.order.status = "CANCELLED";
    expect(await markPaymentSuccess(paid)).toBe("paid");
    expect(s.order.status).toBe("CONFIRMED");
    expect(s.stock.v1).toBe(3);
  });
  it("keeps a late-paid order cancelled when the stock is gone, but still records the payment for a refund", async () => {
    s.order.status = "CANCELLED"; s.stock.v1 = 1;
    expect(await markPaymentSuccess(paid)).toBe("paid-but-cancelled");
    expect(s.payment.status).toBe("SUCCESS");
    expect(s.order.status).toBe("CANCELLED");
    expect(s.stock.v1).toBe(1);
  });
});

describe("markPaymentFailed / markRefunded", () => {
  it("marks a pending payment failed", async () => {
    await markPaymentFailed("order_1");
    expect(s.payment.status).toBe("FAILED");
  });
  it("never downgrades a successful payment to failed", async () => {
    await markPaymentSuccess(paid);
    await markPaymentFailed("order_1");
    expect(s.payment.status).toBe("SUCCESS");
  });
  it("refunds only payments that succeeded", async () => {
    await markRefunded("pay_1");
    expect(s.payment.status).toBe("PENDING");
    await markPaymentSuccess(paid);
    await markRefunded("pay_1");
    expect(s.payment.status).toBe("REFUNDED");
  });
});

describe("expireStaleOrders", () => {
  it("cancels an unpaid order and returns its stock exactly once", async () => {
    s.stock.v1 = 3;
    expect(await expireStaleOrders()).toBe(1);
    expect(s.order.status).toBe("CANCELLED");
    expect(s.stock.v1).toBe(5);
    expect(await expireStaleOrders()).toBe(0);
    expect(s.stock.v1).toBe(5);
  });
  it("doesn't return stock twice if someone cancelled the order in the meantime", async () => {
    s.order.status = "CANCELLED";
    h.db.order.findMany.mockResolvedValueOnce([{ ...s.order, status: "PENDING", items: s.items }]);
    expect(await expireStaleOrders()).toBe(0);
    expect(s.stock.v1).toBe(5);
  });
});
