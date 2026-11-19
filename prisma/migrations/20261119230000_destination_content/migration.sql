-- Editable intro text for destination pages (helps travelers and search engines).
CREATE TABLE "DestinationContent" (
    "slug" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DestinationContent_pkey" PRIMARY KEY ("slug")
);

INSERT INTO "DestinationContent" ("slug", "intro", "updatedAt") VALUES
('gulf-shores-al', 'Gulf Shores sits on Alabama''s Gulf Coast, known for wide sugar-white beaches and clear, emerald-green water. It''s a favorite for families and friends who want an easy, laid-back beach trip.

Days here are made for the beach, but there''s plenty more: Gulf State Park''s trails, fishing pier and lake, waterfront seafood spots, and quiet stretches of sand away from the main strip. Spring and fall bring warm weather with lighter crowds, while summer is peak season for sun and water.

Book a Gulf-front condo with a balcony view, a beach house with room for the whole group, or a cozy place a short walk from the sand, all directly from local hosts on Keyvaga.', NOW()),
('orange-beach-al', 'Orange Beach is Gulf Shores'' neighbor to the east, with the same white-sand beaches plus easy access to the back bays, Perdido Pass and some of the best fishing on the Gulf Coast.

Spend the day on the beach, take a dolphin cruise or charter a fishing trip, then head to The Wharf for shopping, dining and entertainment. It''s a great pick for families, couples and anyone who loves being on the water.

Find Gulf-front condos, bay-view homes and resort stays from local hosts on Keyvaga.', NOW())
ON CONFLICT ("slug") DO NOTHING;
