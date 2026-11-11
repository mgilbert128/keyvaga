/**
 * Sample data for local development and the preview site. Every account uses the
 * password in SEED_PASSWORD (default "keyvaga-demo-123").
 * In production it only runs when KEYVAGA_DEMO=true. Remove that before real launch.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Role } from "../src/generated/prisma/enums";

if (process.env.NODE_ENV === "production" && process.env.KEYVAGA_DEMO !== "true") {
  throw new Error("Refusing to seed in production (set KEYVAGA_DEMO=true for a demo site)");
}

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const password = process.env.SEED_PASSWORD ?? "keyvaga-demo-123";

async function upsertUser(email: string, name: string, roles: Role[], passwordHash: string) {
  return db.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, roles: { create: roles.map((role) => ({ role })) } },
  });
}

async function main() {
  const hash = await bcrypt.hash(password, 12);
  const owner = await upsertUser("owner@keyvaga.test", "Jordan Owens", ["GUEST", "OWNER"], hash);
  await upsertUser("guest@keyvaga.test", "Alex Garcia", ["GUEST"], hash);
  await upsertUser("provider@keyvaga.test", "Sam Clean", ["GUEST", "PROVIDER"], hash);
  await upsertUser("admin@keyvaga.test", "Keyvaga Admin", ["ADMIN"], hash);

  const listings = [
    {
      slug: "lakeside-cabin",
      title: "Lakeside Cabin",
      summary: "A quiet cedar cabin a short walk from the water, with a wood stove and a big deck.",
      propertyType: "CABIN" as const,
      city: "Lake Geneva",
      region: "WI",
      bedrooms: 3,
      bathrooms: "2",
      maxGuests: 6,
      nightlyRateCents: 18500,
      cleaningFeeCents: 9500,
    },
    {
      slug: "downtown-loft",
      title: "Downtown Loft",
      summary: "Bright open-plan loft near restaurants, transit and the riverwalk.",
      propertyType: "APARTMENT" as const,
      city: "Chicago",
      region: "IL",
      bedrooms: 2,
      bathrooms: "1",
      maxGuests: 4,
      nightlyRateCents: 14000,
      cleaningFeeCents: 7500,
    },
    {
      slug: "beach-house",
      title: "Beach House",
      summary: "Steps from the sand, with an outdoor shower, a screened porch and room for the whole family.",
      propertyType: "HOUSE" as const,
      city: "Gulf Shores",
      region: "AL",
      bedrooms: 4,
      bathrooms: "3",
      maxGuests: 8,
      nightlyRateCents: 26000,
      cleaningFeeCents: 15000,
    },
  ];

  for (const l of listings) {
    await db.listing.upsert({
      where: { slug: l.slug },
      update: {},
      create: { ...l, ownerId: owner.id, status: "PUBLISHED", featured: true, instantBook: true },
    });
  }
  console.log(`Seeded 4 users and ${listings.length} listings. Password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
