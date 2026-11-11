/**
 * Admins are configured by email in the ADMIN_EMAILS environment variable
 * (comma-separated). Admin can never be chosen at sign-up.
 */
export function isConfiguredAdmin(email: string, adminEmails = process.env.ADMIN_EMAILS ?? ""): boolean {
  const target = email.trim().toLowerCase();
  if (!target) return false;
  return adminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}
