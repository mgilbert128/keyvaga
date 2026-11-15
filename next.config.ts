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
  // Security headers on every response. (Stripe's payment form is an iframe *inside* our pages, which these allow.)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://connect.getseam.com https://*.stripe.com" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
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
