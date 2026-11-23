import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import PaymentReferenceForm from "@/components/PaymentReferenceForm";
import { BRAND, CONTACT } from "@/lib/brand";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { DEFAULT_QR_IMAGE, DEFAULT_UPI_ID, getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Pay for your order" };
export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: { id: string } }) {
  const user = await requireUser(`/pay/${params.id}`);
  const order = await db.order.findFirst({ where: { id: params.id, userId: user.id }, include: { items: true, payments: true } }); // only your own orders
  if (!order) notFound();
  const settings = await getSettings();

  const payment = order.payments.find((p) => p.gateway === "upi_qr");
  const paid = order.payments.some((p) => p.status === "SUCCESS");
  const reference = payment?.gatewayPaymentId ?? null;
  const rejected = payment?.status === "FAILED";
  const qr = settings.qrImageUrl || DEFAULT_QR_IMAGE;
  const upiLink = settings.upiId !== DEFAULT_UPI_ID
    ? `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.upiName)}&am=${(order.total / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${order.number}`)}`
    : null;
  const help = <p className="text-sm text-ink/70">Need help? Call <a href={CONTACT.phoneHref} className="font-bold text-bronze">{CONTACT.phoneDisplay}</a> or email <a href={CONTACT.emailHref} className="font-bold text-bronze">{CONTACT.email}</a>.</p>;

  if (paid || order.status !== "PENDING") {
    const cancelled = order.status === "CANCELLED";
    return (
      <div className="container-page max-w-xl py-14 text-center">
        <h1 className="text-2xl font-bold md:text-3xl">{cancelled ? "This order has expired" : "Payment received"}</h1>
        <p className="mt-3 text-ink/70">{cancelled ? "Unpaid orders are released after an hour. If you have already paid, please contact us with your reference number." : `Thank you! Order #${order.number} is confirmed.`}</p>
        <Link href={`/account/orders/${order.id}`} className="btn-primary mt-6">View order</Link>
        <div className="mt-6">{help}</div>
      </div>
    );
  }

  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl font-bold md:text-3xl">Pay for order #{order.number}</h1>
      <p className="mt-1 text-sm text-ink/60">Pay by UPI, then send us the reference number. We confirm your order after checking the payment.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <section aria-label="Scan to pay" className="border border-ink/15 bg-white p-6 text-center">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink/60">Amount to pay</p>
            <p data-testid="pay-amount" className="mt-1 text-4xl font-bold">{formatPrice(order.total)}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`UPI QR code to pay ${BRAND}`} width={280} height={310} className="mx-auto mt-5 h-auto w-64 max-w-full border border-ink/10" />
            <p className="mt-4 text-sm text-ink/70">Scan with Google Pay, PhonePe, Paytm or any UPI app</p>
            <dl className="mx-auto mt-4 max-w-xs space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3"><dt className="text-ink/60">UPI ID</dt><dd className="flex items-center gap-3 font-bold" data-testid="pay-upi-id">{settings.upiId} <CopyButton text={settings.upiId} /></dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-ink/60">Name</dt><dd className="font-bold">{settings.upiName}</dd></div>
            </dl>
            {upiLink && <a href={upiLink} className="btn-primary mt-5 w-full sm:w-auto lg:hidden">Open my UPI app</a>}
          </section>

          <section aria-label="How to pay" className="border border-ink/15 bg-white p-6">
            <h2 className="text-base font-bold">How to pay</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink/80">
              <li>Open any UPI app and scan the QR code (or pay to the UPI ID above).</li>
              <li>Enter exactly <strong>{formatPrice(order.total)}</strong> and complete the payment.</li>
              <li>Copy the <strong>UPI reference number (UTR)</strong> shown after paying (usually 12 digits) and send it below.</li>
            </ol>
          </section>

          <section aria-label="Send your reference number" className="border border-ink/15 bg-white p-6">
            <h2 className="text-base font-bold">Send your reference number</h2>
            {reference && !rejected && <p role="status" className="mt-3 border border-bronze bg-ivory/50 p-3 text-sm">Reference received: <strong className="font-mono">{reference}</strong>. We're checking your payment and will confirm your order shortly. You can correct the number below if you made a mistake.</p>}
            {rejected && <p role="alert" className="mt-3 border border-ink bg-white p-3 text-sm">We couldn't match the reference number <strong className="font-mono">{reference}</strong> with a payment. Please check it and send it again, or call us.</p>}
            <div className="mt-4"><PaymentReferenceForm orderId={order.id} current={reference && !rejected ? reference : null} /></div>
            <p className="mt-4 text-xs text-ink/60">Orders you haven't paid for are released after 1 hour. Once you send a reference number, your order is kept until we verify it.</p>
          </section>
          {help}
        </div>

        <aside className="h-fit border border-ink/15 bg-white p-6 text-sm lg:sticky lg:top-28">
          <h2 className="text-base font-bold">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {order.items.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.name}<br /><span className="text-ink/60">{i.color} · {i.size} × {i.quantity}</span></span><span>{formatPrice(i.unitPrice * i.quantity)}</span></li>)}
          </ul>
          <dl className="mt-5 space-y-1 border-t border-ink/15 pt-4">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Shipping</dt><dd>{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</dd></div>
            {order.tax > 0 && <div className="flex justify-between"><dt>Tax</dt><dd>{formatPrice(order.tax)}</dd></div>}
            <div className="flex justify-between border-t border-ink/15 pt-2 text-base font-bold"><dt>Total</dt><dd>{formatPrice(order.total)}</dd></div>
          </dl>
          <address className="mt-5 border-t border-ink/15 pt-4 not-italic text-ink/70">Delivering to<br />{order.shipName} · {order.shipPhone}<br />{order.shipLine1}{order.shipLine2 ? `, ${order.shipLine2}` : ""}<br />{order.shipCity}, {order.shipState} {order.shipPincode}</address>
        </aside>
      </div>
    </div>
  );
}
