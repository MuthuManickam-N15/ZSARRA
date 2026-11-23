import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireAdmin: m.admin }));

import { getUploadSignature } from "@/app/actions/uploads";
import { looksLikeImage, uploadDirect } from "@/lib/direct-upload";
import { isOwnImageUrl, parseDirectUrls } from "@/lib/upload";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const file = (bytes: number[], name = "a.png") => new File([new Uint8Array(bytes)], name);
const sig = { cloudName: "demo", apiKey: "key", timestamp: "1700000000", signature: "abc", folder: "zsarra", allowedFormats: "jpg,png,webp" };

beforeEach(() => { m.admin.mockReset(); m.admin.mockResolvedValue({}); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("getUploadSignature", () => {
  it("is only for admins", async () => {
    m.admin.mockRejectedValue(new Error("REDIRECT:/admin/login"));
    await expect(getUploadSignature()).rejects.toThrow("REDIRECT");
  });
  it("returns null when Cloudinary isn't configured (local development)", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", ""); vi.stubEnv("CLOUDINARY_API_KEY", ""); vi.stubEnv("CLOUDINARY_API_SECRET", "");
    expect(await getUploadSignature()).toBeNull();
  });
  it("signs exactly the parameters the browser will send, and never reveals the secret", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo"); vi.stubEnv("CLOUDINARY_API_KEY", "key123"); vi.stubEnv("CLOUDINARY_API_SECRET", "s3cret");
    const s = (await getUploadSignature())!;
    const expected = crypto.createHash("sha1").update(`allowed_formats=jpg,png,webp&folder=zsarra&timestamp=${s.timestamp}s3cret`).digest("hex");
    expect(s).toMatchObject({ cloudName: "demo", apiKey: "key123", folder: "zsarra", allowedFormats: "jpg,png,webp", signature: expected });
    expect(JSON.stringify(s)).not.toContain("s3cret");
  });
});

describe("looksLikeImage", () => {
  it.each([["JPEG", JPG], ["PNG", PNG], ["WebP", WEBP]])("accepts %s", async (_n, b) => expect(await looksLikeImage(file(b))).toBe(true));
  it("rejects GIFs, scripts and empty files, whatever their name says", async () => {
    expect(await looksLikeImage(file([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], "x.png"))).toBe(false);
    expect(await looksLikeImage(new File(["<svg onload=alert(1)>"], "x.png"))).toBe(false);
    expect(await looksLikeImage(file([]))).toBe(false);
  });
});

describe("uploadDirect", () => {
  it("sends the picture and the signed fields to Cloudinary and returns the link", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ secure_url: "https://res.cloudinary.com/demo/image/upload/v1/zsarra/a.png" }) });
    vi.stubGlobal("fetch", f);
    expect(await uploadDirect(file(PNG), sig)).toBe("https://res.cloudinary.com/demo/image/upload/v1/zsarra/a.png");
    expect(f.mock.calls[0][0]).toBe("https://api.cloudinary.com/v1_1/demo/image/upload");
    const body = f.mock.calls[0][1].body as FormData;
    expect(Object.fromEntries(["api_key", "timestamp", "signature", "folder", "allowed_formats"].map((k) => [k, body.get(k)]))).toEqual({ api_key: "key", timestamp: "1700000000", signature: "abc", folder: "zsarra", allowed_formats: "jpg,png,webp" });
    expect(body.get("file")).toBeInstanceOf(Blob);
    expect(body.get("api_secret")).toBeNull();
  });
  it("refuses big files and non-images before sending anything", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    await expect(uploadDirect(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg"), sig)).rejects.toThrow(/larger than 5 MB/);
    await expect(uploadDirect(new File(["hello"], "x.jpg"), sig)).rejects.toThrow(/JPG, PNG or WebP/);
    expect(f).not.toHaveBeenCalled();
  });
  it("explains Cloudinary rejections and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { message: "Invalid Signature" } }) }));
    await expect(uploadDirect(file(PNG), sig)).rejects.toThrow(/rejected a\.png: Invalid Signature/);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(uploadDirect(file(PNG), sig)).rejects.toThrow(/Couldn't reach/);
  });
});

describe("links that came from direct uploads are only trusted if they are ours", () => {
  const ok = "https://res.cloudinary.com/demo/image/upload/v1/zsarra/a.jpg";
  beforeEach(() => vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo"));
  it("accepts our Cloudinary links", () => { expect(isOwnImageUrl(ok)).toBe(true); expect(parseDirectUrls(JSON.stringify([ok, ok]))).toEqual([ok, ok]); });
  it("treats nothing as an empty list", () => { expect(parseDirectUrls(null)).toEqual([]); expect(parseDirectUrls("")).toEqual([]); });
  it.each([
    ["another cloud", "https://res.cloudinary.com/evil/image/upload/a.jpg"], ["plain http", "http://res.cloudinary.com/demo/image/upload/a.jpg"],
    ["another site", "https://example.com/a.jpg"], ["a look-alike host", "https://res.cloudinary.com.evil.com/demo/a.jpg"],
  ])("rejects %s", (_n, url) => { expect(isOwnImageUrl(url)).toBe(false); expect(parseDirectUrls(JSON.stringify([url]))).toBeNull(); });
  it("rejects malformed lists", () => {
    for (const raw of ["not json", '{"a":1}', "[1,2]", JSON.stringify(Array(21).fill(ok))]) expect(parseDirectUrls(raw)).toBeNull();
  });
  it("trusts nothing when Cloudinary isn't configured", () => { vi.stubEnv("CLOUDINARY_CLOUD_NAME", ""); expect(isOwnImageUrl(ok)).toBe(false); expect(parseDirectUrls(JSON.stringify([ok]))).toBeNull(); });
});
