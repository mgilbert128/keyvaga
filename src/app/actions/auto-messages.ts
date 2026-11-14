"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { SUGGESTED_TEMPLATES, TRIGGERS, unknownPlaceholders, type Trigger } from "@/lib/auto-messages";

export type TemplateResult = { ok?: boolean; message?: string } | undefined;

async function owner() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (!u.roles.includes("OWNER")) redirect("/no-access?portal=owner");
  return u;
}

function parse(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  const trigger = String(fd.get("trigger") ?? "") as Trigger;
  const offsetDays = Math.round(Number(fd.get("offsetDays") ?? 0));
  const body = String(fd.get("body") ?? "").trim();
  const listingId = String(fd.get("listingId") ?? "") || null;
  if (!name) return { error: "Give the message a name (only you see it)." };
  if (!TRIGGERS.some((t) => t.value === trigger)) return { error: "Choose when to send it." };
  const usesDays = TRIGGERS.find((t) => t.value === trigger)!.usesDays;
  if (usesDays && !(offsetDays >= 0 && offsetDays <= 60)) return { error: "Days must be between 0 and 60." };
  if (body.length < 5) return { error: "Write the message." };
  if (body.length > 4000) return { error: "Keep messages under 4,000 characters." };
  const unknown = unknownPlaceholders(body);
  if (unknown.length) return { error: `Unknown fill-in: ${unknown.map((u) => `{${u}}`).join(", ")}. Use the buttons above the message to insert fill-ins.` };
  return { data: { name, trigger, offsetDays: usesDays ? offsetDays : 0, body, listingId } };
}

export async function saveTemplate(templateId: string | null, _prev: TemplateResult, fd: FormData): Promise<TemplateResult> {
  const u = await owner();
  const p = parse(fd);
  if ("error" in p) return { message: p.error };
  if (p.data.listingId && !(await db.listing.findFirst({ where: { id: p.data.listingId, ownerId: u.id }, select: { id: true } }))) return { message: "Choose one of your listings." };
  if (templateId) {
    const { count } = await db.messageTemplate.updateMany({ where: { id: templateId, ownerId: u.id }, data: p.data });
    if (!count) return { message: "Message not found." };
  } else {
    await db.messageTemplate.create({ data: { ...p.data, ownerId: u.id } });
  }
  revalidatePath("/owner/messages/automated");
  redirect("/owner/messages/automated?saved=1");
}

export async function toggleTemplate(templateId: string, enabled: boolean) {
  const u = await owner();
  await db.messageTemplate.updateMany({ where: { id: templateId, ownerId: u.id }, data: { enabled } });
  revalidatePath("/owner/messages/automated");
}

export async function deleteTemplate(templateId: string) {
  const u = await owner();
  await db.messageTemplate.deleteMany({ where: { id: templateId, ownerId: u.id } });
  revalidatePath("/owner/messages/automated");
}

/** Creates the five suggested messages (skipping any the owner already has by name). */
export async function addSuggestedTemplates() {
  const u = await owner();
  const existing = new Set((await db.messageTemplate.findMany({ where: { ownerId: u.id }, select: { name: true } })).map((t) => t.name));
  const toAdd = SUGGESTED_TEMPLATES.filter((t) => !existing.has(t.name));
  if (toAdd.length) await db.messageTemplate.createMany({ data: toAdd.map((t) => ({ ...t, ownerId: u.id })) });
  revalidatePath("/owner/messages/automated");
}
