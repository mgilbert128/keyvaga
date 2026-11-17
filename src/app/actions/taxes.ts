"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { canAccessPortal } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { formatTown, stateCode } from "@/lib/place";
import { parseRatePercent } from "@/lib/tax-calc";

async function requireAdmin() {
  const u = await getCurrentUser();
  if (!u || !canAccessPortal(u.roles, "admin")) redirect("/no-access?portal=admin");
  return u;
}

const back = (msg: string, kind: "error" | "saved" = "error") => redirect(`/admin/taxes?${kind}=${encodeURIComponent(msg)}`);

/** Adds a lodging tax rate. New bookings in that area pick it up immediately; existing bookings keep their taxes. */
export async function addTaxRate(formData: FormData) {
  await requireAdmin();
  const state = stateCode(String(formData.get("state") ?? ""));
  const city = formatTown(String(formData.get("city") ?? "").slice(0, 80));
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const ratePpm = parseRatePercent(String(formData.get("rate") ?? ""));
  const filedBy = formData.get("filedBy") === "OWNER" ? "OWNER" : "KEYVAGA";
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500);
  if (!state) back("Enter a US state, like AL or Alabama.");
  if (!name) back("Give the tax a name, like “Baldwin County lodging tax”.");
  if (ratePpm === null || ratePpm === 0) back("Enter the rate as a percent between 0 and 30, like 4.5.");
  await db.taxRate.create({ data: { state: state!, city, name, ratePpm: ratePpm!, filedBy, notes } });
  revalidatePath("/admin/taxes");
  back(`Added ${name}.`, "saved");
}

/** Turns a rate on or off for future bookings (kept for the record). */
export async function setTaxRateActive(id: string, active: boolean) {
  await requireAdmin();
  await db.taxRate.update({ where: { id }, data: { active } });
  revalidatePath("/admin/taxes");
}

/** Deletes a rate entered by mistake. Bookings that already used it keep their own copy of the tax. */
export async function deleteTaxRate(id: string) {
  await requireAdmin();
  await db.taxRate.delete({ where: { id } });
  revalidatePath("/admin/taxes");
}
