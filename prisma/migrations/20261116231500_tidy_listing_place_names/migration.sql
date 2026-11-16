-- One-time tidy-up of town and state names typed in all lowercase or all capitals
-- (e.g. "gulf shores, al" -> "Gulf Shores, AL"). New saves are formatted by src/lib/place.ts.
-- Mixed-case names ("McAllen") are left alone.
UPDATE "Listing"
SET "city" = replace(replace(replace(replace(replace(initcap(btrim("city")), ' Of ', ' of '), ' The ', ' the '), ' And ', ' and '), ' On ', ' on '), ' In ', ' in ')
WHERE btrim("city") <> '' AND ("city" = lower("city") OR "city" = upper("city"));

UPDATE "Listing"
SET "region" = upper(btrim("region"))
WHERE btrim("region") ~ '^[A-Za-z]{2}$' AND "region" <> upper(btrim("region"));

UPDATE "Listing"
SET "region" = initcap(btrim("region"))
WHERE length(btrim("region")) > 2 AND ("region" = lower("region") OR "region" = upper("region"));
