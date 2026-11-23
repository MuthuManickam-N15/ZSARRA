import type { Metadata } from "next";
import { CONTACT } from "@/lib/brand";
export const metadata: Metadata = { title: "FAQ" };

const faqs = [
  ["How long does delivery take?", "Most orders arrive within 3 to 7 business days. You get a tracking number when your order ships."],
  ["How do I find my size?", "Choose a size on the product page. Sizes that are sold out are crossed out."],
  ["Can I return an item?", "Yes, unworn items with tags can be returned within 14 days. See the returns policy."],
  ["How can I contact you?", `Call ${CONTACT.phoneDisplay} or email ${CONTACT.email}. Our address is ${CONTACT.address}.`],
  ["Which payment methods do you accept?", "You pay by UPI. After you place an order you will see a QR code: scan it with Google Pay, PhonePe, Paytm or any UPI app, pay the exact amount and send us the reference number. We confirm your order once we have checked the payment."],
];

export default function FAQ() {
  return (
    <div className="container-page max-w-2xl py-16">
      <h1 className="text-2xl font-bold md:text-3xl">Frequently asked questions</h1>
      <div className="mt-8 divide-y divide-ink/15 border-y border-ink/15">
        {faqs.map(([q, a]) => (
          <details key={q} className="py-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2">{a}</p></details>
        ))}
      </div>
    </div>
  );
}
