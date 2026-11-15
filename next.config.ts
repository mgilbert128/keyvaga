import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Common mistyped addresses go to the right page instead of "not found".
  async redirects() {
    // Matching ignores upper/lower case, so never list a source that only differs from its
    // destination by case (e.g. /Login → /login): that redirects /login to itself forever.
    const to = (destination: string, sources: string[]) => sources.map((source) => ({ source, destination, permanent: false }));
    return [
      ...to("/login", ["/log-in", "/signin", "/sign-in", "/sign_in", "/logon"]),
      ...to("/signup", ["/sign-up", "/sign_up", "/register", "/join"]),
      ...to("/forgot-password", ["/forgot", "/reset", "/password"]),
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
