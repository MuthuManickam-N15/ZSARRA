import type { Metadata } from "next";
import Link from "next/link";
import { PaymentStatus } from "@prisma/client";
import ConfirmButton from "@/components/ConfirmButton";
import { approvePayment, rejectPayment } from "@/app/actions/payments";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Payments", robots: { index: false } };
export const dynamic = "force-dynamic";
const SIZE = 20;
const statuses: PaymentStatus[] = ["PENDING", "SUCCESS", "FAILED", "REFUNDED"];
const notices: Record<string, string> = {
  approved: "Payment marked as paid and the order is confirmed.",
  rejected: "Payment rejected. The customer can send a new reference number.",
  cancelled: "Payment recorded, but the order had already expired and its stock is gone. The order stays cancelled, so please refund this customer.",
  already: "That payment was already handled.",
  invalid: "That payment can't be processed.",
};
const when = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function Payments({ searchParams: sp }: { searchParams: { status?: string; page?: string; notice?: string } }) {
  const where = statuses.includes(sp.status as PaymentStatus) ? { status: sp.status as PaymentStatus } : {};
  const page = Math.max(1, Number(sp.page) || 1);
  const [awaiting, rows, total] = await Promise.all([
    db.payment.findMany({
      where: { status: "PENDING", gatewayPaymentId: { not: null } }, orderBy: { updatedAt: "asc" },
      include: { order: { select: { id: true, number: true, user: { select: { name: true, email: true } } } } },
    }),
    db.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE, include: { order: { select: { id: true, number: true } } } }),
    db.payment.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / SIZE));
  const link = (n: number) => `/admin/payments?${new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), page: String(n) })}`;
  const label = (p: { status: string; gatewayPaymentId: string | null }) => p.status === "PENDING" ? (p.gatewayPaymentId ? "Awaiting verification" : "Awaiting payment") : p.status[0] + p.status.slice(1).toLowerCase();

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold md:text-2xl">Payments</h1>
      {sp.notice && notices[sp.notice] && <p role="status" className="border border-bronze bg-ivory/50 p-3 text-sm">{notices[sp.notice]}</p>}

      <section aria-labelledby="awaiting">
        <h2 id="awaiting" className="mb-1 text-base font-bold">Awaiting verification ({awaiting.length})</h2>
        <p className="mb-3 text-sm text-ink/70">Customers paid by UPI and sent a reference number (UTR). Open your bank or UPI app, check that this amount and reference have arrived, then mark it as paid. Only then is the order confirmed.</p>
        {awaiting.length === 0 ? <p className="border border-ink/15 bg-white p-6 text-center text-sm">Nothing is waiting for verification.</p> : (
          <div className="overflow-x-auto border border-ink/15 bg-white">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="border-b border-ink/15"><tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Amount</th><th className="p-3">Reference (UTR)</th><th className="p-3">Sent</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y divide-ink/10">
                {awaiting.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="p-3"><Link href={`/admin/orders/${p.order.id}`} className="font-medium hover:text-bronze">#{p.order.number}</Link></td>
                    <td className="p-3">{p.order.user.name}<div className="text-xs text-ink/60">{p.order.user.email}</div></td>
                    <td className="p-3 font-bold">{formatPrice(p.amount)}</td>
                    <td className="p-3 font-mono text-xs">{p.gatewayPaymentId}</td>
                    <td className="p-3 text-xs text-ink/70">{when(p.updatedAt)}</td>
                    <td className="p-3"><div className="flex gap-3">
                      <form action={approvePayment}><input type="hidden" name="id" value={p.id} /><ConfirmButton message={`Confirm that ${formatPrice(p.amount)} with reference ${p.gatewayPaymentId} has arrived in your bank or UPI app?`} className="btn-primary px-4 py-2">Mark as paid</ConfirmButton></form>
                      <form action={rejectPayment}><input type="hidden" name="id" value={p.id} /><ConfirmButton message="Reject this reference number? The customer will be able to send another one." className="btn-outline px-4 py-2">Reject</ConfirmButton></form>
                    </div></td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </section>

      <section aria-labelledby="all">
        <h2 id="all" className="mb-3 text-base font-bold">All payments</h2>
        <form className="mb-4 flex gap-2"><select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="field w-auto"><option value="">Any status</option>{statuses.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}</select><button className="btn-outline">Filter</button></form>
        {rows.length === 0 ? <p className="border border-ink/15 bg-white p-10 text-center text-sm">No payments yet.</p> : (
          <div className="overflow-x-auto border border-ink/15 bg-white">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-ink/15"><tr><th className="p-3">Order</th><th className="p-3">Reference</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Date</th></tr></thead>
              <tbody className="divide-y divide-ink/10">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3"><Link href={`/admin/orders/${p.order.id}`} className="hover:text-bronze">#{p.order.number}</Link></td>
                    <td className="p-3 font-mono text-xs">{p.gatewayPaymentId ?? p.gatewayOrderId}</td>
                    <td className="p-3">{formatPrice(p.amount)}</td>
                    <td className="p-3">{label(p)}</td>
                    <td className="p-3">{p.createdAt.toLocaleString("en-IN")}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
        {pages > 1 && <nav aria-label="Pagination" className="mt-4 flex justify-center gap-6 text-sm">{page > 1 && <Link href={link(page - 1)}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={link(page + 1)}>Next</Link>}</nav>}
      </section>
    </div>
  );
}
