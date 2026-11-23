import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import { setCustomerActive } from "@/app/actions/admin2";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/orders";

export const metadata: Metadata = { title: "Customer", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Customer({ params }: { params: { id: string } }) {
  // passwordHash is deliberately not selected.
  const c = await db.user.findFirst({
    where: { id: params.id, role: "CUSTOMER" },
    select: { id: true, name: true, email: true, phone: true, active: true, createdAt: true, addresses: true, orders: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  if (!c) notFound();
  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-xl font-bold md:text-2xl">{c.name}</h1><p className="text-sm text-ink/70">{c.email}{c.phone ? ` · ${c.phone}` : ""} · joined {c.createdAt.toLocaleDateString("en-IN")}</p></div>
        <form action={setCustomerActive}>
          <input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={c.active ? "0" : "1"} />
          <ConfirmButton message={c.active ? "Deactivate this account? They will be logged out and can't sign in." : "Reactivate this account?"} className="btn-outline">{c.active ? "Deactivate account" : "Reactivate account"}</ConfirmButton>
        </form>
      </div>
      <p className="text-sm">Status: <strong>{c.active ? "Active" : "Deactivated"}</strong></p>
      <section><h2 className="mb-3 text-base font-bold">Orders</h2>
        {c.orders.length === 0 ? <p className="border border-ink/20 bg-paper p-5 text-sm">No orders yet.</p> : (
          <ul className="divide-y divide-ink/15 border border-ink/20 bg-paper text-sm">
            {c.orders.map((o) => <li key={o.id} className="flex justify-between p-3"><Link href={`/admin/orders/${o.id}`} className="hover:text-bronze">#{o.number} · {o.createdAt.toLocaleDateString("en-IN")}</Link><span>{formatPrice(o.total)} · {STATUS_LABEL[o.status]}</span></li>)}
          </ul>)}
      </section>
      <section><h2 className="mb-3 text-base font-bold">Saved addresses</h2>
        {c.addresses.length === 0 ? <p className="text-sm">None saved.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2">{c.addresses.map((a) => <li key={a.id} className="border border-ink/20 bg-paper p-3 text-sm">{a.fullName}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.pincode}</li>)}</ul>)}
      </section>
    </div>
  );
}
