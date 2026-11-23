"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { markPaymentFailed, markPaymentSuccess } from "@/lib/payments";
import { requireAdmin } from "@/lib/session";

const refresh = () => revalidatePath("/", "layout");

/** The admin has checked the bank or UPI app and the money (and reference number) has arrived: mark it paid and confirm the order. */
export async function approvePayment(form: FormData) {
  await requireAdmin();
  const pay = await db.payment.findUnique({ where: { id: String(form.get("id") ?? "") } });
  if (!pay || !pay.gatewayPaymentId) redirect("/admin/payments?notice=invalid");
  const r = await markPaymentSuccess({ gatewayOrderId: pay.gatewayOrderId, gatewayPaymentId: pay.gatewayPaymentId, amount: pay.amount });
  refresh();
  redirect(`/admin/payments?notice=${r === "paid" ? "approved" : r === "paid-but-cancelled" ? "cancelled" : r === "already" ? "already" : "invalid"}`);
}

/** The reference number doesn't match any money received: reject it so the customer can send the right one. */
export async function rejectPayment(form: FormData) {
  await requireAdmin();
  const pay = await db.payment.findUnique({ where: { id: String(form.get("id") ?? "") } });
  if (!pay) redirect("/admin/payments?notice=invalid");
  await markPaymentFailed(pay.gatewayOrderId);
  refresh();
  redirect("/admin/payments?notice=rejected");
}

/** Record that a cancelled, paid order has been refunded. The money is sent back by you (for example by UPI) first; this only updates the record. */
export async function markOrderRefunded(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const back = (r: string) => `/admin/orders/${id}?refund=${r}`;
  const order = await db.order.findUnique({ where: { id }, include: { payments: true } });
  const pay = order?.payments.find((p) => p.status === "SUCCESS");
  if (!order || !pay) redirect(back("none"));
  if (order.status !== "CANCELLED") redirect(back("notcancelled"));
  await db.payment.updateMany({ where: { id: pay.id, status: "SUCCESS" }, data: { status: "REFUNDED" } });
  refresh();
  redirect(back("ok"));
}
