/** Amenity catalog. Keys are stored on listings; labels can change freely. */
export const AMENITY_GROUPS = [
  {
    label: "Essentials",
    items: [
      { key: "wifi", label: "Wi-Fi" },
      { key: "kitchen", label: "Kitchen" },
      { key: "washer", label: "Washer" },
      { key: "dryer", label: "Dryer" },
      { key: "air_conditioning", label: "Air conditioning" },
      { key: "heating", label: "Heating" },
      { key: "workspace", label: "Dedicated workspace" },
      { key: "tv", label: "TV" },
    ],
  },
  {
    label: "Outdoors",
    items: [
      { key: "pool", label: "Pool" },
      { key: "hot_tub", label: "Hot tub" },
      { key: "patio", label: "Patio or deck" },
      { key: "bbq", label: "BBQ grill" },
      { key: "fire_pit", label: "Fire pit" },
      { key: "waterfront", label: "Waterfront" },
      { key: "beach_access", label: "Beach access" },
    ],
  },
  {
    label: "Parking and access",
    items: [
      { key: "free_parking", label: "Free parking" },
      { key: "ev_charger", label: "EV charger" },
      { key: "self_check_in", label: "Self check-in" },
      { key: "step_free", label: "Step-free entrance" },
    ],
  },
  {
    label: "Family and pets",
    items: [
      { key: "pets_allowed", label: "Pets allowed" },
      { key: "crib", label: "Crib" },
      { key: "high_chair", label: "High chair" },
    ],
  },
  {
    label: "Safety",
    items: [
      { key: "smoke_alarm", label: "Smoke alarm" },
      { key: "co_alarm", label: "Carbon monoxide alarm" },
      { key: "first_aid", label: "First aid kit" },
      { key: "fire_extinguisher", label: "Fire extinguisher" },
    ],
  },
] as const;

export type AmenityKey = (typeof AMENITY_GROUPS)[number]["items"][number]["key"];

const LABELS = new Map<string, string>(AMENITY_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label] as const)));

export const AMENITY_KEYS = [...LABELS.keys()] as AmenityKey[];

export function isAmenityKey(k: string): k is AmenityKey {
  return LABELS.has(k);
}

export function amenityLabel(k: string): string {
  return LABELS.get(k) ?? k;
}

/** Amenities offered as quick search filters. */
export const SEARCH_AMENITIES: AmenityKey[] = ["wifi", "pool", "hot_tub", "pets_allowed", "free_parking", "waterfront", "washer", "air_conditioning"];
