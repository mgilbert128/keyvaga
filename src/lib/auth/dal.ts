import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { readSession } from "./session";
import { PORTAL_ROLE, canAccessPortal, type Portal } from "./roles";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
};

/**
 * Data access layer: the single place that decides who is signed in.
 * Every protected page and server action goes through here, so permission
 * checks sit next to the data rather than only in layouts or the proxy.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const { user } = session;
  return { id: user.id, name: user.name, email: user.email, roles: user.roles.map((r) => r.role) };
});

export async function requireUser(nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return user;
}

export async function requirePortal(portal: Portal, nextPath: string): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  if (!canAccessPortal(user.roles, portal)) {
    redirect(`/no-access?portal=${portal}`);
  }
  return user;
}

export function requiredRoleFor(portal: Portal): Role {
  return PORTAL_ROLE[portal];
}
