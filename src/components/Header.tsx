import Link from "next/link";
import Logo from "./Logo";
import NavLink from "./NavLink";
import { getCurrentUser } from "@/lib/session";
import { getCartCount } from "@/lib/cart";

const nav = [
  { href: "/women", label: "Women" },
  { href: "/men", label: "Men" },
  { href: "/new-arrivals", label: "New arrivals" },
  { href: "/sale", label: "Sale" },
];

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);
const action = "flex flex-col items-center gap-0.5 text-[11px] font-semibold transition-colors hover:text-bronze";

export default async function Header() {
  const user = await getCurrentUser();
  const cartCount = user ? await getCartCount(user.id) : 0;
  return (
    <header className="site-header">
      <div className="container-page flex flex-wrap items-center gap-x-6 gap-y-2.5 py-3 lg:flex-nowrap lg:py-0">
        <div className="order-1 flex items-center lg:h-[76px]"><Logo /></div>

        <nav aria-label="Main" className="order-2 hidden h-[76px] items-stretch gap-8 lg:flex">
          {nav.map((n) => <NavLink key={n.href} href={n.href} variant="top">{n.label}</NavLink>)}
        </nav>

        <form action="/search" method="get" role="search" className="order-3 w-full lg:ml-2 lg:max-w-xl lg:flex-1">
          <label className="relative block">
            <span className="sr-only">Search products</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50"><Icon><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Icon></span>
            <input name="q" type="text" autoComplete="off" placeholder="Search for products, categories and more" className="h-10 w-full rounded-sm bg-ivory/70 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-ink/50 focus:bg-white focus:ring-1 focus:ring-ink/30" />
          </label>
        </form>

        <div className="order-2 ml-auto flex items-center gap-5 lg:order-4 lg:ml-0">
          <Link href={user ? "/account" : "/login"} className={action}>
            <Icon><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icon>
            <span>{user ? user.name.split(" ")[0] : "Log in"}</span>
          </Link>
          <Link href="/wishlist" className={action}>
            <Icon><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></Icon>
            <span>Wishlist</span>
          </Link>
          <Link href="/cart" className={action}>
            <Icon><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></Icon>
            <span>Cart{cartCount > 0 && <>{" "}<span key={cartCount} className="count-pop">({cartCount})</span></>}</span>
          </Link>
        </div>

        <nav aria-label="Main mobile" className="order-4 flex w-full gap-2 overflow-x-auto pb-1 lg:hidden">
          {nav.map((n) => <NavLink key={n.href} href={n.href} variant="chip">{n.label}</NavLink>)}
        </nav>
      </div>
    </header>
  );
}
