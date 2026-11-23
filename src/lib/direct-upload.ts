import type { UploadSignature } from "@/app/actions/uploads";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export class DirectUploadError extends Error {}

/** Checks the first bytes of the file, not its name: JPG, PNG or WebP only. */
export async function looksLikeImage(file: Blob): Promise<boolean> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v);
  const webp = String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  return jpg || png || webp;
}

/** Sends one picture straight from the browser to Cloudinary and returns its public https link. */
export async function uploadDirect(file: File, sig: UploadSignature): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new DirectUploadError(`${file.name} is larger than 5 MB`);
  if (!(await looksLikeImage(file))) throw new DirectUploadError(`${file.name} must be a JPG, PNG or WebP image`);
  const body = new FormData();
  body.set("file", file);
  body.set("api_key", sig.apiKey);
  body.set("timestamp", sig.timestamp);
  body.set("signature", sig.signature);
  body.set("folder", sig.folder);
  body.set("allowed_formats", sig.allowedFormats);
  let res: Response;
  try { res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: "POST", body }); }
  catch { throw new DirectUploadError(`Couldn't reach the image service for ${file.name}. Check your connection and try again.`); }
  const json = (await res.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || !json.secure_url) throw new DirectUploadError(`The image service rejected ${file.name}: ${json.error?.message ?? res.status}`);
  return json.secure_url;
}
