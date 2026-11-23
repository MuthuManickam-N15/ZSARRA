import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ find: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { order: { findFirst: m.find }, payment: { upsert: m.upsert } } }));

import { CheckoutError, ensureQrPayment } from "@/lib/checkout";

beforeEach(() => { m.find.mockReset(); m.upsert.mockReset(); m.upsert.mockImplementation(async (a: { create: object }) => ({ id: "pay1", ...a.create })); });

describe("ensureQrPayment", () => {
  it("only finds the customer's own order", async () => {
    m.find.mockResolvedValue(null);
    await expect(ensureQrPayment("o1", "u1")).rejects.toThrow(CheckoutError);
    expect(m.find.mock.calls[0][0].where).toEqual({ id: "o1", userId: "u1" });
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("records a QR payment for exactly the order's total, keyed by the order number", async () => {
    m.find.mockResolvedValue({ id: "o1", number: "ZR2610221234", total: 149900 });
    const p = await ensureQrPayment("o1", "u1");
    expect(p).toMatchObject({ orderId: "o1", gateway: "upi_qr", gatewayOrderId: "qr_ZR2610221234", amount: 149900 });
  });
  it("is safe to call again: an existing record is left alone", async () => {
    m.find.mockResolvedValue({ id: "o1", number: "ZR1", total: 100 });
    await ensureQrPayment("o1", "u1");
    const arg = m.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ gatewayOrderId: "qr_ZR1" });
    expect(arg.update).toEqual({});
  });
});
