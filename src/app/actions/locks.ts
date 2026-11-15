"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { assignLock, disconnectAccount, issueUpcomingForListing, retryEvent, startConnect, syncLocks } from "@/lib/locks";
import { isTimeZone } from "@/lib/locks/time";
import { siteUrl } from "@/lib/site";

async function owner() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (!u.roles.includes("OWNER")) redirect("/no-access?portal=owner");
  return u;
}

const back = (msg?: string) => redirect(msg ? `/owner/locks?error=${encodeURIComponent(msg)}` : "/owner/locks");

export async function connectLockAccount() {
  const u = await owner();
  const h = await headers();
  const origin = h.get("origin") || siteUrl();
  let url: string;
  try {
    url = await startConnect(u.id, `${origin}/owner/locks?connecting=1`);
  } catch (e) {
    back(e instanceof Error ? e.message : "Couldn't start connecting. Try again.");
    return;
  }
  redirect(url);
}

export async function refreshLocks() {
  const u = await owner();
  await syncLocks(u.id).catch(() => {});
  revalidatePath("/owner/locks");
}

export async function disconnectLockAccount(accountId: string) {
  const u = await owner();
  await disconnectAccount(u.id, accountId);
  revalidatePath("/owner/locks");
}

export async function saveLockSettings(lockId: string, fd: FormData) {
  const u = await owner();
  const listingId = String(fd.get("listingId") ?? "") || null;
  const backup = String(fd.get("backupCode") ?? "").replace(/\s/g, "");
  if (backup && !/^\d{4,10}$/.test(backup)) back("A backup code must be 4–10 digits.");
  const lock = await db.lock.findFirst({ where: { id: lockId, ownerId: u.id } });
  if (!lock) back("Lock not found.");
  await db.lock.update({ where: { id: lockId }, data: { backupCode: backup || null } });
  try {
    await assignLock(u.id, lockId, listingId);
  } catch (e) {
    back(e instanceof Error ? e.message : "Couldn't save.");
  }
  revalidatePath("/owner/locks");
  redirect("/owner/locks?saved=1");
}

export async function setListingTimeZone(listingId: string, fd: FormData) {
  const u = await owner();
  const tz = String(fd.get("timeZone") ?? "");
  if (!isTimeZone(tz)) back("Choose a time zone.");
  const { count } = await db.listing.updateMany({ where: { id: listingId, ownerId: u.id }, data: { timeZone: tz } });
  if (!count) back("Listing not found.");
  await issueUpcomingForListing(listingId).catch(() => {});
  revalidatePath("/owner/locks");
  redirect("/owner/locks?saved=1");
}

export async function retryLockEvent(eventId: string) {
  const u = await owner();
  await retryEvent(u.id, eventId);
  revalidatePath("/owner/locks");
}

export async function dismissLockEvent(eventId: string) {
  const u = await owner();
  await db.lockEvent.updateMany({ where: { id: eventId, ownerId: u.id }, data: { resolvedAt: new Date() } });
  revalidatePath("/owner/locks");
}
