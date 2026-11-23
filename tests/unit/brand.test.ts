import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND, CONTACT } from "@/lib/brand";

const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const read = (f: string) => fs.readFileSync(f, "utf8");

describe("brand name", () => {
  it("is ZSARRA", () => expect(BRAND).toBe("ZSARRA"));
  it("the old name never appears in the source code", () => {
    expect(walk("src").filter((f) => /\.(ts|tsx|css)$/.test(f) && /ZARA/.test(read(f)))).toEqual([]);
  });
  it("the pages that show the name read it from one place", () => {
    for (const f of ["src/app/layout.tsx", "src/components/Footer.tsx", "src/components/Logo.tsx", "src/components/AuthCard.tsx", "src/app/(shop)/login/page.tsx"]) expect(read(f), f).toContain("@/lib/brand");
  });
  it("the logo files the header uses exist", () => {
    expect(fs.existsSync("public/logo.png")).toBe(true);
    expect(fs.existsSync("public/logo-mark.png")).toBe(true);
    expect(read("src/components/Logo.tsx")).toContain("/logo-mark.png");
  });
});

describe("contact details", () => {
  it("are the store's real details", () => {
    expect(CONTACT.phone).toBe("8754158897");
    expect(CONTACT.email).toBe("zsarrafashion@gmail.com");
    expect(CONTACT.address).toBe("Pongalur, Tiruppur - 641667");
  });
  it("produce working phone, email and map links", () => {
    expect(CONTACT.phoneHref).toBe("tel:+918754158897");
    expect(CONTACT.phoneDisplay.replace(/\D/g, "")).toBe("918754158897");
    expect(CONTACT.emailHref).toBe(`mailto:${CONTACT.email}`);
    expect(CONTACT.mapsHref).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Pongalur/);
  });
  it("are shown on the contact page, footer, FAQ, policies and order page, all from the same place", () => {
    for (const f of ["src/app/(shop)/contact/page.tsx", "src/components/Footer.tsx", "src/app/(shop)/faq/page.tsx", "src/app/(shop)/policies/[slug]/page.tsx", "src/app/(shop)/account/orders/[id]/page.tsx"]) {
      expect(read(f), f).toContain("CONTACT");
      expect(read(f), f).not.toContain("8754158897"); // never typed by hand
    }
  });
  it("no placeholder contact details remain", () => {
    expect(walk("src").filter((f) => /\.(ts|tsx)$/.test(f) && /support@example\.com/.test(read(f)))).toEqual([]);
  });
});
