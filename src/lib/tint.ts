const TINTS = ["bg-tint-sage", "bg-tint-sand", "bg-tint-mist"] as const;

/** Placeholder color by position in a list, so neighbors never share a color. */
export function tintAt(index: number): (typeof TINTS)[number] {
  return TINTS[index % TINTS.length]!;
}

/** Stable placeholder color for a listing until real photos exist. */
export function tintFor(key: string): (typeof TINTS)[number] {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length]!;
}
