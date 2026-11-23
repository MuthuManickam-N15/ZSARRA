import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/orders";
import { CONTACT } from "@/lib/brand";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Order details" };
export const dynamic = "force-dynamic";

const steps = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export default async function OrderDetails({ params }: { params: { id: string } }) {
  const user = await requireUser(`/account/orders/${params.id}`);
  // userId in the filter: customers can only open their own orders
  const o = await db.order.findFirst({ where: { id: params.id, userId: user.id }, include: { items: true, payments: true } });
  if (!o) notFound();
  const at = steps.indexOf(o.status as (typeof steps)[number]);
  const paid = o.payments.some((p) => p.status === "SUCCESS");
  const awaiting = o.payments.some((p) => p.status === "PENDING" && p.gatewayPaymentId);

  return (
    <div className="container-page max-w-3xl space-y-8 py-16">
      <Link href="/account/orders" className="text-sm underline hover:text-bronze">All orders</Link>
      <h1 className="text-2xl font-bold md:text-3xl">Order #{o.number}</h1>
      <p className="text-sm">Placed {o.createdAt.toLocaleDateString("en-IN")} · {paid ? "Payment received" : awaiting ? "Payment awaiting verification" : "Payment not received"}</p>
      {o.status === "PENDING" && !paid && (
        <div className="border border-ink/20 bg-paper p-4 text-sm">
          {awaiting
            ? <p>We've received your payment reference and will confirm your payment shortly.</p>
            : <p>Payment hasn't been completed. Your items are held for 1 hour from when you placed the order.</p>}
          <Link href={`/pay/${o.id}`} className="btn-primary mt-3">{awaiting ? "View payment details" : "Pay now"}</Link>
        </div>
      )}

      {o.status === "CANCELLED" ? <p className="border border-ink bg-paper p-4 text-sm">This order was cancelled.</p> : (
        <ol className="grid gap-2 sm:grid-cols-5" aria-label="Order progress">
          {steps.map((s, i) => <li key={s} aria-current={i === at ? "step" : undefined} className={`border-t-4 pt-2 text-sm ${i <= at ? "border-bronze" : "border-ink/20 text-ink/50"}`}>{STATUS_LABEL[s]}</li>)}
        </ol>)}
      {o.trackingNumber && <p className="text-sm">Tracking number: <strong>{o.trackingNumber}</strong></p>}

      <ul className="divide-y divide-ink/15 border border-ink/20 bg-paper text-sm">
        {o.items.map((i) => <li key={i.id} className="flex justify-between p-3"><span>{i.name} · {i.color} {i.size} × {i.quantity}</span><span>{formatPrice(i.unitPrice * i.quantity)}</span></li>)}
      </ul>
      <dl className="ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(o.subtotal)}</dd></div>
        <div className="flex justify-between"><dt>Shipping</dt><dd>{formatPrice(o.shipping)}</dd></div>
        <div className="flex justify-between"><dt>Tax</dt><dd>{formatPrice(o.tax)}</dd></div>
        <div className="flex justify-between border-t border-ink/20 pt-1 font-medium"><dt>Total</dt><dd>{formatPrice(o.total)}</dd></div>
      </dl>
      <p className="text-sm text-ink/70">Need help with this order? Call <a href={CONTACT.phoneHref} className="font-bold text-bronze">{CONTACT.phoneDisplay}</a> or email <a href={CONTACT.emailHref} className="font-bold text-bronze">{CONTACT.email}</a>.</p>
      <address className="border border-ink/20 bg-paper p-4 text-sm not-italic">Delivering to<br />{o.shipName} · {o.shipPhone}<br />{o.shipLine1}{o.shipLine2 ? `, ${o.shipLine2}` : ""}<br />{o.shipCity}, {o.shipState} {o.shipPincode}</address>
    </div>
  );
}
