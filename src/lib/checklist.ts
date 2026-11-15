/** Turnover cleaning checklist rules (shared by server and UI). */

export const DEFAULT_CHECKLIST = [
  "Strip and remake all beds with fresh linens",
  "Clean and sanitize bathrooms: toilet, shower or tub, sink, mirrors",
  "Restock toilet paper, towels and toiletries",
  "Clean kitchen: counters, sink, stovetop, microwave; dishes washed and put away",
  "Check the fridge and remove anything left by guests",
  "Empty all trash and recycling, replace liners",
  "Vacuum and mop all floors",
  "Check for damage, stains or missing items (message the owner if you find any)",
  "Set thermostat, turn off lights, close windows and lock all doors",
] as const;

export const MAX_CHECKLIST_ITEMS = 40;
export const MAX_JOB_PHOTOS = 30;

/** Owner's textarea → clean list. One item per line; bullets and numbering are stripped. */
export function parseChecklist(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)]|\[\s?\])\s*/, "").trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, MAX_CHECKLIST_ITEMS);
}

export function checklistFor(listing: { cleaningChecklist: string[] }): string[] {
  return listing.cleaningChecklist.length ? listing.cleaningChecklist : [...DEFAULT_CHECKLIST];
}

export function usesChecklist(category: string): boolean {
  return category === "cleaning";
}

/** What's still missing before a cleaner can mark the job done. Empty = ready. */
export function completionBlockers(args: { items: { doneAt: Date | null }[]; photoCount: number; minPhotos: number }): string[] {
  const out: string[] = [];
  const left = args.items.filter((i) => !i.doneAt).length;
  if (left) out.push(`${left} checklist item${left === 1 ? "" : "s"} not ticked`);
  const photos = Math.max(0, args.minPhotos - args.photoCount);
  if (photos) out.push(`${photos} more photo${photos === 1 ? "" : "s"} needed`);
  return out;
}
