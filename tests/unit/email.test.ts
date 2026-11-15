import { describe, expect, it } from "vitest";
import { escapeHtml, renderEmail } from "@/lib/email-templates";

describe("email templates", () => {
  it("escapes user content everywhere", () => {
    const e = renderEmail({ subject: "s", heading: "<b>Hi</b>", paragraphs: ['<script>alert("x")</script>'], quote: "<img src=x onerror=alert(1)>", details: [{ label: "<i>", value: "&" }], button: { label: "Go", url: "javascript:alert(1)" } });
    expect(e.html).not.toContain("<script>");
    expect(e.html).not.toContain("<img src=x");
    expect(e.html).not.toContain("javascript:");
    expect(e.html).toContain("&lt;script&gt;");
    expect(escapeHtml(`"'&<>`)).toBe("&quot;&#39;&amp;&lt;&gt;");
  });
  it("produces a readable plain-text version", () => {
    const e = renderEmail({ subject: "Booked", heading: "You're booked!", paragraphs: ["Line one"], details: [{ label: "Check in", value: "Fri, Jul 3" }], quote: "Hi\nthere", button: { label: "View trip", url: "https://keyvaga.vercel.app/trips/1" } });
    expect(e.text).toContain("You're booked!");
    expect(e.text).toContain("Check in: Fri, Jul 3");
    expect(e.text).toContain("> Hi\n> there");
    expect(e.text).toContain("View trip: https://keyvaga.vercel.app/trips/1");
  });
});
