import type { Role } from "@/generated/prisma/enums";

export type Portal = "guest" | "owner" | "provider" | "admin";

/** Which role each portal requires. Admins do not automatically see other portals' private data. */
export const PORTAL_ROLE: Record<Portal, Role> = {
  guest: "GUEST",
  owner: "OWNER",
  provider: "PROVIDER",
  admin: "ADMIN",
};

export const PORTAL_HOME: Record<Portal, string> = {
  guest: "/trips",
  owner: "/owner",
  provider: "/provider",
  admin: "/admin",
};

export function hasRole(roles: readonly Role[], role: Role): boolean {
  return roles.includes(role);
}

export function canAccessPortal(roles: readonly Role[], portal: Portal): boolean {
  return hasRole(roles, PORTAL_ROLE[portal]);
}

/** Roles a person may pick for themselves at sign-up. ADMIN is never self-assigned. */
export const SELF_SERVE_ROLES = ["GUEST", "OWNER", "PROVIDER"] as const;
export type SelfServeRole = (typeof SELF_SERVE_ROLES)[number];

/** Everyone gets GUEST so they can book; owners and providers get their extra role too. */
export function rolesForSignup(intent: SelfServeRole): Role[] {
  return intent === "GUEST" ? ["GUEST"] : ["GUEST", intent];
}

/** Where to send someone after they sign in, when no specific page was requested. */
export function defaultLandingFor(roles: readonly Role[]): string {
  if (hasRole(roles, "OWNER")) return PORTAL_HOME.owner;
  if (hasRole(roles, "PROVIDER")) return PORTAL_HOME.provider;
  if (hasRole(roles, "ADMIN")) return PORTAL_HOME.admin;
  return PORTAL_HOME.guest;
}

/** Only allow same-site relative redirects, to avoid open-redirect attacks. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
