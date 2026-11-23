import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { img, sortSizes } from "@/lib/img";

type Props = {
  product: { slug: string; name: string; price: number; salePrice: number | null; images: { url: string; alt: string }[]; variants: { stock: number; size?: string }[]; rating?: { avg: number; count: number } | null };
};

export default function ProductCard({ product: p }: Props) {
  const soldOut = p.variants.every((v) => v.stock <= 0);
  const pct = p.salePrice ? Math.round((1 - p.salePrice / p.price) * 100) : 0;
  const sizes = sortSizes(Array.from(new Set(p.variants.filter((v) => v.stock > 0 && v.size).map((v) => v.size as string))));
  return (
    <Link href={`/products/${p.slug}`} className="group block bg-white transition-shadow duration-300 hover:shadow-pop">
      <div className="relative aspect-[3/4] overflow-hidden bg-ivory/50">
        {p.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img(p.images[0].url, 600)} alt={p.images[0].alt || p.name} loading="lazy" className="h-full w-full animate-[fade_0.5s_ease_both] object-cover" />
        ) : (
          <span aria-hidden className="flex h-full w-full items-center justify-center text-7xl font-light text-ink/10">{p.name[0]}</span>
        )}
        {p.rating && p.rating.count > 0 && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 bg-white/95 px-1.5 py-0.5 text-[11px] font-bold shadow-card">
            {p.rating.avg.toFixed(1)}<span aria-hidden className="text-bronze">★</span><span className="font-normal text-ink/55">| {p.rating.count}</span>
          </span>
        )}
        {soldOut && <span className="absolute left-0 top-0 bg-ink px-2.5 py-1 text-[11px] font-bold text-white">Sold out</span>}
        {sizes.length > 0 && !soldOut && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 translate-y-full bg-white/95 px-2 py-2 text-center text-xs font-semibold text-ink/80 transition-transform duration-300 group-hover:translate-y-0">Sizes: {sizes.join(", ")}</span>
        )}
      </div>
      <div className="px-1 pb-3 pt-2.5 sm:px-2">
        <p className="truncate text-sm font-bold">{p.name}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
          {p.salePrice ? (<><span className="font-bold">{formatPrice(p.salePrice)}</span><s className="text-xs text-ink/50">{formatPrice(p.price)}</s><span className="text-xs font-semibold text-bronze">({pct}% OFF)</span></>) : <span className="font-bold">{formatPrice(p.price)}</span>}
        </p>
      </div>
    </Link>
  );
}
