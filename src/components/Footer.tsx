import Link from "next/link";
import Logo from "./Logo";
import { BRAND, CONTACT } from "@/lib/brand";

const cols = [
  { title: "Shop", links: [["/women", "Women"], ["/men", "Men"], ["/new-arrivals", "New arrivals"], ["/sale", "Sale"]] },
  { title: "Customer policies", links: [["/reviews", "Customer reviews"], ["/contact", "Contact us"], ["/faq", "FAQ"], ["/policies/shipping", "Shipping"], ["/policies/returns", "Returns"], ["/policies/privacy", "Privacy"], ["/policies/terms", "Terms of use"]] },
  { title: "My account", links: [["/login", "Log in"], ["/account/orders", "Track an order"], ["/wishlist", "Wishlist"], ["/cart", "Cart"]] },
];
const promises = ["Pay easily with any UPI app", "Easy 14-day returns", "Delivered to your door"];

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-ink/10 bg-ivory/60">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr_1fr]">
        <div>
          <Logo className="h-24 w-auto" />
          <p className="mt-3 max-w-xs text-sm text-ink/70">Modern essentials for men and women, made to be worn daily.</p>
          <address className="mt-4 space-y-1.5 text-sm not-italic text-ink/80">
            <p><span className="font-bold">Call:</span> <a href={CONTACT.phoneHref} className="hover:text-bronze">{CONTACT.phoneDisplay}</a></p>
            <p><span className="font-bold">Email:</span> <a href={CONTACT.emailHref} className="break-all hover:text-bronze">{CONTACT.email}</a></p>
            <p><span className="font-bold">Visit:</span> <a href={CONTACT.mapsHref} target="_blank" rel="noopener noreferrer" className="hover:text-bronze">{CONTACT.address}</a></p>
          </address>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h2 className="mb-4 text-[13px] font-bold uppercase tracking-[0.08em]">{c.title}</h2>
            <ul className="space-y-2.5 text-sm text-ink/75">
              {c.links.map(([href, label]) => <li key={href}><Link href={href} className="transition-colors hover:text-bronze">{label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-ink/10">
        <ul className="container-page flex flex-wrap gap-x-8 gap-y-2 py-4 text-xs font-semibold text-ink/70">
          {promises.map((p) => <li key={p} className="flex items-center gap-2"><span aria-hidden className="text-bronze">✓</span>{p}</li>)}
        </ul>
      </div>
      <div className="bg-ink">
        <div className="container-page flex flex-wrap justify-between gap-2 py-4 text-xs text-ivory/70">
          <span>© {new Date().getFullYear()} {BRAND}. All rights reserved.</span>
          <span>Pay by UPI QR</span>
        </div>
      </div>
    </footer>
  );
}
