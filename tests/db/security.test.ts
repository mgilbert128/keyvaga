/** Rate limiting and email confirmation against a real Postgres (TEST_DATABASE_URL). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { clearLimit, hit } from "@/lib/rate-limit";
import { confirmEmail, sendVerificationEmail } from "@/lib/email-verification";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("security (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let userId = "";

  beforeAll(async () => {
    await db.rateLimit.deleteMany();
    await db.emailVerificationToken.deleteMany();
    await db.user.deleteMany({ where: { email: "sec@test.example" } });
    userId = (await db.user.create({ data: { email: "sec@test.example", name: "Sam Secure", passwordHash: "x" } })).id;
  });
  afterAll(() => db.$disconnect());

  it("allows up to the limit in a window, then blocks, and can be cleared", async () => {
    for (let i = 0; i < 3; i++) expect((await hit("t:a", 3, 60)).ok).toBe(true);
    const blocked = await hit("t:a", 3, 60);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect((await hit("t:b", 3, 60)).ok).toBe(true); // other keys unaffected
    await clearLimit("t:a");
    expect((await hit("t:a", 3, 60)).ok).toBe(true);
  });

  it("starts a new window once the old one has passed", async () => {
    await db.rateLimit.update({ where: { key: "t:b" }, data: { count: 99, resetAt: new Date(Date.now() - 1000) } });
    const r = await hit("t:b", 3, 60);
    expect(r.ok).toBe(true);
    expect((await db.rateLimit.findUniqueOrThrow({ where: { key: "t:b" } })).count).toBe(1);
  });

  it("counts correctly when many attempts arrive at once", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => hit("t:race", 5, 60)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });

  it("confirms an email with a valid link, ignores bad or expired ones, and limits resends", async () => {
    expect(await sendVerificationEmail(userId)).toBe("sent");
    expect(await confirmEmail("not-a-real-token")).toBeNull();
    // Recreate a known token: tokens are stored hashed, so insert one directly.
    const { hashSessionToken } = await import("@/lib/auth/tokens");
    await db.emailVerificationToken.create({ data: { id: hashSessionToken("expired"), userId, expiresAt: new Date(Date.now() - 1000) } });
    expect(await confirmEmail("expired")).toBeNull();
    await db.emailVerificationToken.create({ data: { id: hashSessionToken("good"), userId, expiresAt: new Date(Date.now() + 3_600_000) } });
    expect(await confirmEmail("good")).toBe(userId);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).emailVerifiedAt).not.toBeNull();
    expect(await confirmEmail("good")).toBe(userId); // clicking twice is fine
    expect(await sendVerificationEmail(userId)).toBe("already");

    await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: null } });
    for (let i = 0; i < 2; i++) await sendVerificationEmail(userId); // 5 tokens in the last day now
    expect(await sendVerificationEmail(userId)).toBe("limited");
  });
});
