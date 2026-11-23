import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  class CheckoutError extends Error {}
  return {
    CheckoutError, user: vi.fn(), admin: vi.fn(), settings: vi.fn(), create: vi.fn(), ensure: vi.fn(),
    addrFind: vi.fn(), addrCount: vi.fn(), addrCreate: vi.fn(), orderFind: vi.fn(), orderFindUnique: vi.fn(),
    payUpdate: vi.fn(), payFind: vi.fn(), payUpdateMany: vi.fn(), success: vi.fn(), failed: vi.fn(), revalidate: vi.fn(),
  };
});
vi.mock("@/lib/db", () => ({ db: {
  address: { findFirst: h.addrFind, count: h.addrCount, create: h.addrCreate },
  order: { findFirst: h.orderFind, findUnique: h.orderFindUnique },
  payment: { update: h.payUpdate, findUnique: h.payFind, updateMany: h.payUpdateMany },
} }));
vi.mock("@/lib/session", () => ({ getCurrentUser: h.user, requireAdmin: h.admin }));
vi.mock("@/lib/settings", () => ({ getSettings: h.settings }));
vi.mock("@/lib/checkout", () => ({ CheckoutError: h.CheckoutError, createOrderFromCart: h.create, ensureQrPayment: h.ensure }));
vi.mock("@/lib/payments", () => ({ markPaymentSuccess: h.success, markPaymentFailed: h.failed }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));

import { placeOrder, submitPaymentReference } from "@/app/actions/checkout";
import { approvePayment, markOrderRefunded, rejectPayment } from "@/app/actions/payments";

let n = 0;
const signIn = () => { const u = { id: `user-${++n}` }; h.user.mockResolvedValue(u); return u; }; // a fresh id per test so rate limits never interfere
const form = (o: Record<string, string>) => { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.set(k, v)); return f; };
const address = { fullName: "Asha Rao", phone: "9876543210", line1: "12 Main Road", city: "Chennai", state: "Tamil Nadu", pincode: "600001" };

beforeEach(() => {
  Object.values(h).forEach((f) => typeof f === "function" && "mockReset" in f && (f as ReturnType<typeof vi.fn>).mockReset());
  h.settings.mockResolvedValue({ paymentsEnabled: true });
  h.admin.mockResolvedValue({ id: "admin" });
  h.addrCount.mockResolvedValue(0);
});

describe("placeOrder", () => {
  const input = (o: object = {}) => ({ key: crypto.randomUUID(), address, ...o });
  it("needs a logged-in customer", async () => {
    h.user.mockResolvedValue(null);
    expect(await placeOrder(input())).toEqual({ error: "Please log in to place an order" });
    expect(h.create).not.toHaveBeenCalled();
  });
  it("is paused when the store switches payments off", async () => {
    signIn(); h.settings.mockResolvedValue({ paymentsEnabled: false });
    expect((await placeOrder(input())).error).toMatch(/paused/);
    expect(h.create).not.toHaveBeenCalled();
  });
  it("rejects bad delivery details and a missing key without creating anything", async () => {
    signIn();
    expect((await placeOrder(input({ address: { ...address, pincode: "12" } }))).error).toBe("Pincode must be 6 digits");
    expect((await placeOrder({ address })).error).toBeTruthy();
    expect((await placeOrder({ key: crypto.randomUUID() })).error).toMatch(/address/);
    expect(h.create).not.toHaveBeenCalled();
  });
  it("creates the order and its QR payment record, and returns the order id", async () => {
    const u = signIn(); h.create.mockResolvedValue({ id: "o1" });
    expect(await placeOrder(input())).toEqual({ orderId: "o1" });
    expect(h.create.mock.calls[0][0]).toBe(u.id);
    expect(h.ensure).toHaveBeenCalledWith("o1", u.id);
  });
  it("only uses addresses from the customer's own address book", async () => {
    signIn(); h.addrFind.mockResolvedValue(null);
    expect((await placeOrder({ key: crypto.randomUUID(), addressId: "someone-elses" })).error).toMatch(/address book/);
    h.addrFind.mockResolvedValue({ id: "a1", ...address, line2: null }); h.create.mockResolvedValue({ id: "o2" });
    expect(await placeOrder({ key: crypto.randomUUID(), addressId: "a1" })).toEqual({ orderId: "o2" });
  });
  it("passes on cart problems, and hides unexpected errors", async () => {
    signIn();
    h.create.mockRejectedValue(new h.CheckoutError("Your cart is empty"));
    expect((await placeOrder(input())).error).toBe("Your cart is empty");
    h.create.mockRejectedValue(new Error("db exploded"));
    expect((await placeOrder(input())).error).toBe("We couldn't place your order. Please try again.");
  });
  it("saves a new address only when asked, and never beyond 10", async () => {
    signIn(); h.create.mockResolvedValue({ id: "o3" });
    await placeOrder(input());
    expect(h.addrCreate).not.toHaveBeenCalled();
    await placeOrder(input({ saveAddress: true }));
    expect(h.addrCreate).toHaveBeenCalledTimes(1);
    h.addrCount.mockResolvedValue(10);
    await placeOrder(input({ saveAddress: true }));
    expect(h.addrCreate).toHaveBeenCalledTimes(1);
  });
});

