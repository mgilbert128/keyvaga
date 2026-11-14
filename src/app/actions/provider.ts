"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { canReviewListings } from "@/lib/listing-policy";
import { getOrCreateProfile } from "@/lib/providers";
import { isServiceCategory, parseServiceAreas } from "@/lib/services";
import { deleteImage } from "@/lib/storage";
import { payoutOnboardingLink, payoutDashboardLink } from "@/lib/payouts";

export type ProviderResult = { ok?: boolean; message?: string } | undefined;

async function requireProvider() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("PROVIDER")) redirect("/no-access?portal=provider");
  return user;
}

export async function saveProviderProfile(_prev: ProviderResult, fd: FormData): Promise<ProviderResult> {
  const user = await requireProvider();
  const profile = await getOrCreateProfile(user);
  const businessName = String(fd.get("businessName") ?? "").trim().slice(0, 80);
  const bio = String(fd.get("bio") ?? "").trim().slice(0, 3000);
  const categories = [...new Set(fd.getAll("categories").map(String).filter(isServiceCategory))];
  const serviceAreaText = String(fd.get("serviceAreaText") ?? "").trim().slice(0, 500);
  const region = String(fd.get("region") ?? "").trim().toUpperCase().slice(0, 40);
  const pricingGuidance = String(fd.get("pricingGuidance") ?? "").trim().slice(0, 1000);
  const availabilityNote = String(fd.get("availabilityNote") ?? "").trim().slice(0, 60);
  if (!businessName) return { message: "Enter your business name." };
  await db.providerProfile.update({
    where: { id: profile.id },
    data: { businessName, bio, categories, serviceAreaText, serviceAreas: parseServiceAreas(serviceAreaText), region, pricingGuidance, availabilityNote },
  });
  revalidatePath("/provider");
  revalidatePath("/provider/profile");
  return { ok: true, message: profile.status === "APPROVED" ? "Saved. Changes are live." : "Saved." };
}

/** What's still missing before the profile can be reviewed. */
function missing(p: { businessName: string; bio: string; categories: string[]; region: string; photos: unknown[] }) {
  const m: string[] = [];
  if (!p.businessName.trim()) m.push("your business name");
  if (p.bio.trim().length < 30) m.push("a short description (30+ characters)");
  if (!p.categories.length) m.push("at least one service");
  if (!p.region.trim()) m.push("the state you work in");
  if (!p.photos.length) m.push("at least one photo (your work, logo or team)");
  return m;
}

export async function submitProviderProfile(): Promise<ProviderResult> {
  const user = await requireProvider();
  const profile = await getOrCreateProfile(user);
  if (profile.status !== "DRAFT") return { message: "Your profile has already been submitted." };
  const m = missing(profile);
  if (m.length) return { message: `Before submitting, add ${m.join(", ")}.` };
  await db.providerProfile.update({ where: { id: profile.id }, data: { status: "PENDING_REVIEW", submittedAt: new Date(), reviewNote: null } });
  revalidatePath("/provider");
  revalidatePath("/provider/profile");
  revalidatePath("/admin");
  return { ok: true, message: "Submitted! We'll review your profile and let you know." };
}

export async function setProviderPaused(paused: boolean) {
  const user = await requireProvider();
  const profile = await getOrCreateProfile(user);
  if (paused && profile.status === "APPROVED") await db.providerProfile.update({ where: { id: profile.id }, data: { status: "PAUSED" } });
  if (!paused && profile.status === "PAUSED") await db.providerProfile.update({ where: { id: profile.id }, data: { status: "APPROVED" } });
  revalidatePath("/provider");
  revalidatePath("/provider/profile");
}

export async function deleteProviderPhoto(photoId: string) {
  const user = await requireProvider();
  const profile = await getOrCreateProfile(user);
  const photo = await db.providerPhoto.findFirst({ where: { id: photoId, providerId: profile.id } });
  if (!photo) return;
  await db.providerPhoto.delete({ where: { id: photo.id } });
  await deleteImage(photo.storageKey).catch(() => {});
  revalidatePath("/provider/profile");
}

/** Admin approves or sends back a provider profile. */
export async function reviewProvider(profileId: string, action: "approve" | "reject", fd: FormData) {
  const user = await getCurrentUser();
  if (!user || !canReviewListings(user)) redirect("/no-access?portal=admin");
  const p = await db.providerProfile.findUnique({ where: { id: profileId } });
  if (!p || p.status !== "PENDING_REVIEW") return;
  const note = String(fd.get("note") ?? "").trim().slice(0, 1000);
  await db.providerProfile.update({
    where: { id: p.id },
    data: action === "approve" ? { status: "APPROVED", approvedAt: new Date(), reviewNote: null } : { status: "DRAFT", reviewNote: note || "Please review your profile and resubmit." },
  });
  revalidatePath("/admin");
}

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

export async function startProviderPayoutSetup() {
  const user = await requireProvider();
  let url: string;
  try {
    url = await payoutOnboardingLink(user.id, await origin(), "/provider/payouts");
  } catch (e) {
    console.error("provider payout onboarding failed", e);
    redirect(`/provider/payouts?error=${encodeURIComponent("Couldn't open payout setup. Please try again.")}`);
  }
  redirect(url);
}

export async function openProviderPayoutDashboard() {
  const user = await requireProvider();
  const url = await payoutDashboardLink(user.id).catch(() => null);
  redirect(url ?? "/provider/payouts");
}
