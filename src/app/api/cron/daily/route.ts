import { runDailyJobs } from "@/lib/bookings";
import { runDailyJobTasks } from "@/lib/jobs";
import { runAutoMessages } from "@/lib/auto-messages-server";
import { runLockTasks } from "@/lib/locks";
import { runCalendarSync } from "@/lib/calendar-sync";
import { runHospitableSync } from "@/lib/hospitable";
import { sweepRateLimits } from "@/lib/rate-limit";
import { reportJobFailures } from "@/lib/monitoring";
import { accrueLockFees } from "@/lib/owner-fees";

/**
 * Runs once a day (configured in vercel.json): releases expired holds, charges balances
 * due 30 days before check-in, and pays owners whose guests have checked in.
 * Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await sweepRateLimits().catch(() => {});
  // Before payouts run, so this month's lock fees can come out of today's payouts.
  const lockFees = await accrueLockFees().catch((e) => ({ error: String(e) }));
  const calendars = await runCalendarSync().catch((e) => ({ error: String(e) }));
  const hospitable = await runHospitableSync().catch((e) => ({ error: `error: ${String(e)}` }));
  const result = { lockFees, calendars, hospitable, bookings: await runDailyJobs(), serviceJobs: await runDailyJobTasks(), autoMessages: await runAutoMessages(), locks: await runLockTasks().catch((e) => ({ error: String(e) })) };
  console.log("daily jobs", JSON.stringify(result));
  await reportJobFailures("daily jobs", result);
  return Response.json(result);
}
