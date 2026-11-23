import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import ConfirmButton from "@/components/ConfirmButton";
import { markOrderRefunded } from "@/app/actions/payments";
import { updateOrderStatus } from "@/app/actions/admin2";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { ORDER_TRANSITIONS, STATUS_LABEL } from "@/lib/orders";

export const metadata: Metadata = { title: "Order", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: { id: string }; searchParams: { refund?: string } }) {
  const o = await db.order.findUnique({ where: { id: params.id }, include: { items: true, payments: { orderBy: { createdAt: "desc" } }, user: { select: { id: true, name: true, email: true } } } });
  if (!o) notFound();
  const next = ORDER_TRANSITIONS[o.status];
  const paidPayment = o.payments.find((p) => p.status === "SUCCESS");
  const refundMsg: Record<string, string> = { ok: "Marked as refunded.", notcancelled: "Cancel the order before marking it as refunded.", none: "There is no paid payment to refund." };
  const options = o.status === "SHIPPED" ? [o.status, ...next] : next;

  return (
    <div className="max-w-3xl space-y-8">
      <div><h1 className="text-xl font-bold md:text-2xl">Order #{o.number}</h1>
        <p className="text-sm text-ink/70">{o.createdAt.toLocaleString("en-IN")} · <Link href={`/admin/customers/${o.user.id}`} className="underline hover:text-bronze">{o.user.name}</Link> ({o.user.email})</p></div>

      <section><h2 className="mb-3 text-base font-bold">Items</h2>
        <ul className="divide-y divide-ink/15 border border-ink/20 bg-paper text-sm">
          {o.items.map((i) => <li key={i.id} className="flex justify-between p-3"><span>{i.name} · {i.color} {i.size} × {i.quantity}</span><span>{formatPrice(i.unitPrice * i.quantity)}</span></li>)}
        </ul>
        <dl className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(o.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd>{formatPrice(o.shipping)}</dd></div>
          <div className="flex justify-between"><dt>Tax</dt><dd>{formatPrice(o.tax)}</dd></div>
          <div className="flex justify-between border-t border-ink/20 pt-1 font-medium"><dt>Total</dt><dd>{formatPrice(o.total)}</dd></div>
        </dl>
      </section>

      <section><h2 className="mb-3 text-base font-bold">Delivery</h2>
        <address className="border border-ink/20 bg-paper p-4 text-sm not-italic">{o.shipName} · {o.shipPhone}<br />{o.shipLine1}{o.shipLine2 ? `, ${o.shipLine2}` : ""}<br />{o.shipCity}, {o.shipState} {o.shipPincode}</address>
      </section>

      <section><h2 className="mb-3 text-base font-bold">Payment</h2>
        {o.payments.length === 0 ? <p className="text-sm">No payment attempt yet.</p> : (
          <ul className="divide-y divide-ink/15 border border-ink/20 bg-paper text-sm">
            {o.payments.map((p) => <li key={p.id} className="flex flex-wrap justify-between gap-2 p-3"><span>{p.gatewayPaymentId ?? p.gatewayOrderId}</span><span>{formatPrice(p.amount)} · {p.status.toLowerCase()}</span></li>)}
          </ul>)}
        <p className="mt-2 text-xs text-ink/60">Payment status isn't edited here. Confirm or reject payments on the Payments page, after checking that the money arrived.</p>
      </section>

      {(paidPayment || searchParams.refund) && (
        <section><h2 className="mb-3 text-base font-bold">Refund</h2>
          {searchParams.refund && <p role="status" className="mb-3 border border-ink bg-paper p-3 text-sm">{refundMsg[searchParams.refund] ?? ""}</p>}
          {paidPayment && (o.status === "CANCELLED"
            ? <form action={markOrderRefunded}><input type="hidden" name="id" value={o.id} /><ConfirmButton message={`Mark ${formatPrice(paidPayment.amount)} as refunded? Do this only after you have sent the money back to the customer. This can't be undone.`} className="btn-outline">Mark {formatPrice(paidPayment.amount)} as refunded</ConfirmButton></form>
            : <p className="text-sm text-ink/70">To refund a paid order, cancel it first.</p>)}
        </section>
      )}

      <section><h2 className="mb-3 text-base font-bold">Status: {STATUS_LABEL[o.status]}</h2>
        {o.trackingNumber && <p className="mb-3 text-sm">Tracking number: {o.trackingNumber}</p>}
        {options.length === 0 ? <p className="text-sm">This order is {STATUS_LABEL[o.status].toLowerCase()} and can't be changed.</p> : (
          <ActionForm action={updateOrderStatus} submit="Update order" className="max-w-md space-y-4">
            <input type="hidden" name="id" value={o.id} />
            <label className="block text-sm">New status<select name="status" defaultValue={options[0]} className="field mt-1">{options.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
            <label className="block text-sm">Tracking number (needed to mark as shipped)<input name="trackingNumber" defaultValue={o.trackingNumber ?? ""} maxLength={60} className="field mt-1" /></label>
          </ActionForm>)}
      </section>
    </div>
  );
}
