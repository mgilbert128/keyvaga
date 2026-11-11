import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Hosted Postgres (e.g. Neon on Vercel) gives a pooled URL for the app and a direct
    // ("unpooled") URL; schema migrations should use the direct one when it exists.
    url:
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL,
  },
});
