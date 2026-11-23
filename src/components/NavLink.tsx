"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** A link that knows when it points at the current page.
 *  variant "top" is the bold menu in the header, "chip" the phone menu, "link" a plain underlined link. */
export default function NavLink({ href, children, className = "", variant = "link" }: { href: string; children: React.ReactNode; className?: string; variant?: "link" | "chip" | "top" }) {
  const path = usePathname();
  const active = path === href || path.startsWith(`${href}/`);
  const style =
    variant === "top" ? `flex h-full items-center border-b-4 text-[13px] font-bold uppercase tracking-[0.05em] transition-colors ${active ? "border-bronze" : "border-transparent hover:border-bronze"}`
    : variant === "chip" ? `whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors ${active ? "border-ink bg-ink text-white" : "border-ink/20 hover:border-ink"}`
    : "link-u";
  return <Link href={href} aria-current={active ? "page" : undefined} className={`${style} ${className}`}>{children}</Link>;
}
