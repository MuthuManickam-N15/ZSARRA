import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ rows: [] as { key: string; value: string }[] }));
vi.mock("@/lib/db", () => ({ db: { setting: { findMany: async () => h.rows } } }));

import { getSettings, priceOrder, type StoreSettings } from "@/lib/settings";

const s: StoreSettings = { storeName: "ZSARRA", storeEmail: "a@b.co", shippingCharge: 9900, freeShippingThreshold: 199900, taxPercent: 0, paymentsEnabled: true, upiId: "x@upi", upiName: "ZSARRA", qrImageUrl: "" };

describe("priceOrder", () => {
  it("adds shipping below the free-shipping threshold", () => {
    expect(priceOrder(100000, s)).toEqual({ subtotal: 100000, shipping: 9900, tax: 0, total: 109900 });
  });
  it("makes shipping free at exactly the threshold, not one paisa below", () => {
    expect(priceOrder(199900, s).shipping).toBe(0);
    expect(priceOrder(199899, s).shipping).toBe(9900);
  });
  it("never gives free shipping when the threshold is 0", () => {
    expect(priceOrder(99999999, { ...s, freeShippingThreshold: 0 }).shipping).toBe(9900);
  });
  it("calculates tax on the subtotal and rounds to whole paise", () => {
    const r = priceOrder(12345, { ...s, taxPercent: 5, freeShippingThreshold: 0 });
    expect(r.tax).toBe(617); // 617.25 rounds down
    expect(Number.isInteger(r.total)).toBe(true);
    expect(r.total).toBe(12345 + 9900 + 617);
  });
  it("always returns integer paise", () => {
    for (const sub of [1, 333, 99999, 123457]) for (const pct of [0, 5, 12, 18]) {
      const r = priceOrder(sub, { ...s, taxPercent: pct });
      expect([r.subtotal, r.shipping, r.tax, r.total].every(Number.isInteger)).toBe(true);
    }
  });
});

describe("getSettings", () => {
  beforeEach(() => { h.rows = []; });
  it("falls back to defaults when nothing is saved", async () => {
    expect(await getSettings()).toMatchObject({ shippingCharge: 9900, freeShippingThreshold: 199900, taxPercent: 0, paymentsEnabled: true, upiId: "yourname@upi", upiName: "ZSARRA", qrImageUrl: "" });
  });
  it("uses saved values as numbers and booleans", async () => {
    h.rows = [{ key: "shippingCharge", value: "15000" }, { key: "taxPercent", value: "12" }, { key: "paymentsEnabled", value: "0" }, { key: "upiId", value: "shop@okbank" }, { key: "qrImageUrl", value: "https://example.com/qr.png" }];
    expect(await getSettings()).toMatchObject({ shippingCharge: 15000, taxPercent: 12, paymentsEnabled: false, upiId: "shop@okbank", qrImageUrl: "https://example.com/qr.png" });
  });
});
