import { describe, expect, it } from "vitest";
import config from "../../next.config";

describe("security headers", () => {
  it("every page gets clickjacking, sniffing and HTTPS protections", async () => {
    const [rule] = await config.headers!();
    const h = Object.fromEntries(rule!.headers.map((x) => [x.key, x.value]));
    expect(rule!.source).toBe("/:path*");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Strict-Transport-Security"]).toContain("max-age=");
  });
});
