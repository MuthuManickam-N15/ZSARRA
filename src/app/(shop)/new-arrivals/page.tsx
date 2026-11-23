import type { Metadata } from "next";
import CatalogPage from "@/components/CatalogPage";
import type { CatalogParams } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New arrivals" };

export default function Page({ searchParams }: { searchParams: CatalogParams }) {
  return <CatalogPage title="New arrivals" basePath="/new-arrivals" params={searchParams} fixed={{}} />;
}
