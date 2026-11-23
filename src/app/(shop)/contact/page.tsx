import type { Metadata } from "next";
import { BRAND, CONTACT } from "@/lib/brand";

export const metadata: Metadata = { title: "Contact us" };

export default function Contact() {
  const card = "flex flex-col border border-ink/15 bg-white p-5";
  const label = "text-[13px] font-bold uppercase tracking-[0.08em] text-ink/60";
  return (
    <div className="container-page max-w-3xl py-10 md:py-14">
      <h1 className="text-2xl font-bold md:text-3xl">Contact us</h1>
      <p className="mt-3 max-w-xl text-ink/70">Questions about an order, a size or a product? Call or email {BRAND} and include your order number if you have one. We're happy to help.</p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-3">
        <li className={card}>
          <p className={label}>Call</p>
          <a href={CONTACT.phoneHref} className="mt-2 text-lg font-bold hover:text-bronze">{CONTACT.phoneDisplay}</a>
          <a href={CONTACT.phoneHref} className="btn-outline mt-4 py-2">Call now</a>
        </li>
        <li className={card}>
          <p className={label}>Email</p>
          <a href={CONTACT.emailHref} className="mt-2 break-all text-lg font-bold hover:text-bronze">{CONTACT.email}</a>
          <a href={CONTACT.emailHref} className="btn-outline mt-4 py-2">Send an email</a>
        </li>
        <li className={card}>
          <p className={label}>Address</p>
          <address className="mt-2 text-lg font-bold not-italic">{CONTACT.address}</address>
          <a href={CONTACT.mapsHref} target="_blank" rel="noopener noreferrer" className="btn-outline mt-4 py-2">Open in Maps</a>
        </li>
      </ul>
    </div>
  );
}
