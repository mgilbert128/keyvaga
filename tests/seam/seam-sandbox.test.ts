/**
 * Talks to a real Seam Sandbox workspace. Run with:
 *   SEAM_INTEGRATION=1 SEAM_API_KEY=<sandbox key> SEAM_TEST_ACCOUNT=<connected account id> npx vitest run tests/seam
 * (Connect a sandbox Schlage account first: email jane@example.com, password 1234.)
 */
import { describe, expect, it } from "vitest";
import { seam } from "@/lib/locks/seam";

const suite = process.env.SEAM_INTEGRATION && process.env.SEAM_TEST_ACCOUNT ? describe : describe.skip;

suite("Seam sandbox", () => {
  const account = process.env.SEAM_TEST_ACCOUNT!;

  it("reads the connected account and its locks", async () => {
    const a = await seam().getConnectedAccount(account);
    expect(a.provider).toBeTruthy();
    const devices = await seam().listDevices(account);
    console.log(a, devices);
    expect(devices.some((d) => d.supportsCodes)).toBe(true);
  });

  it("creates, reads and deletes a time-limited code", async () => {
    const [lock] = (await seam().listDevices(account)).filter((d) => d.supportsCodes);
    const startsAt = new Date(Date.now() + 7 * 86_400_000);
    const endsAt = new Date(startsAt.getTime() + 2 * 86_400_000);
    const c = await seam().createAccessCode({ deviceId: lock!.id, name: "Keyvaga test", code: "582941", startsAt, endsAt });
    console.log("created", c);
    expect(c.code).toBe("582941");
    const got = await seam().getAccessCode(c.id);
    expect(got?.id).toBe(c.id);
    await seam().deleteAccessCode(c.id);
    await seam().deleteAccessCode(c.id); // already gone: no error
  });
});
