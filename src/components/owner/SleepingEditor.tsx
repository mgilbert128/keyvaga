"use client";

import { useState } from "react";
import { BED_TYPES, BED_TYPE_KEYS, ROOM_SUGGESTIONS, bedCapacity, type BedType, type SleepingRoom } from "@/lib/sleeping";
import { inputClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";

/** Room-by-room bed list for the listing form; submitted as JSON in a hidden "sleeping" field. */
export function SleepingEditor({ initial, error, maxGuests }: { initial: SleepingRoom[]; error?: string[]; maxGuests?: number }) {
  const [rooms, setRooms] = useState<SleepingRoom[]>(initial);
  const update = (i: number, r: SleepingRoom) => setRooms(rooms.map((x, j) => (j === i ? r : x)));
  const addRoom = () => setRooms([...rooms, { name: rooms.length === 0 ? "Primary bedroom" : `Bedroom ${rooms.length + 1}`, beds: [{ type: rooms.length === 0 ? "king" : "queen", count: 1 }] }]);
  const capacity = bedCapacity(rooms);
  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="sleeping" value={JSON.stringify(rooms)} />
      <datalist id="room-names">{ROOM_SUGGESTIONS.map((n) => <option key={n} value={n} />)}</datalist>
      {rooms.length === 0 ? <p className="text-ink-muted">No rooms added yet. Guests love knowing exactly where everyone will sleep.</p> : null}
      <ol className="flex flex-col gap-3">
        {rooms.map((room, i) => (
          <li key={i} className="flex flex-col gap-3 rounded-control border border-line p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-48 flex-1 flex-col gap-2">
                <span className="text-sm font-semibold">Room</span>
                <input list="room-names" value={room.name} maxLength={40} onChange={(e) => update(i, { ...room, name: e.target.value })} className={inputClass} placeholder="e.g. Primary bedroom" />
              </label>
              <button type="button" onClick={() => setRooms(rooms.filter((_, j) => j !== i))} className={buttonClass("ghost", "text-danger")} aria-label={`Remove ${room.name || "room"}`}>Remove room</button>
            </div>
            <ul className="flex flex-col gap-2">
              {room.beds.map((bed, k) => (
                <li key={k} className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`bed-${i}-${k}-count`}>Number of beds</label>
                  <select id={`bed-${i}-${k}-count`} value={bed.count} onChange={(e) => update(i, { ...room, beds: room.beds.map((b, m) => (m === k ? { ...b, count: Number(e.target.value) } : b)) })} className={`${inputClass} w-20`}>
                    {Array.from({ length: 10 }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <label className="sr-only" htmlFor={`bed-${i}-${k}-type`}>Bed type</label>
                  <select id={`bed-${i}-${k}-type`} value={bed.type} onChange={(e) => update(i, { ...room, beds: room.beds.map((b, m) => (m === k ? { ...b, type: e.target.value as BedType } : b)) })} className={`${inputClass} min-w-56 flex-1`}>
                    {BED_TYPE_KEYS.map((t) => <option key={t} value={t}>{BED_TYPES[t].label}</option>)}
                  </select>
                  {room.beds.length > 1 ? (
                    <button type="button" onClick={() => update(i, { ...room, beds: room.beds.filter((_, m) => m !== k) })} className={buttonClass("ghost")} aria-label="Remove this bed">Remove</button>
                  ) : null}
                </li>
              ))}
            </ul>
            {room.beds.length < 8 ? (
              <button type="button" onClick={() => update(i, { ...room, beds: [...room.beds, { type: "twin", count: 1 }] })} className="self-start text-sm font-semibold text-brand underline underline-offset-4">+ Add another bed type</button>
            ) : null}
          </li>
        ))}
      </ol>
      {rooms.length < 20 ? <button type="button" onClick={addRoom} className={buttonClass("secondary", "self-start")}>+ Add a room</button> : null}
      {rooms.length ? (
        <p className="text-sm text-ink-muted">
          These beds sleep {capacity}.{maxGuests && capacity < maxGuests ? ` Your listing says it sleeps ${maxGuests}; add beds or lower "Sleeps" so guests aren't surprised.` : ""}
        </p>
      ) : null}
      {error?.length ? <p className="text-sm font-medium text-danger">{error[0]}</p> : null}
    </div>
  );
}
