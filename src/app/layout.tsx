import type { Metadata, Viewport } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";

// One clean sans for the whole shop, with weight (400 to 800) doing the work of hierarchy.
const sans = Assistant({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${BRAND} | Men's and women's fashion`, template: `%s | ${BRAND}` },
  description: "Modern, premium clothing for men and women.",
};
export const viewport: Viewport = { themeColor: "#FFFFFF", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
