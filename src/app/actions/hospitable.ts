"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { HospitableError, canUseHospitable, importHospitableProperty, linkHospitableProperty, syncHospitableListing, unlinkHospitableListing } from "@/lib/hospitable";

async function requireHospitableOwner() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/owner/hospitable");
  if (!canUseHospitable(user)) redirect("/owner/hospitable");
  return user;
}

const back = (kind: "saved" | "error", msg: string) => redirect(`/owner/hospitable?${kind}=${encodeURIComponent(msg)}`);

async function run(fn: () => Promise<unknown>, ok: string) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof HospitableError) back("error", e.message);
    console.error("hospitable action failed", e);
    back("error", "Something went wrong talking to Hospitable. Please try again.");
  }
  revalidatePath("/owner/hospitable");
  revalidatePath("/owner/listings");
  back("saved", ok);
}

export async function importPropertyAction(propertyId: string) {
  const user = await requireHospitableOwner();
  let listingId = "";
  try {
    listingId = await importHospitableProperty(user.id, propertyId);
  } catch (e) {
    if (e instanceof HospitableError) back("error", e.message);
    console.error("hospitable import failed", e);
    back("error", "Import failed. Please try again.");
  }
  revalidatePath("/owner/listings");
  redirect(`/owner/listings/${listingId}?imported=1`);
}

export async function linkPropertyAction(propertyId: string, formData: FormData) {
  const user = await requireHospitableOwner();
  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) back("error", "Choose which Keyvaga listing to link.");
  await run(() => linkHospitableProperty(user.id, listingId, propertyId), "Linked. Prices and availability are now synced from Hospitable.");
}

export async function syncListingAction(listingId: string) {
  await requireHospitableOwner();
  await run(async () => {
    const r = await syncHospitableListing(listingId);
    if (!r.ok) throw new HospitableError(r.error);
  }, "Synced with Hospitable.");
}

export async function unlinkListingAction(listingId: string) {
  const user = await requireHospitableOwner();
  await run(() => unlinkHospitableListing(user.id, listingId), "Unlinked from Hospitable.");
}
