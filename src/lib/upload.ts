import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Identify the file by its first bytes, not by the filename or browser-reported type. */
function sniff(b: Buffer): { ext: string; mime: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

export class UploadError extends Error {}

/** Returns a public URL. Cloudinary when configured; local public/uploads in development only. */
export async function saveImage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new UploadError(`${file.name} is larger than 5 MB`);
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type) throw new UploadError(`${file.name} must be a JPG, PNG or WebP image`);

  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (cloud && key && secret) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const folder = "zsarra";
    const signature = crypto.createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest("hex");
    const body = new FormData();
    body.set("file", new Blob([buf], { type: type.mime }), `upload.${type.ext}`);
    body.set("api_key", key); body.set("timestamp", timestamp); body.set("folder", folder); body.set("signature", signature);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body });
    const json = (await res.json()) as { secure_url?: string; error?: { message: string } };
    if (!res.ok || !json.secure_url) throw new UploadError(`Image storage rejected the upload: ${json.error?.message ?? res.status}`);
    return json.secure_url;
  }

  if (process.env.NODE_ENV === "production") throw new UploadError("Image storage isn't configured. Set the CLOUDINARY_* variables.");
  const name = `${crypto.randomBytes(12).toString("hex")}.${type.ext}`;
  await fs.mkdir(path.join(process.cwd(), "public", "uploads"), { recursive: true });
  await fs.writeFile(path.join(process.cwd(), "public", "uploads", name), buf);
  return `/uploads/${name}`;
}

/** True when the link points at OUR Cloudinary account (the only place direct browser uploads go). */
export function isOwnImageUrl(url: string) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return Boolean(cloud) && url.startsWith(`https://res.cloudinary.com/${cloud}/`) && url.length < 1000;
}

/** Reads the list of picture links the browser got back from Cloudinary. Returns null if any link isn't ours. */
export function parseDirectUrls(raw: FormDataEntryValue | null): string[] | null {
  if (raw == null || raw === "") return [];
  try {
    const list = JSON.parse(String(raw));
    if (!Array.isArray(list) || list.length > 20 || !list.every((u) => typeof u === "string" && isOwnImageUrl(u))) return null;
    return list as string[];
  } catch { return null; }
}
