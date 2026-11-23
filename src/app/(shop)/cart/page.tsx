import type { Metadata } from "next";
import Link from "next/link";
import { removeFromCart, updateCartQuantity } from "@/app/actions/shop";
import { getCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { img } from "@/lib/img";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your cart" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const user = await requireUser("/cart");
  const cart = await getCart(user.id);

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold md:text-3xl">Your cart {cart.count > 0 && <span className="text-base font-normal text-ink/60">({cart.count} {cart.count === 1 ? "item" : "items"})</span>}</h1>
      {cart.lines.length === 0 ? (
        <div className="mt-6 border border-ink/15 bg-white p-12 text-center">
          <p>Your cart is empty.</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/women" className="btn-primary">Shop women</Link>
            <Link href="/men" className="btn-outline">Shop men</Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem] lg:gap-10">
          <ul className="space-y-3">
            {cart.lines.map((l) => (
              <li key={l.id} className="flex gap-4 border border-ink/10 bg-white p-3 sm:p-4">
                <div className="h-28 w-[5.25rem] shrink-0 overflow-hidden bg-ivory/50 sm:h-36 sm:w-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.image && <img src={img(l.image, 300)} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col text-sm">
                  <Link href={`/products/${l.slug}`} className="truncate font-bold hover:text-bronze">{l.name}</Link>
                  <p className="text-ink/60">{l.color} · Size {l.size}</p>
                  {l.issue && <p role="alert" className="mt-2 inline-block self-start bg-ink px-2 py-1 text-xs font-semibold text-white">{l.issue}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {l.maxQty > 0 && (
                      <form action={updateCartQuantity.bind(null, l.id)} className="flex items-center gap-2">
                        <label htmlFor={`q-${l.id}`} className="sr-only">Quantity</label>
                        <select id={`q-${l.id}`} name="quantity" defaultValue={Math.min(l.quantity, l.maxQty)} className="field w-20 py-1.5">
                          {Array.from({ length: l.maxQty }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
                        </select>
                        <button className="font-bold text-bronze hover:underline">Update</button>
                      </form>
                    )}
                    <form action={removeFromCart.bind(null, l.id)}><button aria-label={`Remove ${l.name} (${l.color}, ${l.size})`} className="font-bold text-ink/60 hover:text-ink hover:underline">Remove</button></form>
                  </div>
                  <p className="mt-auto pt-2 font-bold">{l.issue ? formatPrice(l.unitPrice) : formatPrice(l.lineTotal)}{l.quantity > 1 && !l.issue && <span className="ml-2 text-xs font-normal text-ink/55">({l.quantity} × {formatPrice(l.unitPrice)})</span>}</p>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit border border-ink/10 bg-white p-5 text-sm lg:sticky lg:top-28">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink/60">Price details</h2>
            <p className="mt-4 flex justify-between"><span>Subtotal ({cart.count} items)</span><span className="font-bold">{formatPrice(cart.subtotal)}</span></p>
            <p className="mt-2 text-ink/60">Shipping and tax are calculated at checkout.</p>
            {cart.hasIssues && <p role="alert" className="mt-4 border border-ink p-3">Update or remove the flagged items to continue.</p>}
            {cart.hasIssues
              ? <button className="btn-primary mt-5 w-full py-3.5" disabled>Checkout</button>
              : <Link href="/checkout" className="btn-primary mt-5 w-full py-3.5">Checkout</Link>}
          </aside>
        </div>
      )}
    </div>
  );
}
