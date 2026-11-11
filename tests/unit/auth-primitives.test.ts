import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hashSessionToken, newSessionToken } from "@/lib/auth/tokens";
import { signupSchema } from "@/lib/validation/auth";
import { formatCents } from "@/lib/money";

describe("passwords", () => {
  it("hashes and verifies, and rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong password!!", hash)).toBe(false);
  });
});

describe("session tokens", () => {
  it("are long, random and stored only as a hash", () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashSessionToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(a)).not.toBe(a);
  });
});

describe("sign-up validation", () => {
  it("normalizes email and defaults to the guest role", () => {
    const r = signupSchema.parse({ name: " Ana ", email: " ANA@Example.com ", password: "long-enough-pw" });
    expect(r).toMatchObject({ name: "Ana", email: "ana@example.com", intent: "GUEST" });
  });
  it("refuses self-assigned admin and short passwords", () => {
    expect(signupSchema.safeParse({ name: "A", email: "a@b.co", password: "long-enough-pw", intent: "ADMIN" }).success).toBe(false);
    expect(signupSchema.safeParse({ name: "A", email: "a@b.co", password: "short" }).success).toBe(false);
  });
});

describe("money (USD, integer cents)", () => {
  it("formats cents", () => {
    expect(formatCents(18500)).toBe("$185");
    expect(formatCents(12345)).toBe("$123.45");
  });
  it("refuses fractional cents", () => {
    expect(() => formatCents(10.5)).toThrow();
  });
});
