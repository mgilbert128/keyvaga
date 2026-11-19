import { expireStaleHolds } from "@/lib/bookings";
import { runCalendarSync } from "@/lib/calendar-sync";
import { runHospitableSync } from "@/lib/hospitable";
import { reportJobFailures } from "@/lib/monitoring";

/**
 * Runs every hour (vercel.json; needs Vercel Pro): expires unanswered booking requests and stale checkout holds
 * right on time, and keeps outside calendars (iCal and Hospitable) fresh. Money jobs and guest messages stay in the
 * daily job so retries and message times don't change.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const expired = await expireStaleHolds().catch((e) => `error: ${String(e)}`);
  const calendars = await runCalendarSync().catch((e) => ({ error: String(e) }));
  const hospitable = await runHospitableSync().catch((e) => ({ error: `error: ${String(e)}` }));
  const result = { expired, calendars, hospitable };
  await reportJobFailures("hourly jobs", result);
  return Response.json(result);
}
