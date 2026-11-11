import { describe, expect, it } from "vitest";
import { isAllowedDuration, isAllowedVideoType, isVideoPathForListing, sniffVideoType, videoPathPrefix } from "@/lib/video";

describe("video rules", () => {
  it("allows up to 20 seconds with a small tolerance", () => {
    expect(isAllowedDuration(5)).toBe(true);
    expect(isAllowedDuration(20)).toBe(true);
    expect(isAllowedDuration(20.4)).toBe(true);
    expect(isAllowedDuration(21)).toBe(false);
    expect(isAllowedDuration(0)).toBe(false);
    expect(isAllowedDuration(Number.NaN)).toBe(false);
    expect(isAllowedDuration(Number.POSITIVE_INFINITY)).toBe(false);
  });
  it("accepts common phone formats only", () => {
    expect(isAllowedVideoType("video/mp4")).toBe(true);
    expect(isAllowedVideoType("video/quicktime")).toBe(true);
    expect(isAllowedVideoType("video/webm")).toBe(true);
    expect(isAllowedVideoType("image/jpeg")).toBe(false);
    expect(isAllowedVideoType("text/html")).toBe(false);
  });
  it("only lets a listing attach files from its own folder", () => {
    expect(isVideoPathForListing(`${videoPathPrefix("abc")}123.mp4`, "abc")).toBe(true);
    expect(isVideoPathForListing(`${videoPathPrefix("xyz")}123.mp4`, "abc")).toBe(false);
    expect(isVideoPathForListing(`${videoPathPrefix("abc")}../../xyz/photo.jpg`, "abc")).toBe(false);
    expect(isVideoPathForListing(`${videoPathPrefix("abc")}sub/dir.mp4`, "abc")).toBe(false);
    expect(isVideoPathForListing("listings/abc/photo.jpg", "abc")).toBe(false);
  });
  it("recognizes video containers from their first bytes", () => {
    const ftyp = (brand: string) => new Uint8Array([0, 0, 0, 0x20, ...new TextEncoder().encode("ftyp" + brand)]);
    expect(sniffVideoType(ftyp("isom"))).toBe("video/mp4");
    expect(sniffVideoType(ftyp("qt  "))).toBe("video/quicktime");
    expect(sniffVideoType(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]))).toBe("video/webm");
    expect(sniffVideoType(new TextEncoder().encode("<html>"))).toBeNull();
  });
});
