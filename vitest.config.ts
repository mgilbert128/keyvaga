import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside a React Server Component bundle; tests run in plain Node.
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    environment: "node",
    fileParallelism: false,
    // Modules that import the app database client need a URL; it only connects when queried.
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://unused@localhost/unused", STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "proxy-injected" },
  },
});