describe("submitPaymentReference", () => {
  const order = (o: object = {}) => ({ id: "o1", status: "PENDING", payments: [{ id: "pay1", gateway: "upi_qr", status: "PENDING" }], ...o });
  it("needs a logged-in customer", async () => {
    h.user.mockResolvedValue(null);
    expect((await submitPaymentReference(undefined, form({ orderId: "o1", reference: "123456789012" })))?.error).toMatch(/log in/);
  });
  it.each(["123", "12345-67890!", "abc def", ""])("rejects the reference %j", async (reference) => {
    signIn();
    expect((await submitPaymentReference(undefined, form({ orderId: "o1", reference })))?.error).toMatch(/reference number/);
    expect(h.payUpdate).not.toHaveBeenCalled();
  });
  it("tidies spaces and case, then records the reference for admin verification", async () => {
    signIn(); h.orderFind.mockResolvedValue(order());
    const r = await submitPaymentReference(undefined, form({ orderId: "o1", reference: " utr 1234 5678 9012 " }));
    expect(r?.ok).toMatch(/received your reference number/);
    expect(h.payUpdate).toHaveBeenCalledWith({ where: { id: "pay1" }, data: { gatewayPaymentId: "UTR123456789012", status: "PENDING" } });
  });
  it("only works on the customer's own order", async () => {
    const u = signIn(); h.orderFind.mockResolvedValue(null);
    expect((await submitPaymentReference(undefined, form({ orderId: "o1", reference: "123456789012" })))?.error).toBe("Order not found.");
    expect(h.orderFind.mock.calls[0][0].where).toMatchObject({ id: "o1", userId: u.id });
  });
  it("tells the customer when the order has expired, and when it is already paid", async () => {
    signIn(); h.orderFind.mockResolvedValue(order({ status: "CANCELLED" }));
    expect((await submitPaymentReference(undefined, form({ orderId: "o1", reference: "123456789012" })))?.error).toMatch(/expired/);
    h.orderFind.mockResolvedValue(order({ payments: [{ id: "pay1", gateway: "upi_qr", status: "SUCCESS" }] }));
    expect((await submitPaymentReference(undefined, form({ orderId: "o1", reference: "123456789012" })))?.ok).toMatch(/already confirmed/);
    expect(h.payUpdate).not.toHaveBeenCalled();
  });
  it("creates the payment record if it is somehow missing", async () => {
    const u = signIn(); h.orderFind.mockResolvedValue(order({ payments: [] })); h.ensure.mockResolvedValue({ id: "pay9" });
    await submitPaymentReference(undefined, form({ orderId: "o1", reference: "123456789012" }));
    expect(h.ensure).toHaveBeenCalledWith("o1", u.id);
    expect(h.payUpdate.mock.calls[0][0].where).toEqual({ id: "pay9" });
  });
  it("refuses a reference number already used for another order", async () => {
    signIn(); h.orderFind.mockResolvedValue(order());
    h.payUpdate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "5" }));
    expect((await submitPaymentReference(undefined, form({ orderId: "o1", reference: "123456789012" })))?.error).toMatch(/already used for another order/);
  });
  it("limits how often a customer can send references", async () => {
    signIn(); h.orderFind.mockResolvedValue(order());
    for (let i = 0; i < 10; i++) expect((await submitPaymentReference(undefined, form({ orderId: "o1", reference: "123456789012" })))?.ok).toBeTruthy();
    expect((await submitPaymentReference(undefined, form({ orderId: "o1", reference: "123456789012" })))?.error).toMatch(/Too many attempts/);
  });
});

