import { exportFeed } from "@/lib/calendar-sync";

/** Listing calendar export for Airbnb, Vrbo, Booking.com, Hospitable, OwnerRez: /ical/<secret token>.ics */
export async function GET(_req: Request, ctx: RouteContext<"/ical/[file]">) {
  const { file } = await ctx.params;
  const token = file.replace(/\.ics$/i, "");
  if (!/^[a-z0-9]{20,64}$/i.test(token)) return new Response("Not found", { status: 404 });
  const body = await exportFeed(token);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
