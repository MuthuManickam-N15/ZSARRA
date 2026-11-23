"use client";
import { useState } from "react";
import ActionForm, { Field } from "./ActionForm";
import { saveProduct } from "@/app/actions/admin";
import { getUploadSignature } from "@/app/actions/uploads";
import { uploadDirect } from "@/lib/direct-upload";
import type { FormState } from "@/app/actions/auth";

/** Pictures go straight to Cloudinary (when configured) and only their links are sent to the server. */
async function saveWithDirectUploads(prev: FormState, fd: FormData): Promise<FormState> {
  const files = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 0) {
    const sig = await getUploadSignature();
    if (sig) {
      try {
        const urls: string[] = [];
        for (const f of files) urls.push(await uploadDirect(f, sig));
        fd.delete("images");
        fd.set("imageUrls", JSON.stringify(urls));
      } catch (e) { return { error: e instanceof Error ? e.message : "Picture upload failed. Nothing was saved." }; }
    }
  }
  return saveProduct(prev, fd);
}

type Variant = { size: string; color: string; colorHex: string; stock: number };
type Initial = {
  id?: string; name: string; sku: string; description: string; gender: string; categoryId: string;
  price: string; salePrice: string; published: boolean; featured: boolean; variants: Variant[];
  images: { id: string; url: string }[];
};

export default function ProductForm({ categories, initial }: { categories: { id: string; name: string; gender: string }[]; initial: Initial }) {
  const [variants, setVariants] = useState<Variant[]>(initial.variants);
  const set = (i: number, patch: Partial<Variant>) => setVariants((vs) => vs.map((v, n) => (n === i ? { ...v, ...patch } : v)));

  return (
    <ActionForm action={saveWithDirectUploads} submit={initial.id ? "Save changes" : "Create product"} className="max-w-3xl space-y-8">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="variants" value={JSON.stringify(variants)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={initial.name} />
        <Field label="SKU" name="sku" defaultValue={initial.sku} />
        <label className="block text-sm">Collection
          <select name="gender" defaultValue={initial.gender} className="field mt-1"><option value="WOMEN">Women</option><option value="MEN">Men</option><option value="UNISEX">Unisex</option></select>
        </label>
        <label className="block text-sm">Category
          <select name="categoryId" defaultValue={initial.categoryId} required className="field mt-1">
            <option value="" disabled>Choose a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.gender.toLowerCase()})</option>)}
          </select>
        </label>
        <Field label="Price (₹)" name="price" defaultValue={initial.price} />
        <Field label="Sale price (₹)" name="salePrice" required={false} defaultValue={initial.salePrice} />
      </div>

      <label className="block text-sm">Description
        <textarea name="description" required rows={5} defaultValue={initial.description} className="field mt-1" />
      </label>

      <fieldset className="space-y-3">
        <legend className="text-base font-bold">Sizes, colors and stock</legend>
        {variants.map((v, i) => (
          <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_4rem_6rem_auto]">
            <label className="text-xs">Size<input value={v.size} onChange={(e) => set(i, { size: e.target.value })} className="field mt-1" /></label>
            <label className="text-xs">Color name<input value={v.color} onChange={(e) => set(i, { color: e.target.value })} className="field mt-1" /></label>
            <label className="text-xs">Swatch<input type="color" value={v.colorHex} onChange={(e) => set(i, { colorHex: e.target.value })} className="mt-1 h-[46px] w-full border border-ink/30 bg-paper p-1" /></label>
            <label className="text-xs">Stock<input type="number" min={0} value={v.stock} onChange={(e) => set(i, { stock: Number(e.target.value) })} className="field mt-1" /></label>
            <button type="button" onClick={() => setVariants((vs) => vs.filter((_, n) => n !== i))} className="pb-3 text-sm underline hover:text-bronze">Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => setVariants((vs) => [...vs, { size: "", color: vs[vs.length - 1]?.color ?? "", colorHex: vs[vs.length - 1]?.colorHex ?? "#000000", stock: 0 }])} className="btn-outline">Add variant</button>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-bold">Images</legend>
        {initial.images.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {initial.images.map((im) => (
              <li key={im.id} className="w-24 text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt="" className="aspect-[3/4] w-full object-cover" />
                <label className="mt-1 flex items-center gap-1"><input type="checkbox" name="removeImage" value={im.id} /> Remove</label>
              </li>
            ))}
          </ul>
        )}
        <label className="block text-sm">Add images (JPG, PNG or WebP, up to 5 MB each, 8 per product). The first image is the cover.
          <input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple className="field mt-1" />
        </label>
      </fieldset>

      <div className="flex gap-8 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={initial.published} /> Published on the storefront</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={initial.featured} /> Featured on the home page</label>
      </div>
    </ActionForm>
  );
}
