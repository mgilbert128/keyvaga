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

const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL;
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
      minNights: 2,
      addressLine1: "100 Sample Shore Rd",
      postalCode: "53147",
      amenities: ["wifi", "kitchen", "heating", "fire_pit", "waterfront", "free_parking", "patio", "smoke_alarm", "co_alarm"],
      houseRules: "No smoking\nQuiet hours after 10pm\nNo parties or events",
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
      addressLine1: "200 Sample Ave, Unit 5",
      postalCode: "60601",
      amenities: ["wifi", "kitchen", "washer", "dryer", "air_conditioning", "workspace", "tv", "self_check_in", "smoke_alarm"],
      houseRules: "No smoking\nNo pets",
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
      minNights: 3,
      addressLine1: "300 Sample Beach Blvd",
      postalCode: "36542",
      amenities: ["wifi", "kitchen", "washer", "air_conditioning", "pool", "beach_access", "bbq", "pets_allowed", "free_parking", "crib", "smoke_alarm", "first_aid"],
      houseRules: "No smoking\nPets welcome with approval\nRinse sand off at the outdoor shower",
    },
  ];

  for (const l of listings) {
    const { summary, amenities, houseRules, addressLine1, postalCode, minNights } = l;
    const checkInInstructions = "Sample: the lockbox is by the front door; your code arrives here before check-in.\nWi-Fi: KeyvagaGuest / password on the fridge.\nPark in the driveway, not on the street.";
    const guidebook = "Sample guidebook.\n\nCoffee: the corner café opens at 7.\nGroceries: 5 minutes by car.\nDon't miss: sunset from the dock.";
    await db.listing.upsert({
      where: { slug: l.slug },
      // Refresh sample details on existing demo rows without touching owner edits to other fields.
      update: { summary, amenities, houseRules, addressLine1, postalCode, minNights: minNights ?? 1, checkInInstructions, guidebook },
      create: { ...l, ownerId: owner.id, status: "PUBLISHED", featured: true, instantBook: true, publishedAt: new Date(), checkInInstructions, guidebook },
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
