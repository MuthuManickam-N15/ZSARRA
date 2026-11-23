"use client";
import ActionForm, { Field } from "./ActionForm";
import { createBanner } from "@/app/actions/admin2";
import { getUploadSignature } from "@/app/actions/uploads";
import { uploadDirect } from "@/lib/direct-upload";
import type { FormState } from "@/app/actions/auth";

async function addBanner(prev: FormState, fd: FormData): Promise<FormState> {
  const file = fd.get("image");
  if (file instanceof File && file.size > 0) {
    const sig = await getUploadSignature();
    if (sig) {
      try { fd.set("imageUrl", await uploadDirect(file, sig)); fd.delete("image"); }
      catch (e) { return { error: e instanceof Error ? e.message : "Picture upload failed." }; }
    }
  }
  return createBanner(prev, fd);
}

export default function BannerForm() {
  return (
    <ActionForm action={addBanner} submit="Add banner" className="grid max-w-xl gap-4 sm:grid-cols-2">
      <Field label="Title" name="title" />
      <Field label="Subtitle" name="subtitle" required={false} />
      <Field label="Link (page on this site)" name="href" required={false} hint="For example /sale. Leave empty for the home page" />
      <label className="block text-sm">Image<input type="file" name="image" accept="image/jpeg,image/png,image/webp" required className="field mt-1" /></label>
    </ActionForm>
  );
}
