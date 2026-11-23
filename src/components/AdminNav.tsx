"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="mt-4 flex gap-1 overflow-x-auto text-sm lg:mt-8 lg:flex-col">
      {items.map((n) => {
        const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap px-3 py-2 transition-all duration-300 ${active ? "bg-paper text-ink" : "text-ivory/80 hover:translate-x-1 hover:bg-paper/10 hover:text-paper"}`}>
            {n.label}
          </Link>
        );
      })}
      <Link href="/" className="whitespace-nowrap px-3 py-2 text-ivory/50 transition-colors hover:text-bronze">View store</Link>
    </nav>
  );
}
