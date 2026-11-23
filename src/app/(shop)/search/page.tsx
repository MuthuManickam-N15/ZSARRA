import type { Metadata } from "next";
import CatalogPage from "@/components/CatalogPage";
import type { CatalogParams } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

export default function Page({ searchParams }: { searchParams: CatalogParams }) {
  const q = searchParams.q?.trim().slice(0, 100);
  return (
    <>
      <form action="/search" className="container-page flex gap-2 pt-10" role="search">
        <label htmlFor="q" className="sr-only">Search products</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by name, description or SKU" className="field" />
        <button className="btn-primary">Search</button>
      </form>
      <CatalogPage title={q ? `Results for “${q}”` : "All products"} basePath="/search" params={{ ...searchParams, q }} fixed={{}} />
    </>
  );
}
