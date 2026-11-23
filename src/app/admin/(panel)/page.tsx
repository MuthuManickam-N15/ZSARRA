import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [orders, sales, customers, products, low, recent, toVerify] = await Promise.all([
    db.order.count(),
    db.order.aggregate({ _sum: { total: true }, where: { status: { not: "CANCELLED" }, payments: { some: { status: "SUCCESS" } } } }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.product.count(),
    db.variant.findMany({ where: { stock: { lte: 5 }, product: { published: true } }, include: { product: { select: { id: true, name: true } } }, orderBy: { stock: "asc" }, take: 8 }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.payment.count({ where: { status: "PENDING", gatewayPaymentId: { not: null } } }),
  ]);
  const stats = [["Orders", String(orders)], ["Sales (paid)", formatPrice(sales._sum.total ?? 0)], ["Customers", String(customers)], ["Products", String(products)]];

  return (
    <div className="space-y-10">
      <h1 className="text-xl font-bold md:text-2xl">Dashboard</h1>
      {toVerify > 0 && (
        <Link href="/admin/payments" className="block border border-bronze bg-ivory/60 p-4 text-sm font-bold hover:bg-ivory">
          {toVerify} {toVerify === 1 ? "payment is" : "payments are"} waiting for your verification. Check {toVerify === 1 ? "it" : "them"} now →
        </Link>
      )}
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([k, v]) => <div key={k} className="border border-ink/20 bg-paper p-5"><dt className="text-sm text-ink/70">{k}</dt><dd className="mt-1 text-lg font-bold">{v}</dd></div>)}
      </dl>
      <div className="grid gap-8 lg:grid-cols-2">
        <section><h2 className="mb-3 text-base font-bold">Low stock</h2>
          {low.length === 0 ? <p className="border border-ink/20 bg-paper p-5 text-sm">No products are running low.</p> : (
            <ul className="divide-y divide-ink/15 border border-ink/20 bg-paper text-sm">
              {low.map((v) => <li key={v.id} className="flex justify-between p-3"><Link href={`/admin/products/${v.product.id}/edit`} className="hover:text-bronze">{v.product.name} · {v.color} {v.size}</Link><span>{v.stock === 0 ? "Sold out" : `${v.stock} left`}</span></li>)}
            </ul>)}
        </section>
        <section><h2 className="mb-3 text-base font-bold">Recent orders</h2>
          {recent.length === 0 ? <p className="border border-ink/20 bg-paper p-5 text-sm">No orders yet.</p> : (
            <ul className="divide-y divide-ink/15 border border-ink/20 bg-paper text-sm">
              {recent.map((o) => <li key={o.id} className="flex justify-between p-3"><span>#{o.number}</span><span>{formatPrice(o.total)} · {o.status.toLowerCase()}</span></li>)}
            </ul>)}
        </section>
      </div>
    </div>
  );
}
