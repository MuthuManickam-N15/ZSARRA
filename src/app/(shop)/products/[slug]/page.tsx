import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import { toggleWishlist } from "@/app/actions/shop";
import Gallery from "@/components/Gallery";
import ProductPicker from "@/components/ProductPicker";
import ProductCard from "@/components/ProductCard";
import ReviewsSection from "@/components/ReviewsSection";
import { attachRatings, getReviewSummary } from "@/lib/reviews";

export const dynamic = "force-dynamic";

const load = (slug: string) =>
  db.product.findFirst({
    where: { slug, published: true },
    include: { images: { orderBy: { position: "asc" } }, variants: { orderBy: { size: "asc" } }, category: true },
  });

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await load(params.slug);
  return p ? { title: p.name, description: p.description.slice(0, 150) } : {};
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const p = await load(params.slug);
  if (!p) notFound();
  const user = await getCurrentUser();
  const wishlisted = user ? !!(await db.wishlistItem.findUnique({ where: { userId_productId: { userId: user.id, productId: p.id } } })) : false;
  const [settings, rawRelated, summary] = await Promise.all([
    getSettings(),
    db.product.findMany({
      where: { published: true, categoryId: p.categoryId, id: { not: p.id } }, take: 5,
      include: { images: { orderBy: { position: "asc" }, take: 1 }, variants: { select: { stock: true, size: true } } },
    }),
    getReviewSummary({ productId: p.id }),
  ]);
  const related = await attachRatings(rawRelated);

  const pct = p.salePrice ? Math.round((1 - p.salePrice / p.price) * 100) : 0;
  const section = p.gender === "MEN" ? { href: "/men", label: "Men" } : p.gender === "WOMEN" ? { href: "/women", label: "Women" } : { href: "/new-arrivals", label: "New arrivals" };
  const heading = "mb-3 text-[13px] font-bold uppercase tracking-[0.08em]";

  return (
    <div className="container-page py-6 md:py-8">
      <nav aria-label="Breadcrumb" className="text-xs text-ink/60">
        <Link href="/" className="hover:text-ink">Home</Link> <span aria-hidden>/</span> <Link href={section.href} className="hover:text-ink">{section.label}</Link> <span aria-hidden>/</span> <span className="font-semibold text-ink">{p.category.name}</span>
      </nav>

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
        <Gallery images={p.images} name={p.name} />

        <div>
          <p className="text-sm font-semibold text-ink/60">{p.category.name}</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight md:text-3xl">{p.name}</h1>
          {summary.count > 0 && (
            <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm">
              <span className="border border-ink/15 bg-white px-2 py-0.5 font-bold">{summary.average.toFixed(1)} <span aria-hidden className="text-bronze">★</span></span>
              <span className="text-ink/60 hover:underline">{summary.count} {summary.count === 1 ? "rating" : "ratings"}</span>
            </a>
          )}

          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {p.salePrice ? (
              <><span className="text-2xl font-bold">{formatPrice(p.salePrice)}</span><span className="text-base text-ink/55">MRP <s>{formatPrice(p.price)}</s></span><span className="text-base font-bold text-bronze">({pct}% OFF)</span></>
            ) : <span className="text-2xl font-bold">{formatPrice(p.price)}</span>}
          </div>
          <p className="mt-1 text-xs font-bold text-bronze">inclusive of all taxes</p>

          <div className="mt-6 border-t border-ink/10 pt-6"><ProductPicker variants={p.variants} slug={p.slug} /></div>

          <form action={toggleWishlist} className="mt-3">
            <input type="hidden" name="productId" value={p.id} />
            <input type="hidden" name="next" value={`/products/${p.slug}`} />
            <button className="btn-outline w-full py-3.5 text-[15px]">{wishlisted ? "Remove from wishlist" : "Save to wishlist"}</button>
          </form>

          <section className="mt-8 border-t border-ink/10 pt-6" aria-label="Delivery and returns">
            <h2 className={heading}>Delivery &amp; returns</h2>
            <ul className="space-y-2 text-sm text-ink/80">
              <li className="flex gap-2"><span aria-hidden className="text-bronze">✓</span>{settings.freeShippingThreshold > 0 ? `Free shipping above ${formatPrice(settings.freeShippingThreshold)}` : "Delivered to your door"}</li>
              <li className="flex gap-2"><span aria-hidden className="text-bronze">✓</span>Easy 14-day returns on unworn items</li>
              <li className="flex gap-2"><span aria-hidden className="text-bronze">✓</span>Pay easily with any UPI app</li>
            </ul>
          </section>

          <section className="mt-8 border-t border-ink/10 pt-6" aria-label="Product details">
            <h2 className={heading}>Product details</h2>
            <p className="max-w-prose whitespace-pre-line leading-relaxed text-ink/80">{p.description}</p>
            <p className="mt-4 text-xs text-ink/50">Style code: {p.sku}</p>
          </section>
        </div>
      </div>

      <ReviewsSection product={{ id: p.id, slug: p.slug }} user={user} summary={summary} />

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="section-title mb-6">You may also like</h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-5">{related.map((r) => <li key={r.id}><ProductCard product={r} /></li>)}</ul>
        </section>
      )}
    </div>
  );
}