describe("admin payment verification", () => {
  const pay = { id: "pay1", gatewayOrderId: "qr_1", gatewayPaymentId: "UTR111111111111", amount: 5000 };
  it("is only for admins", async () => {
    h.admin.mockRejectedValue(new Error("REDIRECT:/admin/login"));
    for (const fn of [approvePayment, rejectPayment, markOrderRefunded]) await expect(fn(form({ id: "x" }))).rejects.toThrow("REDIRECT:/admin/login");
    expect(h.success).not.toHaveBeenCalled(); expect(h.failed).not.toHaveBeenCalled(); expect(h.payUpdateMany).not.toHaveBeenCalled();
  });
  it("marks a payment paid with the amount WE asked for, never one typed in", async () => {
    h.payFind.mockResolvedValue(pay); h.success.mockResolvedValue("paid");
    await expect(approvePayment(form({ id: "pay1", amount: "1" }))).rejects.toThrow("REDIRECT:/admin/payments?notice=approved");
    expect(h.success).toHaveBeenCalledWith({ gatewayOrderId: "qr_1", gatewayPaymentId: "UTR111111111111", amount: 5000 });
  });
  it.each([["paid-but-cancelled", "cancelled"], ["already", "already"], ["mismatch", "invalid"], ["unknown", "invalid"]])("reports %s as %s", async (result, notice) => {
    h.payFind.mockResolvedValue(pay); h.success.mockResolvedValue(result);
    await expect(approvePayment(form({ id: "pay1" }))).rejects.toThrow(`notice=${notice}`);
  });
  it("can't approve a payment that has no reference number yet", async () => {
    h.payFind.mockResolvedValue({ ...pay, gatewayPaymentId: null });
    await expect(approvePayment(form({ id: "pay1" }))).rejects.toThrow("notice=invalid");
    h.payFind.mockResolvedValue(null);
    await expect(approvePayment(form({ id: "nope" }))).rejects.toThrow("notice=invalid");
    expect(h.success).not.toHaveBeenCalled();
  });
  it("rejects a reference so the customer can send another", async () => {
    h.payFind.mockResolvedValue(pay);
    await expect(rejectPayment(form({ id: "pay1" }))).rejects.toThrow("notice=rejected");
    expect(h.failed).toHaveBeenCalledWith("qr_1");
  });
  it("records a refund only for a cancelled order with a successful payment", async () => {
    h.orderFindUnique.mockResolvedValue(null);
    await expect(markOrderRefunded(form({ id: "o1" }))).rejects.toThrow("refund=none");
    h.orderFindUnique.mockResolvedValue({ status: "CONFIRMED", payments: [{ id: "pay1", status: "SUCCESS" }] });
    await expect(markOrderRefunded(form({ id: "o1" }))).rejects.toThrow("refund=notcancelled");
    h.orderFindUnique.mockResolvedValue({ status: "CANCELLED", payments: [{ id: "pay1", status: "PENDING" }] });
    await expect(markOrderRefunded(form({ id: "o1" }))).rejects.toThrow("refund=none");
    expect(h.payUpdateMany).not.toHaveBeenCalled();
    h.orderFindUnique.mockResolvedValue({ status: "CANCELLED", payments: [{ id: "pay1", status: "SUCCESS" }] });
    await expect(markOrderRefunded(form({ id: "o1" }))).rejects.toThrow("refund=ok");
    expect(h.payUpdateMany).toHaveBeenCalledWith({ where: { id: "pay1", status: "SUCCESS" }, data: { status: "REFUNDED" } });
  });
});
