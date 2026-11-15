/** Notifications never throw, even if the database or email service fails. */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: () => new Proxy({}, { get: () => async () => { throw new Error("db down"); } }) }) }));

describe("notifications are best-effort", () => {
  it("swallow errors so bookings and payments never fail because of email", async () => {
    const n = await import("@/lib/notify");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(n.notifyBookingConfirmed("x")).resolves.toBeUndefined();
    await expect(n.notifyBookingCancelled("x", "guest", 100)).resolves.toBeUndefined();
    await expect(n.notifyBookingMessage("x")).resolves.toBeUndefined();
    await expect(n.notifyJobRequest("x")).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
