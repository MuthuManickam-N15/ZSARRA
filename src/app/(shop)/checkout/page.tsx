import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CheckoutForm from "@/components/CheckoutForm";
import { db } from "@/lib/db";
import { getCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { expireStaleOrders } from "@/lib/payments";
import { requireUser } from "@/lib/session";
import { getSettings, priceOrder } from "@/lib/settings";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function Checkout() {
  const user = await requireUser("/checkout");
  await expireStaleOrders();
  const cart = await getCart(user.id);
  if (cart.lines.length === 0 || cart.hasIssues) redirect("/cart");

  const [addresses, settings] = await Promise.all([
    db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { id: "asc" }] }),
    getSettings(),
  ]);
  const price = priceOrder(cart.subtotal, settings);

  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl font-bold md:text-3xl">Checkout</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div>
          {!settings.paymentsEnabled && <p role="alert" className="mb-6 border border-ink bg-paper p-4 text-sm">Orders are paused right now. Please try again later.</p>}
          <CheckoutForm addresses={addresses} totalLabel={formatPrice(price.total)} disabled={!settings.paymentsEnabled} />
        </div>
        <aside className="h-fit border border-ink/20 bg-paper p-6 text-sm lg:sticky lg:top-28">
          <h2 className="text-base font-bold">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {cart.lines.map((l) => <li key={l.id} className="flex justify-between gap-3"><span>{l.name}<br /><span className="text-ink/60">{l.color} · {l.size} × {l.quantity}</span></span><span>{formatPrice(l.lineTotal)}</span></li>)}
          </ul>
          <dl className="mt-5 space-y-1 border-t border-ink/20 pt-4">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(price.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Shipping</dt><dd>{price.shipping === 0 ? "Free" : formatPrice(price.shipping)}</dd></div>
            {settings.taxPercent > 0 && <div className="flex justify-between"><dt>Tax ({settings.taxPercent}%)</dt><dd>{formatPrice(price.tax)}</dd></div>}
            <div className="flex justify-between border-t border-ink/20 pt-2 text-base font-bold"><dt>Total</dt><dd>{formatPrice(price.total)}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
