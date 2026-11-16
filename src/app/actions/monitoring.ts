"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { canAccessPortal } from "@/lib/auth/roles";
import { captureException, monitoringEnabled } from "@/lib/monitoring";

export type TestErrorState = { ok: boolean; message: string } | null;

/** Admin-only: sends one harmless test event to Sentry so the founder can confirm monitoring works. */
export async function sendTestError(_prev: TestErrorState): Promise<TestErrorState> {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.roles, "admin")) redirect("/no-access?portal=admin");
  if (!monitoringEnabled()) {
    return { ok: false, message: "Error monitoring is off: SENTRY_DSN isn't set in Vercel (or the deployment hasn't been redone since it was added)." };
  }
  const err = new Error("Keyvaga test error - safe to ignore");
  err.name = "TestError";
  await captureException(err, { level: "warning", tags: { source: "admin-test" }, extra: { sentBy: user.email } });
  return { ok: true, message: "Test error sent. It should appear under Issues in Sentry within a minute." };
}
