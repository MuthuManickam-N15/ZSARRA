import "server-only";
import { db } from "./db";
import { BRAND, CONTACT } from "./brand";

/** The QR picture shown on the payment page until a new one is uploaded in Admin > Settings. To use your own QR by replacing the file, overwrite this path in the project. */
export const DEFAULT_QR_IMAGE = "/payment/upi-qr.png";
export const DEFAULT_UPI_ID = "yourname@upi"; // placeholder until the real UPI ID is saved in Admin > Settings

export type StoreSettings = {
  storeName: string; storeEmail: string;
  shippingCharge: number;        // paise
  freeShippingThreshold: number; // paise; 0 = never free
  taxPercent: number;
  paymentsEnabled: boolean;      // false pauses checkout
  upiId: string; upiName: string;
  qrImageUrl: string;            // "" = use DEFAULT_QR_IMAGE
};

const defaults: Record<string, string> = {
  storeName: BRAND, storeEmail: CONTACT.email,
  shippingCharge: "9900", freeShippingThreshold: "199900", taxPercent: "0",
  paymentsEnabled: "1", upiId: DEFAULT_UPI_ID, upiName: BRAND, qrImageUrl: "",
};

export async function getSettings(): Promise<StoreSettings> {
  const rows = await db.setting.findMany();
  const m = { ...defaults, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  return {
    storeName: m.storeName, storeEmail: m.storeEmail,
    shippingCharge: Number(m.shippingCharge), freeShippingThreshold: Number(m.freeShippingThreshold),
    taxPercent: Number(m.taxPercent), paymentsEnabled: m.paymentsEnabled === "1",
    upiId: m.upiId, upiName: m.upiName, qrImageUrl: m.qrImageUrl,
  };
}

/** Server-side shipping + tax from the subtotal. Used by checkout. */
export function priceOrder(subtotal: number, s: Pick<StoreSettings, "shippingCharge" | "freeShippingThreshold" | "taxPercent">) {
  const shipping = s.freeShippingThreshold > 0 && subtotal >= s.freeShippingThreshold ? 0 : s.shippingCharge;
  const tax = Math.round((subtotal * s.taxPercent) / 100);
  return { subtotal, shipping, tax, total: subtotal + shipping + tax };
}
