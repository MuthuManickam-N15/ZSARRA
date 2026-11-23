import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/orders";

export const metadata: Metadata = { title: "Orders", robots: { index: false } };
export const dynamic = "force-dynamic";
const SIZE = 20;

export default async function Orders({ searchParams: sp }: { searchParams: { q?: string; status?: string; page?: string } }) {
  const where: Prisma.OrderWhereInput = {
    ...(sp.status && sp.status in STATUS_LABEL ? { status: sp.status as OrderStatus } : {}),
    ...(sp.q ? { OR: [{ number: { contains: sp.q, mode: "insensitive" } }, { shipName: { contains: sp.q, mode: "insensitive" } }, { user: { email: { contains: sp.q, mode: "insensitive" } } }] } : {}),
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const [rows, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE, include: { payments: { select: { status: true, gatewayPaymentId: true } }, items: { select: { quantity: true } } } }),
    db.order.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / SIZE));
  const link = (n: number) => `/admin/orders?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(n) })}`;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold md:text-2xl">Orders</h1>
      <form className="flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Order number, name or email" aria-label="Search orders" className="field max-w-xs" />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="field w-auto"><option value="">Any status</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn-outline">Filter</button>
      </form>
      {rows.length === 0 ? <p className="border border-ink/20 bg-paper p-10 text-center text-sm">No orders found.</p> : (
        <div className="overflow-x-auto border border-ink/20 bg-paper">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-ink/20"><tr><th className="p-3">Order</th><th className="p-3">Date</th><th className="p-3">Items</th><th className="p-3">Total</th><th className="p-3">Payment</th><th className="p-3">Status</th></tr></thead>
            <tbody className="divide-y divide-ink/10">
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-bronze">#{o.number}</Link><div className="text-xs text-ink/60">{o.shipName}</div></td>
                  <td className="p-3">{o.createdAt.toLocaleDateString("en-IN")}</td>
                  <td className="p-3">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                  <td className="p-3">{formatPrice(o.total)}</td>
                  <td className="p-3">{o.payments.some((p) => p.status === "SUCCESS") ? "Paid" : o.payments.some((p) => p.status === "REFUNDED") ? "Refunded" : o.payments.some((p) => p.status === "PENDING" && p.gatewayPaymentId) ? "Awaiting verification" : "Not paid"}</td>
                  <td className="p-3">{STATUS_LABEL[o.status]}</td>
                </tr>))}
            </tbody>
          </table>
        </div>)}
      {pages > 1 && <nav aria-label="Pagination" className="flex justify-center gap-6 text-sm">{page > 1 && <Link href={link(page - 1)}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={link(page + 1)}>Next</Link>}</nav>}
    </div>
  );
}
