import Link from "next/link";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { img } from "@/lib/img";
import { getSettings } from "@/lib/settings";
import ProductCard from "@/components/ProductCard";
import Stars from "@/components/Stars";
import { attachRatings, displayName } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [products, banners, categories, settings, latest] = await Promise.all([
    db.product.findMany({
      where: { published: true, featured: true },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { images: { orderBy: { position: "asc" }, take: 1 }, variants: { select: { stock: true, size: true } } },
    }),
    db.banner.findMany({ where: { active: true }, orderBy: { position: "asc" }, take: 3 }),
    db.category.findMany({
      orderBy: { name: "asc" }, take: 12,
      include: { products: { where: { published: true }, take: 1, orderBy: { createdAt: "desc" }, include: { images: { orderBy: { position: "asc" }, take: 1 } } } },
    }),
    getSettings(),
    db.review.findMany({
      where: { hidden: false, rating: { gte: 4 }, product: { published: true } }, orderBy: { createdAt: "desc" }, take: 3,
      include: { user: { select: { name: true } }, product: { select: { name: true, slug: true } } },
    }),
  ]);
  const featured = await attachRatings(products);

  const heroImages = products.flatMap((p) => p.images.slice(0, 1)).slice(0, 2);
  const tiles = categories.filter((c) => c.products.length > 0).map((c) => ({
    id: c.id, name: c.name, gender: c.gender,
    href: `${c.gender === "MEN" ? "/men" : c.gender === "WOMEN" ? "/women" : "/new-arrivals"}?category=${c.slug}`,
    image: c.products[0].images[0]?.url ?? null,
  }));
  const perks = [
    settings.freeShippingThreshold > 0 ? `Free shipping above ${formatPrice(settings.freeShippingThreshold)}` : "Delivered to your door",
    "Easy 14-day returns",
    "Pay easily with any UPI app",
  ];

  return (
    <>
      <section className="bg-ivory">
        <div className="container-page grid items-center gap-8 py-10 md:grid-cols-[1.1fr_1fr] md:gap-12 md:py-14">
          <div>
            <p className="eyebrow">Autumn / Winter 2026</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">Clothing made to be worn daily.</h1>
            <p className="mt-4 max-w-md text-base text-ink/70">Shirts, dresses, tailoring and knitwear for men and women.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/women" className="btn-primary px-8">Shop women</Link>
              <Link href="/men" className="btn-outline bg-white px-8">Shop men</Link>
            </div>
          </div>
          {heroImages.length > 0 ? (
            <div aria-hidden className="grid grid-cols-2 gap-3">
              {heroImages.map((im, i) => (
                <div key={im.url} className={`aspect-[3/4] overflow-hidden bg-white ${i === 1 ? "mt-6" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(im.url, 700)} alt="" className="h-full w-full animate-[fade_0.6s_ease_both] object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div aria-hidden className="flex aspect-[5/3] items-end bg-bronze p-6"><span className="text-sm font-semibold text-white">New season essentials</span></div>
          )}
        </div>
      </section>

      <section aria-label="Store benefits" className="border-b border-ink/10">
        <ul className="container-page grid gap-1.5 py-4 text-sm font-semibold sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-ink/10">
          {perks.map((t) => <li key={t} className="flex items-center gap-2 sm:justify-center"><span aria-hidden className="text-bronze">✓</span>{t}</li>)}
        </ul>
      </section>

      {tiles.length > 0 && (
        <section aria-label="Shop by category" className="container-page mt-12">
          <h2 className="section-title mb-6">Shop by category</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {tiles.map((t) => (
              <li key={t.id}>
                <Link href={t.href} className="group block overflow-hidden bg-white shadow-card transition-shadow duration-300 hover:shadow-pop">
                  <div className="aspect-[4/5] overflow-hidden bg-ivory/60">
                    {t.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={img(t.image, 400)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      : <span aria-hidden className="flex h-full items-center justify-center text-6xl font-light text-ink/15">{t.name[0]}</span>}
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="truncate text-sm font-bold">{t.name}</p>
                    <p className="text-xs text-ink/55">{t.gender === "MEN" ? "Men" : t.gender === "WOMEN" ? "Women" : "Unisex"}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {banners.length > 0 && (
        <section aria-label="Promotions" className="container-page mt-12 grid gap-3 md:grid-cols-3">
          {banners.map((b) => (
            <Link key={b.id} href={b.href} className="group relative block aspect-[4/5] overflow-hidden bg-ivory/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(b.imageUrl, 900)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-5 text-white">
                <span className="block text-xl font-bold">{b.title}</span>
                {b.subtitle && <span className="block text-sm text-ivory/90">{b.subtitle}</span>}
              </span>
            </Link>
          ))}
        </section>
      )}

      <section className="container-page mt-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="section-title">Featured</h2>
          <Link href="/new-arrivals" className="text-sm font-bold text-bronze hover:underline">View all</Link>
        </div>
        {products.length === 0 ? (
          <p className="border border-ink/15 bg-white p-10 text-center">No featured products yet. Mark products as featured in the admin dashboard.</p>
        ) : (
          <ul className="stagger grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-4 xl:grid-cols-5">
            {featured.map((p, i) => <li key={p.id} style={{ "--i": Math.min(i, 8) } as React.CSSProperties}><ProductCard product={p} /></li>)}
          </ul>
        )}
      </section>

      {latest.length > 0 && (
        <section aria-label="What customers say" className="container-page mt-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="section-title">What customers say</h2>
            <Link href="/reviews" className="text-sm font-bold text-bronze hover:underline">Read all reviews</Link>
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            {latest.map((r) => (
              <li key={r.id} className="flex flex-col border border-ink/10 bg-white p-5">
                <Stars value={r.rating} />
                {r.title && <p className="mt-2 font-bold">{r.title}</p>}
                <p className="mt-2 line-clamp-4 flex-1 text-sm text-ink/80">{r.body}</p>
                <p className="mt-3 text-xs text-ink/55">{displayName(r.user.name)} on <Link href={`/products/${r.product.slug}`} className="font-bold hover:text-bronze">{r.product.name}</Link></p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
