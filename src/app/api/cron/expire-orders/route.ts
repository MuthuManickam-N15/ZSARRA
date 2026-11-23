import { expireStaleOrders } from "@/lib/payments";

export const dynamic = "force-dynamic";

// Optional: call this every 10 minutes from a scheduler with  Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not found", { status: 404 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return Response.json({ expired: await expireStaleOrders() });
}
