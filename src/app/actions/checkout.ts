"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { allow } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { addressSchema } from "@/lib/validation";
import { CheckoutError, createOrderFromCart, ensureQrPayment, type Ship } from "@/lib/checkout";
import type { FormState } from "./auth";

const inputSchema = z.object({
  key: z.string().uuid(),
  addressId: z.string().min(1).optional(),
  address: addressSchema.optional(),
  saveAddress: z.boolean().optional(),
});

/** Creates the order (stock is reserved) and its payment record. The browser then sends the customer to the QR payment page. */
export async function placeOrder(raw: unknown): Promise<{ error?: string; orderId?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in to place an order" };
  if (!(await getSettings()).paymentsEnabled) return { error: "Orders are paused right now. Please try again later." };
  if (!allow(`checkout:${user.id}`, 10, 10 * 60_000)) return { error: "Too many attempts. Please wait a few minutes." };

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your delivery details" };
  const { key, addressId, address, saveAddress } = parsed.data;

  let ship: Ship;
  if (addressId) {
    const a = await db.address.findFirst({ where: { id: addressId, userId: user.id } });
    if (!a) return { error: "That address isn't in your address book" };
    ship = a;
  } else if (address) ship = address;
  else return { error: "Choose or enter a delivery address" };

  let orderId: string;
  try {
    const order = await createOrderFromCart(user.id, ship, key);
    await ensureQrPayment(order.id, user.id);
    orderId = order.id;
  } catch (e) { return { error: e instanceof CheckoutError ? e.message : "We couldn't place your order. Please try again." }; }

  if (!addressId && saveAddress && (await db.address.count({ where: { userId: user.id } })) < 10) {
    await db.address.create({ data: { ...ship, line2: ship.line2 || null, userId: user.id, isDefault: false } });
  }
  revalidatePath("/", "layout");
  return { orderId };
}

const refSchema = z.object({
  orderId: z.string().min(1),
  reference: z.string().regex(/^[A-Z0-9]{10,22}$/, "Enter the UPI reference number (UTR) from your payment app. It is usually 12 digits."),
});

/** The customer tells us the UPI reference number of the payment they made. An admin then checks it against the money received. */
export async function submitPaymentReference(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in to continue." };
  if (!allow(`payref:${user.id}`, 10, 3_600_000)) return { error: "Too many attempts. Please try again later or call us." };

  const parsed = refSchema.safeParse({ orderId: form.get("orderId"), reference: String(form.get("reference") ?? "").replace(/\s+/g, "").toUpperCase() });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the reference number." };
  const { orderId, reference } = parsed.data;

  const order = await db.order.findFirst({ where: { id: orderId, userId: user.id }, include: { payments: true } });
  if (!order) return { error: "Order not found." };
  if (order.status === "CANCELLED") return { error: "This order has expired. If you have already paid, please call us with your reference number." };
  if (order.payments.some((p) => p.status === "SUCCESS")) return { ok: "Your payment is already confirmed. Thank you!" };

  try {
    const pay = order.payments.find((p) => p.gateway === "upi_qr") ?? (await ensureQrPayment(order.id, user.id));
    await db.payment.update({ where: { id: pay.id }, data: { gatewayPaymentId: reference, status: "PENDING" } }); // a rejected payment can be sent again
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "This reference number was already used for another order. Please check the number." };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: "Thanks! We've received your reference number and will confirm your payment shortly." };
}
