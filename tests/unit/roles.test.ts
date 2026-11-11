import { describe, expect, it } from "vitest";
import { canAccessPortal, defaultLandingFor, rolesForSignup, safeNextPath } from "@/lib/auth/roles";

describe("portal permissions", () => {
  it("lets each role into its own portal only", () => {
    expect(canAccessPortal(["GUEST"], "guest")).toBe(true);
    expect(canAccessPortal(["GUEST"], "owner")).toBe(false);
    expect(canAccessPortal(["GUEST"], "provider")).toBe(false);
    expect(canAccessPortal(["GUEST"], "admin")).toBe(false);
  });

  it("supports people with several roles", () => {
    const roles = ["GUEST", "OWNER"] as const;
    expect(canAccessPortal(roles, "guest")).toBe(true);
    expect(canAccessPortal(roles, "owner")).toBe(true);
    expect(canAccessPortal(roles, "provider")).toBe(false);
  });

  it("does not give admins other portals implicitly", () => {
    expect(canAccessPortal(["ADMIN"], "admin")).toBe(true);
    expect(canAccessPortal(["ADMIN"], "owner")).toBe(false);
  });

  it("denies everything with no roles", () => {
    for (const p of ["guest", "owner", "provider", "admin"] as const) {
      expect(canAccessPortal([], p)).toBe(false);
    }
  });
});

describe("sign-up roles", () => {
  it("always includes GUEST and never ADMIN", () => {
    expect(rolesForSignup("GUEST")).toEqual(["GUEST"]);
    expect(rolesForSignup("OWNER")).toEqual(["GUEST", "OWNER"]);
    expect(rolesForSignup("PROVIDER")).toEqual(["GUEST", "PROVIDER"]);
  });

  it("lands owners in the owner portal", () => {
    expect(defaultLandingFor(["GUEST", "OWNER"])).toBe("/owner");
    expect(defaultLandingFor(["GUEST"])).toBe("/trips");
  });
});

describe("safeNextPath (open-redirect protection)", () => {
  it("allows same-site paths", () => {
    expect(safeNextPath("/owner")).toBe("/owner");
    expect(safeNextPath("/search?where=lake")).toBe("/search?where=lake");
  });
  it("rejects external and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("/\\evil.example")).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});
