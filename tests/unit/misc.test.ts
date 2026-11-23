import { afterEach, describe, expect, it, vi } from "vitest";
import { slugify } from "@/lib/slug";
import { formatPrice } from "@/lib/format";
import { allow, clearLimit } from "@/lib/rate-limit";

describe("slugify", () => {
  it("makes url-safe slugs", () => expect(slugify("  Linen Overshirt!! ")).toBe("linen-overshirt"));
  it("never returns an empty slug", () => expect(slugify("!!!")).toBe("item"));
  it("caps the length", () => expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(80));
});

describe("formatPrice", () => {
  it("formats paise as rupees", () => {
    expect(formatPrice(199900)).toMatch(/^₹\s?1,999$/);
    expect(formatPrice(249900)).toMatch(/^₹\s?2,499$/);
  });
});

describe("rate limiter", () => {
  afterEach(() => vi.useRealTimers());
  it("allows up to the limit then blocks", () => {
    const k = `t1:${Math.random()}`;
    for (let i = 0; i < 5; i++) expect(allow(k, 5, 60_000)).toBe(true);
    expect(allow(k, 5, 60_000)).toBe(false);
  });
  it("tracks keys separately", () => {
    const a = `a:${Math.random()}`, b = `b:${Math.random()}`;
    allow(a, 1, 60_000);
    expect(allow(a, 1, 60_000)).toBe(false);
    expect(allow(b, 1, 60_000)).toBe(true);
  });
  it("resets after the window", () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const k = `w:${Math.random()}`;
    allow(k, 1, 1000);
    expect(allow(k, 1, 1000)).toBe(false);
    vi.setSystemTime(1500);
    expect(allow(k, 1, 1000)).toBe(true);
  });
  it("can be cleared after a successful login", () => {
    const k = `c:${Math.random()}`;
    allow(k, 1, 60_000); clearLimit(k);
    expect(allow(k, 1, 60_000)).toBe(true);
  });
});
