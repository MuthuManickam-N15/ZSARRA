import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Customers", robots: { index: false } };
export const dynamic = "force-dynamic";
const SIZE = 20;

export default async function Customers({ searchParams: sp }: { searchParams: { q?: string; page?: string } }) {
  const where = { role: "CUSTOMER" as const, ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" as const } }, { email: { contains: sp.q, mode: "insensitive" as const } }] } : {}) };
  const page = Math.max(1, Number(sp.page) || 1);
  const [rows, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE, select: { id: true, name: true, email: true, active: true, createdAt: true, _count: { select: { orders: true } } } }),
    db.user.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / SIZE));
  const link = (n: number) => `/admin/customers?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(n) })}`;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold md:text-2xl">Customers</h1>
      <form className="flex gap-2" role="search"><input name="q" defaultValue={sp.q} placeholder="Search name or email" aria-label="Search customers" className="field max-w-xs" /><button className="btn-outline">Search</button></form>
      {rows.length === 0 ? <p className="border border-ink/20 bg-paper p-10 text-center text-sm">No customers found.</p> : (
        <div className="overflow-x-auto border border-ink/20 bg-paper">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-ink/20"><tr><th className="p-3">Customer</th><th className="p-3">Joined</th><th className="p-3">Orders</th><th className="p-3">Status</th></tr></thead>
            <tbody className="divide-y divide-ink/10">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="p-3"><Link href={`/admin/customers/${c.id}`} className="font-medium hover:text-bronze">{c.name}</Link><div className="text-xs text-ink/60">{c.email}</div></td>
                  <td className="p-3">{c.createdAt.toLocaleDateString("en-IN")}</td>
                  <td className="p-3">{c._count.orders}</td>
                  <td className="p-3">{c.active ? "Active" : "Deactivated"}</td>
                </tr>))}
            </tbody>
          </table>
        </div>)}
      {pages > 1 && <nav aria-label="Pagination" className="flex justify-center gap-6 text-sm">{page > 1 && <Link href={link(page - 1)}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={link(page + 1)}>Next</Link>}</nav>}
    </div>
  );
}
