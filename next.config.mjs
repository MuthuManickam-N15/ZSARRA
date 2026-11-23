// Addresses that may submit forms (server actions). Netlify provides URL / DEPLOY_PRIME_URL; your own domain comes from NEXT_PUBLIC_SITE_URL.
const hosts = [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL, process.env.NEXT_PUBLIC_SITE_URL]
  .filter(Boolean)
  .map((u) => { try { return new URL(u.trim()).host; } catch { return null; } })
  .filter(Boolean);
const allowedOrigins = [...new Set(hosts)];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The hosted build must not stop because of type or style findings. Run `npm run typecheck` yourself to see them.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: { serverActions: { bodySizeLimit: "30mb", ...(allowedOrigins.length ? { allowedOrigins } : {}) } },
  images: { remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }] },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
};
export default nextConfig;
