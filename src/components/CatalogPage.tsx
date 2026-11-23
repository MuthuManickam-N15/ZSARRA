import Link from "next/link";
import { Gender } from "@prisma/client";
import { CatalogParams, getFacets, getProducts } from "@/lib/catalog";
import { sortSizes } from "@/lib/img";
import FilterPanel from "./FilterPanel";
import ProductCard from "./ProductCard";

const group = "border-b border-ink/10 pb-5";
const gTitle = "mb-3 text-[13px] font-bold uppercase tracking-[0.08em]";
const radioRow = "flex cursor-pointer items-center gap-2.5 py-1 text-sm";
const chip = "flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full border border-ink/25 px-3 text-xs font-semibold transition-colors hover:border-ink peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-bronze";

export default async function CatalogPage({ title, basePath, params, fixed }: {
  title: string; basePath: string; params: CatalogParams; fixed: { gender?: Gender; saleOnly?: boolean };
}) {
  const query = { ...params, ...fixed };
  const [{ items, total, page, pages }, facets] = await Promise.all([getProducts(query), getFacets(fixed.gender)]);
  const sizes = sortSizes(facets.sizes);

  const pageHref = (n: number) => {
    const sp = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== "page") as [string, string][]);
    sp.set("page", String(n));
    return `${basePath}?${sp}`;
  };

  return (
    <div className="container-page py-6 md:py-8">
      <nav aria-label="Breadcrumb" className="text-xs text-ink/60"><Link href="/" className="hover:text-ink">Home</Link> <span aria-hidden>/</span> <span className="font-semibold text-ink">{title}</span></nav>

      <form method="get" action={basePath}>
        {params.q && <input type="hidden" name="q" value={params.q} />}
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-b border-ink/10 pb-4">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
            <p className="text-sm text-ink/60" aria-live="polite">{total} {total === 1 ? "product" : "products"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="f-sort" className="text-sm font-semibold">Sort by</label>
            <select id="f-sort" name="sort" defaultValue={params.sort ?? ""} className="field w-auto py-2">
              <option value="">Newest</option><option value="popular">Popular</option>
              <option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option>
            </select>
            <button className="btn-primary py-2">Apply</button>
            <Link href={basePath} className="btn-outline py-2">Clear</Link>
          </div>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[14.5rem_1fr] lg:gap-10">
          <FilterPanel>
            <div className={group}>
              <p className={gTitle}>Category</p>
              <label className={radioRow}><input type="radio" name="category" value="" defaultChecked={!params.category} className="accent-ink" /> All</label>
              {facets.categories.map((c) => <label key={c.id} className={radioRow}><input type="radio" name="category" value={c.slug} defaultChecked={params.category === c.slug} className="accent-ink" /> {c.name}</label>)}
            </div>
            <div className={group}>
              <p className={gTitle}>Size</p>
              <div className="flex flex-wrap gap-2">
                <label><input type="radio" name="size" value="" defaultChecked={!params.size} className="peer sr-only" /><span className={chip}>All</span></label>
                {sizes.map((s) => <label key={s}><input type="radio" name="size" value={s} defaultChecked={params.size === s} className="peer sr-only" /><span className={chip}>{s}</span></label>)}
              </div>
            </div>
            <div className={group}>
              <p className={gTitle}>Color</p>
              <div className="flex flex-wrap gap-2">
                <label><input type="radio" name="color" value="" defaultChecked={!params.color} className="peer sr-only" /><span className={chip}>All</span></label>
                {facets.colors.map((c) => <label key={c}><input type="radio" name="color" value={c} defaultChecked={params.color === c} className="peer sr-only" /><span className={chip}>{c}</span></label>)}
              </div>
            </div>
            <div className={group}>
              <p className={gTitle}>Price (₹)</p>
              <div className="grid grid-cols-2 gap-2">
                <div><label htmlFor="f-min" className="sr-only">Minimum price</label><input id="f-min" name="min" inputMode="numeric" placeholder="Min" defaultValue={params.min} className="field" /></div>
                <div><label htmlFor="f-max" className="sr-only">Maximum price</label><input id="f-max" name="max" inputMode="numeric" placeholder="Max" defaultValue={params.max} className="field" /></div>
              </div>
            </div>
            <label className={radioRow}><input type="checkbox" name="inStock" value="1" defaultChecked={params.inStock === "1"} className="accent-ink" /> In stock only</label>
          </FilterPanel>

          <div>
            {items.length === 0 ? (
              <div className="border border-ink/15 bg-white p-10 text-center">
                <p>No products match these filters.</p>
                <Link href={basePath} className="btn-outline mt-4">Clear filters</Link>
              </div>
            ) : (
              <ul className="stagger grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
                {items.map((p, i) => <li key={p.id} style={{ "--i": Math.min(i, 8) } as React.CSSProperties}><ProductCard product={p} /></li>)}
              </ul>
            )}
            {pages > 1 && (
              <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-8 text-sm font-semibold">
                {page > 1 && <Link href={pageHref(page - 1)} className="link-u">Previous</Link>}
                <span className="font-normal text-ink/60">Page {page} of {pages}</span>
                {page < pages && <Link href={pageHref(page + 1)} className="link-u">Next</Link>}
              </nav>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
