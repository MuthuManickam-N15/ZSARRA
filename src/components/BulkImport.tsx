"use client";
import { useState } from "react";
import { attachImageLinks, findMissingSkus, importProductsCsv, uploadProductImages } from "@/app/actions/import";
import { getUploadSignature } from "@/app/actions/uploads";
import { DirectUploadError, uploadDirect } from "@/lib/direct-upload";
import { toCsv } from "@/lib/csv";
import { parseImageReport } from "@/lib/image-report";
import { MAX_ROWS, parseImageName } from "@/lib/import-parse";
import { readTable } from "@/lib/read-table";

type RowErr = { line: number; sku: string; message: string };
type CsvState = { total: number; done: number; created: number; updated: number; errors: RowErr[]; fatal?: string; finished: boolean };
type ImgState = { total: number; done: number; saved: number; errors: { file: string; message: string }[]; finished: boolean };

export default function BulkImport() {
  const [productFile, setProductFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [prod, setProd] = useState<CsvState | null>(null);
  const [imgs, setImgs] = useState<ImgState | null>(null);
  const busy = (prod && !prod.finished) || (imgs && !imgs.finished);

  async function runProducts() {
    if (!productFile) return;
    const s: CsvState = { total: 0, done: 0, created: 0, updated: 0, errors: [], finished: false };
    let table: string[][];
    try { table = await readTable(productFile); }
    catch (e) { setProd({ ...s, fatal: e instanceof Error ? e.message : "Couldn't read that file.", finished: true }); return; }
    const header = table[0] ?? [], data = table.slice(1);
    s.total = data.length;
    if (data.length === 0) { setProd({ ...s, fatal: "The file has a header row but no products.", finished: true }); return; }
    if (data.length > MAX_ROWS) { setProd({ ...s, fatal: `Too many rows. Split the file into parts of up to ${MAX_ROWS}.`, finished: true }); return; }
    setProd({ ...s });
    for (let i = 0; i < data.length; i += 25) { // 25 rows per request: a big file never hits a server time limit
      const fd = new FormData();
      fd.set("csv", toCsv([header, ...data.slice(i, i + 25)]));
      fd.set("lineOffset", String(i));
      try {
        const r = await importProductsCsv(fd);
        s.created += r.created; s.updated += r.updated; s.errors.push(...r.errors);
        if (r.fatal) { s.fatal = r.fatal; break; }
      } catch { s.fatal = "The server didn't answer. Run the import again (it's safe to repeat)."; break; }
      s.done = Math.min(i + 25, data.length);
      setProd({ ...s });
    }
    setProd({ ...s, finished: true });
  }

  async function runImages() {
    const s: ImgState = { total: 0, done: 0, saved: 0, errors: [], finished: false };
    type Task = { file: File; sku?: string; position?: number };
    const tasks: Task[] = [];
    const links: { sku: string; url: string; position: number }[] = [];

    if (reportFile) {
      try {
        const { entries, errors } = parseImageReport(await readTable(reportFile));
        errors.forEach((e) => s.errors.push({ file: `Report row ${e.line}`, message: e.message }));
        const byName = new Map(imageFiles.map((f) => [f.name.toLowerCase(), f]));
        const used = new Set<string>();
        for (const e of entries) {
          if (e.url) { links.push({ sku: e.sku, url: e.url, position: e.position }); continue; }
          const f = byName.get(e.file!.toLowerCase());
          if (!f) { s.errors.push({ file: e.file!, message: "Listed in the report but not among the selected pictures" }); continue; }
          used.add(f.name.toLowerCase());
          tasks.push({ file: f, sku: e.sku, position: e.position });
        }
        imageFiles.filter((f) => !used.has(f.name.toLowerCase())).forEach((f) => s.errors.push({ file: f.name, message: "Selected but not listed in the report, so it was skipped" }));
      } catch (e) {
        setImgs({ ...s, errors: [{ file: "Image report", message: e instanceof Error ? e.message : "Couldn't read the report." }], finished: true });
        return;
      }
    } else imageFiles.forEach((file) => tasks.push({ file }));

    s.total = tasks.length + links.length;
    setImgs({ ...s });

    for (let i = 0; i < links.length; i += 50) {
      const chunk = links.slice(i, i + 50);
      const fd = new FormData();
      fd.set("items", JSON.stringify(chunk));
      try { const r = await attachImageLinks(fd); s.saved += r.saved; s.errors.push(...r.errors); }
      catch { chunk.forEach((l) => s.errors.push({ file: l.url, message: "Network error. Run it again." })); }
      s.done += chunk.length; setImgs({ ...s });
    }

    // On the live site pictures go straight from this browser to Cloudinary (the server can't accept big requests); only links are sent to the server.
    const sig0 = await getUploadSignature().catch(() => null);
    if (sig0) {
      const todo: { file: File; sku: string; position: number }[] = [];
      for (const t of tasks) {
        const target = t.sku ? { sku: t.sku, index: t.position ?? 1 } : parseImageName(t.file.name);
        if (!target) { s.errors.push({ file: t.file.name, message: "Name the file like SKU.jpg or SKU_2.jpg, or list it in an image report" }); s.done++; continue; }
        todo.push({ file: t.file, sku: target.sku, position: target.index });
      }
      const missing = new Set(await findMissingSkus(todo.map((t) => t.sku)).catch(() => [] as string[]));
      const ready = todo.filter((t) => {
        if (!missing.has(t.sku)) return true;
        s.errors.push({ file: t.file.name, message: `No product with SKU ${t.sku}. Import the products first.` }); s.done++;
        return false;
      });
      setImgs({ ...s });
      for (let i = 0; i < ready.length; i += 20) { // a fresh signature every 20 pictures
        const chunk = ready.slice(i, i + 20);
        const sig = (await getUploadSignature().catch(() => null)) ?? sig0;
        const saved: { sku: string; url: string; position: number }[] = [];
        let cursor = 0;
        await Promise.all(Array.from({ length: 4 }, async () => { // four uploads at a time
          while (cursor < chunk.length) {
            const t = chunk[cursor++];
            try { saved.push({ sku: t.sku, position: t.position, url: await uploadDirect(t.file, sig) }); }
            catch (e) { s.errors.push({ file: t.file.name, message: e instanceof DirectUploadError ? e.message : "Upload failed. Try this file again." }); }
            s.done++; setImgs({ ...s });
          }
        }));
        for (let j = 0; j < saved.length; j += 25) {
          const fd = new FormData();
          fd.set("items", JSON.stringify(saved.slice(j, j + 25)));
          try { const r = await attachImageLinks(fd); s.saved += r.saved; s.errors.push(...r.errors); }
          catch { saved.slice(j, j + 25).forEach((x) => s.errors.push({ file: x.url, message: "Uploaded, but saving the link failed. Run the upload again." })); }
        }
        setImgs({ ...s });
      }
      setImgs({ ...s, finished: true });
      return;
    }

    const batches: Task[][] = [];
    for (let i = 0; i < tasks.length; i += 4) batches.push(tasks.slice(i, i + 4)); // 4 per request keeps each upload under the size limit
    let next = 0;
    async function worker() {
      while (next < batches.length) {
        const batch = batches[next++];
        const fd = new FormData();
        batch.forEach((t) => fd.append("images", t.file));
        if (reportFile) fd.set("meta", JSON.stringify(batch.map((t) => ({ file: t.file.name, sku: t.sku, position: t.position }))));
        try { const r = await uploadProductImages(fd); s.saved += r.saved; s.errors.push(...r.errors); }
        catch { batch.forEach((t) => s.errors.push({ file: t.file.name, message: "Network error. Upload this file again." })); }
        s.done += batch.length; setImgs({ ...s });
      }
    }
    await Promise.all([worker(), worker()]); // two uploads at a time
    setImgs({ ...s, finished: true });
  }

  const box = "border border-ink/15 bg-white p-5";
  const list = "mt-2 max-h-48 overflow-auto border border-ink/15 p-3 text-xs";
  return (
    <div className="space-y-6">
      <section className={box} aria-labelledby="step1">
        <h2 id="step1" className="text-base font-bold">Step 1. Product details (Excel or CSV)</h2>
        <p className="mt-1 text-sm text-ink/70">One row per product. Existing SKUs are updated. Large files are processed in batches, and rows with problems are listed while the good rows are still saved.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm font-semibold">Product file (Excel or CSV)<input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setProductFile(e.target.files?.[0] ?? null)} className="field mt-1" /></label>
          <button className="btn-primary" disabled={!productFile || !!busy} onClick={runProducts}>Import products</button>
        </div>
        {prod && (
          <div className="mt-4 text-sm" aria-live="polite">
            <progress className="w-full" value={prod.done} max={Math.max(prod.total, 1)} />
            <p className="mt-1">{prod.finished ? "Finished. " : "Working… "}{prod.done} of {prod.total} rows processed: <strong>{prod.created} created, {prod.updated} updated</strong>, {prod.errors.length} with problems.</p>
            {prod.fatal && <p role="alert" className="mt-2 border border-ink p-3">{prod.fatal}</p>}
            {prod.errors.length > 0 && (
              <ul className={list}>
                {prod.errors.slice(0, 100).map((e, i) => <li key={i}>Row {e.line}{e.sku ? ` (${e.sku})` : ""}: {e.message}</li>)}
                {prod.errors.length > 100 && <li>…and {prod.errors.length - 100} more.</li>}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className={box} aria-labelledby="step2">
        <h2 id="step2" className="text-base font-bold">Step 2. Product pictures</h2>
        <p className="mt-1 text-sm text-ink/70">Select all the pictures at once. Either name each file after its SKU (<code>ZM-201.jpg</code>, <code>ZM-201_2.jpg</code>), or add an <strong>image report</strong> (Excel or CSV) that says which file belongs to which SKU, so the pictures can have any names. Links to pictures already online can go in the report too.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Product image files<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))} className="field mt-1" /></label>
          <label className="block text-sm font-semibold">Image report (optional, Excel or CSV)<input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setReportFile(e.target.files?.[0] ?? null)} className="field mt-1" /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={(imageFiles.length === 0 && !reportFile) || !!busy} onClick={runImages}>Upload images</button>
          {imageFiles.length > 0 && !imgs && <span className="text-sm text-ink/60">{imageFiles.length} pictures selected{reportFile ? " with an image report" : ""}.</span>}
        </div>
        {imgs && (
          <div className="mt-4 text-sm" aria-live="polite">
            <progress className="w-full" value={imgs.done} max={Math.max(imgs.total, 1)} />
            <p className="mt-1">{imgs.finished ? "Finished. " : "Uploading… "}{imgs.done} of {imgs.total} processed: <strong>{imgs.saved} {imgs.saved === 1 ? "image" : "images"} saved</strong>, {imgs.errors.length} with problems.</p>
            {imgs.errors.length > 0 && (
              <ul className={list}>
                {imgs.errors.slice(0, 100).map((e, i) => <li key={i}>{e.file}: {e.message}</li>)}
                {imgs.errors.length > 100 && <li>…and {imgs.errors.length - 100} more.</li>}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
