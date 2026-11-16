"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";

/** One account for everything: switching to hosting the first time adds the owner role. */
export async function becomeHost(): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  if (!user.roles.includes("OWNER")) {
    await db.userRole.upsert({ where: { userId_role: { userId: user.id, role: "OWNER" } }, create: { userId: user.id, role: "OWNER" }, update: {} });
  }
  return { ok: true };
}
