import { describe, expect, it } from "vitest";
import config from "../../next.config";

describe("redirects", () => {
  it("never redirect a page to itself (matching ignores case)", async () => {
    const rules = await config.redirects!();
    for (const r of rules) expect(r.source.toLowerCase(), r.source).not.toBe(r.destination.toLowerCase());
  });
});
