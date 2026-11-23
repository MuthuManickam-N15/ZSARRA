import { afterEach, describe, expect, it, vi } from "vitest";

const fsm = vi.hoisted(() => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
vi.mock("node:fs/promises", () => ({ default: fsm }));

import { saveImage, UploadError } from "@/lib/upload";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0];
const WEBP = [..."RIFF"].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [..."WEBP"].map((c) => c.charCodeAt(0)));
const file = (bytes: number[], name = "x.png", type = "image/png") => new File([new Uint8Array(bytes)], name, { type });

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); fsm.mkdir.mockClear(); fsm.writeFile.mockClear(); });

describe("saveImage validation", () => {
  it("rejects files over 5 MB", async () => {
    await expect(saveImage(file(new Array(5 * 1024 * 1024 + 1).fill(0)))).rejects.toThrow(/larger than 5 MB/);
  });
  it("rejects non-images even when named .jpg with an image type", async () => {
    await expect(saveImage(new File(["<?php echo 1;"], "evil.jpg", { type: "image/jpeg" }))).rejects.toThrow(UploadError);
  });
  it("rejects SVG and GIF", async () => {
    await expect(saveImage(new File(["<svg onload=alert(1)>"], "a.svg", { type: "image/svg+xml" }))).rejects.toThrow(/JPG, PNG or WebP/);
    await expect(saveImage(file([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], "a.gif", "image/gif"))).rejects.toThrow(/JPG, PNG or WebP/);
  });
  it("writes nothing when validation fails", async () => {
    await saveImage(file([1, 2, 3])).catch(() => {});
    expect(fsm.writeFile).not.toHaveBeenCalled();
  });
});

describe("saveImage storage", () => {
  const dev = () => { vi.stubEnv("NODE_ENV", "development"); for (const k of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) vi.stubEnv(k, ""); };

  it.each([["png", PNG, "image/png"], ["jpg", JPG, "image/jpeg"], ["webp", WEBP, "image/webp"]])("stores a real %s locally in development with a random name", async (ext, bytes, type) => {
    dev();
    const url = await saveImage(file(bytes, "whatever.bin", type));
    expect(url).toMatch(new RegExp(`^/uploads/[0-9a-f]{24}\\.${ext}$`));
    expect(fsm.writeFile).toHaveBeenCalledTimes(1);
  });
  it("refuses to store locally in production without Cloudinary", async () => {
    dev(); vi.stubEnv("NODE_ENV", "production");
    await expect(saveImage(file(PNG))).rejects.toThrow(/isn't configured/);
    expect(fsm.writeFile).not.toHaveBeenCalled();
  });
  it("uploads to Cloudinary with a signed request when configured", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "democloud"); vi.stubEnv("CLOUDINARY_API_KEY", "key"); vi.stubEnv("CLOUDINARY_API_SECRET", "secret");
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ secure_url: "https://res.cloudinary.com/x/y.png" }) });
    vi.stubGlobal("fetch", f);
    expect(await saveImage(file(PNG))).toBe("https://res.cloudinary.com/x/y.png");
    expect(f.mock.calls[0][0]).toBe("https://api.cloudinary.com/v1_1/democloud/image/upload");
    const body = f.mock.calls[0][1].body as FormData;
    expect(String(body.get("signature"))).toMatch(/^[0-9a-f]{40}$/);
    expect(body.get("api_secret")).toBeNull(); // the secret itself is never sent
  });
});
