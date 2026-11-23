"use server";
import crypto from "node:crypto";
import { requireAdmin } from "@/lib/session";

export type UploadSignature = { cloudName: string; apiKey: string; timestamp: string; signature: string; folder: string; allowedFormats: string };

/** Lets the admin's browser upload pictures straight to Cloudinary. This matters on Netlify, where a request to our own server
 *  can carry only about 6 MB. The secret never leaves the server: the browser gets a short-lived signature for exactly these settings.
 *  Returns null when Cloudinary isn't configured (local development), and the old upload-through-the-server path is used instead. */
export async function getUploadSignature(): Promise<UploadSignature | null> {
  await requireAdmin();
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloudName || !apiKey || !secret) return null;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const folder = "zsarra", allowedFormats = "jpg,png,webp";
  // Cloudinary signs the parameters in alphabetical order.
  const signature = crypto.createHash("sha1").update(`allowed_formats=${allowedFormats}&folder=${folder}&timestamp=${timestamp}${secret}`).digest("hex");
  return { cloudName, apiKey, timestamp, signature, folder, allowedFormats };
}
