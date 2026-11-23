import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { order: { findMany: m.findMany }, $transaction: vi.fn() } }));

import { expireStaleOrders } from "@/lib/payments";

beforeEach(() => { m.findMany.mockReset(); m.findMany.mockResolvedValue([]); });

describe("expireStaleOrders", () => {
  it("looks at pending orders older than an hour that nobody has paid or sent a reference for", async () => {
    expect(await expireStaleOrders()).toBe(0);
    const w = m.findMany.mock.calls[0][0].where;
    expect(w.status).toBe("PENDING");
    expect(w.payments).toEqual({ none: { OR: [{ status: "SUCCESS" }, { gatewayPaymentId: { not: null } }] } });
    const age = Date.now() - w.createdAt.lt.getTime();
    expect(age).toBeGreaterThan(59 * 60_000);
    expect(age).toBeLessThan(61 * 60_000);
  });
  it("never touches an order that is waiting for an admin to verify a payment", async () => {
    await expireStaleOrders();
    expect(JSON.stringify(m.findMany.mock.calls[0][0].where)).toContain('"gatewayPaymentId":{"not":null}');
  });
  it("accepts another time limit", async () => {
    await expireStaleOrders(10);
    const age = Date.now() - m.findMany.mock.calls[0][0].where.createdAt.lt.getTime();
    expect(age).toBeGreaterThan(9 * 60_000);
    expect(age).toBeLessThan(11 * 60_000);
  });
});
