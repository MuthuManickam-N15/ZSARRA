"use client";
import ActionForm from "./ActionForm";
import { saveQrImage } from "@/app/actions/admin2";
import { getUploadSignature } from "@/app/actions/uploads";
import { uploadDirect } from "@/lib/direct-upload";
import type { FormState } from "@/app/actions/auth";

async function saveQr(prev: FormState, fd: FormData): Promise<FormState> {
  const file = fd.get("image");
  if (file instanceof File && file.size > 0) {
    const sig = await getUploadSignature();
    if (sig) {
      try { fd.set("imageUrl", await uploadDirect(file, sig)); fd.delete("image"); }
      catch (e) { return { error: e instanceof Error ? e.message : "Picture upload failed." }; }
    }
  }
  return saveQrImage(prev, fd);
}

export default function QrForm() {
  return (
    <ActionForm action={saveQr} submit="Save QR code" className="space-y-3">
      <label className="block text-sm font-semibold">Your QR code image (PNG or JPG)
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required className="field mt-1 font-normal" />
      </label>
    </ActionForm>
  );
}
