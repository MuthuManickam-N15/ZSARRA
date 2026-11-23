import type { Metadata } from "next";
import CatalogPage from "@/components/CatalogPage";
import type { CatalogParams } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Men" };

export default function Page({ searchParams }: { searchParams: CatalogParams }) {
  return <CatalogPage title="Men" basePath="/men" params={searchParams} fixed={{ gender: "MEN" }} />;
}
