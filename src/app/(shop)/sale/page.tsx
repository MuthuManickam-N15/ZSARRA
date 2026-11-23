import type { Metadata } from "next";
import CatalogPage from "@/components/CatalogPage";
import type { CatalogParams } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sale" };

export default function Page({ searchParams }: { searchParams: CatalogParams }) {
  return <CatalogPage title="Sale" basePath="/sale" params={searchParams} fixed={{ saleOnly: true }} />;
}
