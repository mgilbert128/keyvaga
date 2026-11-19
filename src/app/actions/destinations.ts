"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { canAccessPortal } from "@/lib/auth/roles";
import { db } from "@/lib/db";

/** Admin: save (or clear) the written introduction shown on a destination page. */
export async function saveDestinationIntro(slug: string, fd: FormData) {
  const user = await getCurrentUser();
  if (!user || !canAccessPortal(user.roles, "admin")) redirect("/no-access?portal=admin");
  const clean = slug.replace(/[^a-z0-9-]/g, "").slice(0, 120);
  const intro = String(fd.get("intro") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 4000);
  if (!clean) return;
  if (intro) await db.destinationContent.upsert({ where: { slug: clean }, create: { slug: clean, intro }, update: { intro } });
  else await db.destinationContent.deleteMany({ where: { slug: clean } });
  revalidatePath("/admin/destinations");
  revalidatePath(`/destinations/${clean}`);
}
