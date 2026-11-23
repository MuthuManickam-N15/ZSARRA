export default async () => {
  const base = process.env.URL; // Netlify sets this to your site's address
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response("CRON_SECRET or URL is not set", { status: 200 });
  const res = await fetch(`${base}/api/cron/expire-orders`, { headers: { authorization: `Bearer ${secret}` } });
  return new Response(`expire-orders: ${res.status}`, { status: 200 });
};

export const config = { schedule: "*/10 * * * *" };
