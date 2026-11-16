const SMALL_WORDS = new Set(["of", "the", "and", "on", "in", "at", "by", "upon"]);

/**
 * Tidies a town name typed in any case: "gulf shores" / "GULF SHORES" → "Gulf Shores",
 * "lake of the ozarks" → "Lake of the Ozarks", "st. george" → "St. George", "winston-salem" → "Winston-Salem".
 * Words the owner typed in mixed case ("McAllen", "DeFuniak") are left alone, so deliberate spellings survive.
 */
export function formatTown(input: string): string {
  const words = input.trim().replace(/\s+/g, " ").split(" ");
  return words
    .map((word, i) => {
      if (!word || (word !== word.toLowerCase() && word !== word.toUpperCase())) return word;
      const lower = word.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.replace(/(^|[-'.])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
    })
    .join(" ");
}

/** State or region: two-letter codes become capitals ("al" → "AL"); full names are tidied like towns ("missouri" → "Missouri"). */
export function formatRegion(input: string): string {
  const v = input.trim().replace(/\s+/g, " ");
  return /^\p{L}{2}$/u.test(v) ? v.toUpperCase() : formatTown(v);
}
