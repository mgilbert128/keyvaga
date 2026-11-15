import { describe, expect, it } from "vitest";
import { DEFAULT_CHECKLIST, checklistFor, completionBlockers, parseChecklist } from "@/lib/checklist";

describe("cleaning checklist", () => {
  it("parses one item per line, stripping bullets, numbers and blanks", () => {
    expect(parseChecklist("- Make beds\n\n2. Clean bathrooms\n• Take out trash\n[ ] Lock doors\n   ")).toEqual(["Make beds", "Clean bathrooms", "Take out trash", "Lock doors"]);
    expect(parseChecklist(Array.from({ length: 60 }, (_, i) => `Item ${i}`).join("\n"))).toHaveLength(40);
  });

  it("falls back to the suggested checklist", () => {
    expect(checklistFor({ cleaningChecklist: [] })).toEqual([...DEFAULT_CHECKLIST]);
    expect(checklistFor({ cleaningChecklist: ["A"] })).toEqual(["A"]);
  });

  it("lists what's missing before a cleaning can be marked done", () => {
    const d = new Date();
    expect(completionBlockers({ items: [{ doneAt: d }, { doneAt: null }], photoCount: 1, minPhotos: 4 })).toEqual(["1 checklist item not ticked", "3 more photos needed"]);
    expect(completionBlockers({ items: [{ doneAt: d }], photoCount: 5, minPhotos: 4 })).toEqual([]);
    expect(completionBlockers({ items: [], photoCount: 0, minPhotos: 0 })).toEqual([]);
  });
});
