import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My orders" };
export const dynamic = "force-dynamic";

export default async function Orders() {
  const user = await requireUser("/account/orders");
  const orders = await db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { items: true } });
  return (
    <div className="container-page max-w-3xl py-16">
      <h1 className="text-2xl font-bold md:text-3xl">My orders</h1>
      {orders.length === 0 ? (
        <div className="mt-8 border border-ink/20 bg-paper p-10 text-center">
          <p>You haven't placed an order yet.</p>
          <Link href="/new-arrivals" className="btn-primary mt-4">Browse new arrivals</Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-ink/15 border-y border-ink/15">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap justify-between gap-2 py-4 text-sm">
              <Link href={`/account/orders/${o.id}`} className="hover:text-bronze">#{o.number} · {o.createdAt.toLocaleDateString("en-IN")}</Link>
              <span>{o.items.reduce((n, i) => n + i.quantity, 0)} items · {formatPrice(o.total)} · {o.status.toLowerCase()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
