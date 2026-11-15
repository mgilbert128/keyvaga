import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Common mistyped addresses go to the right page instead of "not found".
  async redirects() {
    const to = (destination: string, sources: string[]) => sources.map((source) => ({ source, destination, permanent: false }));
    return [
      ...to("/login", ["/Login", "/LOGIN", "/log-in", "/Log-in", "/signin", "/sign-in", "/Sign-in", "/SignIn", "/sign_in", "/logon"]),
      ...to("/signup", ["/Signup", "/SignUp", "/sign-up", "/Sign-up", "/sign_up", "/register", "/join"]),
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
