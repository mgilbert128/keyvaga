import type { MetadataRoute } from "next";

/** Let search engines index the public site; keep private portals and APIs out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/owner", "/provider", "/trips", "/messages", "/api/"] }],
    host: "https://www.keyvaga.com",
    sitemap: "https://www.keyvaga.com/sitemap.xml",
  };
}
