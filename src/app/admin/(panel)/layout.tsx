import { BRAND } from "@/lib/brand";
import AdminNav from "@/components/AdminNav";
import { logout } from "@/app/actions/auth";
import { requireAdmin } from "@/lib/session";

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/import", label: "Bulk import" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin(); // server-side gate for every page in this group
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-ink/15 bg-ink p-4 text-paper lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:p-6">
        <p className="text-lg font-bold">{BRAND} <span className="text-sm text-bronze">admin</span></p>
        <AdminNav items={nav} />
        <form action={logout} className="mt-4 text-sm lg:mt-10"><span className="mr-3 text-ivory/60">{admin.email}</span><button className="underline transition-colors hover:text-bronze">Log out</button></form>
      </aside>
      <div className="p-4 sm:p-8">{children}</div>
    </div>
  );
}
