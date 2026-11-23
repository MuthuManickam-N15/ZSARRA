import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (f: string) => fs.readFileSync(f, "utf8");
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

describe("the payment QR code", () => {
  it("the default QR picture is where the settings say it is, and is a real PNG", () => {
    expect(read("src/lib/settings.ts")).toContain('DEFAULT_QR_IMAGE = "/payment/upi-qr.png"');
    const f = "public/payment/upi-qr.png";
    expect(fs.existsSync(f)).toBe(true);
    expect([...fs.readFileSync(f).subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(fs.statSync(f).size).toBeGreaterThan(2000);
  });
  it("the payment page shows the saved QR or falls back to that default", () => {
    const page = read("src/app/(shop)/pay/[id]/page.tsx");
    expect(page).toContain("settings.qrImageUrl || DEFAULT_QR_IMAGE");
    expect(page).toContain("userId: user.id"); // only the owner's order
  });
  it("the docs tell the owner where to replace it", () => {
    expect(read("README.md")).toContain("public/payment/upi-qr.png");
    expect(read("NETLIFY.md")).toContain("public/payment/upi-qr.png");
  });
});

describe("no online payment gateway is used any more", () => {
  it("the source has no payment-gateway code or settings", () => {
    const offenders = walk("src").filter((f) => /\.(ts|tsx)$/.test(f) && /razorpay|rzp_|payment_capture/i.test(read(f)));
    expect(offenders).toEqual([]);
  });
  it("the environment examples no longer ask for gateway keys", () => {
    for (const f of [".env.example", ".env.test.example", ".env.netlify.example"]) expect(read(f), f).not.toMatch(/razorpay/i);
  });
  it("there is no webhook endpoint", () => expect(fs.existsSync("src/app/api/webhooks")).toBe(false));
});
