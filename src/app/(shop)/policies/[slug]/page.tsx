import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONTACT } from "@/lib/brand";

const policies: Record<string, { title: string; body: string[] }> = {
  shipping: { title: "Shipping policy", body: ["Orders are dispatched within 2 business days of payment confirmation.", "Shipping charges and the free-shipping threshold are shown at checkout.", "You will receive a tracking number once your order ships. Edit this text to match your courier terms."] },
  returns: { title: "Returns policy", body: ["Unworn items with tags can be returned within 14 days of delivery.", "Refunds are issued to the original payment method after the item is received and inspected. Edit this text to match your business rules."] },
  privacy: { title: "Privacy policy", body: ["We collect only the details needed to process your orders: name, email, phone and delivery address.", "We never ask for card or bank passwords; you pay directly from your own UPI app and we only keep the payment reference number you send us. Have this reviewed by a legal professional before launch."] },
  terms: { title: "Terms and conditions", body: ["By placing an order you agree to these terms.", "Prices are in Indian rupees and include applicable taxes as shown at checkout. Have this reviewed by a legal professional before launch."] },
};

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return { title: policies[params.slug]?.title };
}

export default function Policy({ params }: { params: { slug: string } }) {
  const p = policies[params.slug];
  if (!p) notFound();
  return (
    <article className="container-page max-w-2xl py-16">
      <h1 className="text-2xl font-bold md:text-3xl">{p.title}</h1>
      <div className="mt-8 space-y-4 leading-relaxed">{p.body.map((t) => <p key={t}>{t}</p>)}</div>
      <p className="mt-10 border-t border-ink/10 pt-4 text-sm text-ink/70">Questions? Call <a href={CONTACT.phoneHref} className="font-bold hover:text-bronze">{CONTACT.phoneDisplay}</a> or email <a href={CONTACT.emailHref} className="font-bold hover:text-bronze">{CONTACT.email}</a>.</p>
    </article>
  );
}
