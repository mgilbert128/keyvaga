import { z } from "zod";

/** Bed types owners can pick, with how many people each sleeps (for the "sleeps N" check). */
export const BED_TYPES = {
  king: { label: "King bed", plural: "King beds", sleeps: 2 },
  queen: { label: "Queen bed", plural: "Queen beds", sleeps: 2 },
  full: { label: "Full / double bed", plural: "Full / double beds", sleeps: 2 },
  twin: { label: "Twin / single bed", plural: "Twin / single beds", sleeps: 1 },
  bunk: { label: "Bunk bed (2 beds)", plural: "Bunk beds (2 beds each)", sleeps: 2 },
  bunk_twin_full: { label: "Bunk bed (twin over full)", plural: "Bunk beds (twin over full)", sleeps: 3 },
  sofa_bed: { label: "Sofa bed", plural: "Sofa beds", sleeps: 2 },
  trundle: { label: "Trundle bed", plural: "Trundle beds", sleeps: 1 },
  daybed: { label: "Daybed", plural: "Daybeds", sleeps: 1 },
  murphy: { label: "Murphy bed", plural: "Murphy beds", sleeps: 2 },
  crib: { label: "Crib", plural: "Cribs", sleeps: 1 },
  air_mattress: { label: "Air mattress", plural: "Air mattresses", sleeps: 2 },
} as const;
export type BedType = keyof typeof BED_TYPES;
export const BED_TYPE_KEYS = Object.keys(BED_TYPES) as BedType[];

/** Suggested room names (owners can type their own). */
export const ROOM_SUGGESTIONS = ["Primary bedroom", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bunk room", "Guest bedroom", "Living room", "Loft", "Den", "Hallway bunks"];

export type SleepingRoom = { name: string; beds: { type: BedType; count: number }[] };

export const sleepingSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1, "Give each room a name.").max(40),
      beds: z
        .array(z.object({ type: z.enum(BED_TYPE_KEYS as [BedType, ...BedType[]]), count: z.coerce.number().int().min(1).max(10) }))
        .min(1, "Add at least one bed to each room.")
        .max(8),
    }),
  )
  .max(20, "Up to 20 rooms.");

/** Reads the stored JSON safely (old or hand-edited data never breaks a page). */
export function parseSleeping(raw: unknown): SleepingRoom[] {
  const r = sleepingSchema.safeParse(raw);
  return r.success ? r.data : [];
}

export const bedLine = (b: { type: BedType; count: number }) => (b.count > 1 ? `${b.count} ${BED_TYPES[b.type].plural}` : `1 ${BED_TYPES[b.type].label}`);

/** Total people the listed beds sleep. */
export const bedCapacity = (rooms: SleepingRoom[]) => rooms.reduce((t, r) => t + r.beds.reduce((s, b) => s + BED_TYPES[b.type].sleeps * b.count, 0), 0);
