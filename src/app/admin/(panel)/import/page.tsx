import type { Metadata } from "next";
import BulkImport from "@/components/BulkImport";

export const metadata: Metadata = { title: "Bulk import", robots: { index: false } };

const samples = [
  { href: "/samples/zsarra-products-sample.xlsx", title: "Products sample (Excel)", note: "Sheet 1 is the data. Sheet 2 explains every column." },
  { href: "/samples/zsarra-products-sample.csv", title: "Products sample (CSV)", note: "The same five products as plain text." },
  { href: "/samples/zsarra-image-report-sample.xlsx", title: "Image report sample (Excel)", note: "Matches each picture file to a SKU and a position." },
  { href: "/samples/zsarra-image-report-sample.csv", title: "Image report sample (CSV)", note: "The same report as plain text." },
  { href: "/samples/zsarra-sample-images.zip", title: "Sample pictures (ZIP)", note: "Five photos in both naming styles, ready to try." },
];

const productCols: [string, string, string][] = [
  ["sku", "Yes", "Your unique product code. Also used to match pictures."],
  ["name, description", "Yes", "Shown in the store. Description needs 10+ characters."],
  ["gender", "Yes", "men, women or unisex."],
  ["category", "Yes", "Created automatically if it doesn't exist."],
  ["price, sale_price", "price: Yes", "Rupees, numbers only. sale_price must be lower than price."],
  ["sizes", "Yes", "Separated with |, for example S|M|L|XL"],
  ["colors", "No", "Separated with |. Add a swatch with name:#hex. Empty means Black."],
  ["stock", "Yes", "10 for every size, or S:5|M:8|L:3 per size, or S/White:5 per size and color."],
  ["published, featured", "No", "yes or no. Published defaults to yes, featured to no."],
  ["image_urls", "No", "Optional picture links (https://) separated with |."],
];

export default function ImportPage() {
  const th = "border-b border-ink/15 px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.06em] text-ink/60";
  const td = "border-b border-ink/10 px-3 py-2 align-top";
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-bold md:text-2xl">Bulk import</h1>
      <p className="text-sm text-ink/70">Add or update hundreds of products at once. First import the product details from an Excel or CSV file, then upload the pictures.</p>

      <section aria-labelledby="samples" className="border border-bronze/40 bg-ivory/50 p-5">
        <h2 id="samples" className="text-base font-bold">Sample files</h2>
        <p className="mt-1 text-sm text-ink/70">Download a sample, delete the example rows, keep the header row, and add your own products. These samples match the pictures in the ZIP, so you can try the whole flow first.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {samples.map((s) => (
            <li key={s.href} className="flex flex-col border border-ink/15 bg-white p-3 text-sm">
              <span className="font-bold">{s.title}</span>
              <span className="mt-1 flex-1 text-xs text-ink/60">{s.note}</span>
              <a href={s.href} download className="btn-outline mt-3 py-2">Download</a>
            </li>
          ))}
        </ul>
      </section>

      <BulkImport />

      <section className="border border-ink/15 bg-white p-5" aria-labelledby="guide">
        <h2 id="guide" className="text-base font-bold">Format guide</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead><tr><th className={th}>Product column</th><th className={th}>Required</th><th className={th}>What to enter</th></tr></thead>
            <tbody>{productCols.map(([c, r, w]) => <tr key={c}><td className={`${td} font-mono text-xs`}>{c}</td><td className={td}>{r}</td><td className={td}>{w}</td></tr>)}</tbody>
          </table>
        </div>
        <h3 className="mt-6 text-sm font-bold">Pictures</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink/80">
          <li><strong>Without a report:</strong> name each file after its SKU. <code>ZM-201.jpg</code> is the cover picture, <code>ZM-201_2.jpg</code> the second, <code>ZM-201_3.jpg</code> the third.</li>
          <li><strong>With an image report</strong> (Excel or CSV): columns <code>image_file</code> (or <code>image_url</code>), <code>sku</code> and <code>position</code>. Pictures can then have any file names. Files that aren't listed are skipped and shown in the results.</li>
          <li>JPG, PNG or WebP, up to 5 MB each. Using a position again replaces that picture, so repeating a run never creates duplicates.</li>
          <li>Excel tips: save as <code>.xlsx</code> (not the old <code>.xls</code>), keep the header row, and only the first sheet is read.</li>
        </ul>
      </section>

      <section className="border border-ink/15 bg-white p-5 text-sm">
        <h2 className="text-base font-bold">Back up your catalogue</h2>
        <p className="mt-1 text-ink/70">Download every product as a CSV in the same format this page reads (opens in Excel). It includes prices, sizes, stock and picture links, so you can re-import it later. It doesn't include customers or orders: use <code>npm run db:backup</code> for a full backup.</p>
        <a href="/admin/export/products" download className="btn-outline mt-3">Download all products (CSV)</a>
      </section>
    </div>
  );
}
