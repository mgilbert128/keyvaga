"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { canAccessPortal } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site";
import { clientIp, hit, waitText } from "@/lib/rate-limit";

export type WaitlistState = { ok: boolean; message: string } | null;

const s = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().replace(/\s+/g, " ").slice(0, max);

/** Owner waitlist sign-up (soft launch). Emails the admins; the owner gets a short confirmation. */
export async function joinWaitlist(_prev: WaitlistState, fd: FormData): Promise<WaitlistState> {
  if (s(fd, "website", 100)) return { ok: true, message: "Thanks! You're on the list." }; // honeypot: bots fill hidden fields
  const limit = await hit(`waitlist:${await clientIp()}`, 5, 3600);
  if (!limit.ok) return { ok: false, message: `Too many tries. Please wait ${waitText(limit.retryAfterSeconds)} and try again.` };
  const name = s(fd, "name", 100);
  const email = s(fd, "email", 200).toLowerCase();
  if (!name) return { ok: false, message: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Please enter a valid email address." };
  const count = Math.min(10_000, Math.max(1, Math.round(Number(s(fd, "propertyCount", 6)) || 1)));
  const entry = {
    name, email,
    phone: s(fd, "phone", 40),
    company: s(fd, "company", 120),
    propertyCount: count,
    locations: s(fd, "locations", 200),
    software: s(fd, "software", 80),
    notes: s(fd, "notes", 1000),
  };
  if (!(await db.ownerWaitlist.findFirst({ where: { email }, select: { id: true } }))) await db.ownerWaitlist.create({ data: entry });
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  await Promise.all([
    // One email per admin: some Microsoft 365 setups drop a single message sent to two mailboxes on one account.
    ...admins.map((admin) => sendEmail(admin, {
      subject: `Owner waitlist: ${name} (${count} ${count === 1 ? "property" : "properties"})`,
      heading: "New owner on the waitlist",
      paragraphs: [`${name}${entry.company ? ` from ${entry.company}` : ""} wants to list on Keyvaga.`],
      details: [
        { label: "Email", value: email },
        ...(entry.phone ? [{ label: "Phone", value: entry.phone }] : []),
        { label: "Properties", value: String(count) },
        ...(entry.locations ? [{ label: "Where", value: entry.locations }] : []),
        ...(entry.software ? [{ label: "Uses", value: entry.software }] : []),
        ...(entry.notes ? [{ label: "Notes", value: entry.notes }] : []),
      ],
      button: { label: "Open the waitlist", url: `${siteUrl()}/admin/waitlist` },
    }, { replyTo: email }).catch(() => false)),
    sendEmail(email, {
      subject: "You're on the Keyvaga owner waitlist",
      heading: `Thanks, ${name.split(" ")[0]}!`,
      paragraphs: [
        "You're on the list. Keyvaga is opening to new owners soon, and we'll email you as soon as you can set up your listings.",
        "Questions in the meantime? Just reply to this email.",
      ],
    }).catch(() => false),
  ]);
  return { ok: true, message: "Thanks! You're on the list. We'll email you as soon as you can set up your listings." };
}

/** Admin: mark a waitlist entry contacted (or not). */
export async function setWaitlistContacted(formData: FormData) {
  const u = await getCurrentUser();
  if (!u || !canAccessPortal(u.roles, "admin")) redirect("/no-access?portal=admin");
  const id = String(formData.get("id") ?? "");
  const contacted = formData.get("contacted") === "1";
  await db.ownerWaitlist.updateMany({ where: { id }, data: { contactedAt: contacted ? new Date() : null } });
  revalidatePath("/admin/waitlist");
}
