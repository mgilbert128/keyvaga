/** Forgot/reset password against a real Postgres (TEST_DATABASE_URL). */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const sent: { to: string; url: string }[] = [];
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "keyvaga.test", "x-forwarded-proto": "https" }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/lib/notify", () => ({ notifyPasswordReset: async (to: string, _n: string, url: string) => { sent.push({ to, url }); } }));

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("password reset (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let userId = "";
  beforeAll(async () => {
    await db.passwordResetToken.deleteMany();
    const u = await db.user.upsert({ where: { email: "reset@test.example" }, update: {}, create: { email: "reset@test.example", name: "Reset Me", passwordHash: "old" } });
    userId = u.id;
    await db.session.create({ data: { id: "sess-reset-test", userId, expiresAt: new Date(Date.now() + 86_400_000) } });
  });
  afterAll(() => db.$disconnect());

  it("gives the same answer whether or not the account exists, and only emails real accounts", async () => {
    const { requestPasswordReset } = await import("@/app/actions/password-reset");
    const fd = (email: string) => { const f = new FormData(); f.set("email", email); return f; };
    const a = await requestPasswordReset(undefined, fd("reset@test.example"));
    const b = await requestPasswordReset(undefined, fd("nobody@test.example"));
    expect(a).toEqual(b);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toMatch(/^https:\/\/keyvaga\.test\/reset-password\?token=[\w-]{40,}$/);
    // Stored hashed, not as the raw token.
    const token = new URL(sent[0]!.url).searchParams.get("token")!;
    expect(await db.passwordResetToken.findUnique({ where: { id: token } })).toBeNull();
  });

  it("resets once, signs out every device, and refuses reuse or expired links", async () => {
    const { resetPassword } = await import("@/app/actions/password-reset");
    const token = new URL(sent[0]!.url).searchParams.get("token")!;
    const fd = (t: string, p = "a-brand-new-password") => { const f = new FormData(); f.set("token", t); f.set("password", p); return f; };
    expect(await resetPassword(undefined, fd(token, "short"))).toMatchObject({ message: expect.stringMatching(/10 characters/) });
    await expect(resetPassword(undefined, fd(token))).rejects.toThrow("REDIRECT:/login?reset=1");
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u.passwordHash).not.toBe("old");
    expect(await db.session.count({ where: { userId } })).toBe(0);
    expect(await resetPassword(undefined, fd(token))).toMatchObject({ message: expect.stringMatching(/expired or was already used/) });
    expect(await resetPassword(undefined, fd("not-a-real-token"))).toMatchObject({ message: expect.stringMatching(/expired/) });
  });

  it("limits how many links can be requested per hour", async () => {
    const { requestPasswordReset } = await import("@/app/actions/password-reset");
    const f = new FormData(); f.set("email", "reset@test.example");
    for (let i = 0; i < 5; i++) await requestPasswordReset(undefined, f);
    expect(await db.passwordResetToken.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 3_600_000) } } })).toBe(3);
  });
});
