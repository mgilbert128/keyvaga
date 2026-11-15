import { describe, expect, it, vi } from "vitest";

const fetched: string[] = [];
vi.mock("@/lib/storage", () => ({
  getPrivateBlob: async (p: string) => {
    fetched.push(p);
    return { blob: { contentType: "image/jpeg" }, stream: new Uint8Array([1]) };
  },
}));

const { GET } = await import("@/app/api/photos/[...path]/route");
const get = (path: string[]) => GET(new Request("http://x/api/photos"), { params: Promise.resolve({ path }) } as never);

describe("public photo route", () => {
  it("serves listing and provider photos", async () => {
    expect((await get(["listings", "abc", "p.jpg"])).status).toBe(200);
    expect((await get(["providers", "abc", "p.jpg"])).status).toBe(200);
  });

  it("never serves private folders (documents, job proof photos) or odd paths", async () => {
    fetched.length = 0;
    for (const p of [["documents", "l1", "deed.jpg"], ["job-photos", "j1", "a.jpg"], ["listings", "..", "documents", "x.jpg"], ["listings", "", "x.jpg"]]) {
      expect((await get(p)).status).toBe(404);
    }
    expect(fetched).toEqual([]);
  });
});
