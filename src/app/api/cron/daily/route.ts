import { runDailyJobs } from "@/lib/bookings";
import { runDailyJobTasks } from "@/lib/jobs";
import { runAutoMessages } from "@/lib/auto-messages-server";
import { runLockTasks } from "@/lib/locks";

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
  const result = { bookings: await runDailyJobs(), serviceJobs: await runDailyJobTasks(), autoMessages: await runAutoMessages(), locks: await runLockTasks().catch((e) => ({ error: String(e) })) };
  console.log("daily jobs", JSON.stringify(result));
  return Response.json(result);
}
