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

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
const NAME_TO_CODE = new Map(Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]));

const FILLER = new Set(["of", "the", "and", "near", "at", "&"]);

export type DestinationTerm = { kind: "state"; code: string; name: string } | { kind: "word"; text: string };

/**
 * Splits what a guest typed in "Where" into terms that must all match, so "gulf shores, al",
 * "Gulf Shores AL" and "gulf shores alabama" all find a listing in Gulf Shores, AL.
 * A state (full name or two-letter code) matches the listing's state; every other word matches the
 * town, state or listing title. A lone two-letter code that isn't the only term is treated as a state.
 */
export function destinationTerms(input: string): DestinationTerm[] {
  const words = input.toLowerCase().split(/[\s,]+/).filter(Boolean).slice(0, 8);
  const terms: DestinationTerm[] = [];
  for (let i = 0; i < words.length; i++) {
    // Longest state name starting here (up to 3 words, e.g. "district of columbia").
    let matched = false;
    for (let len = Math.min(3, words.length - i); len >= 1; len--) {
      const code = NAME_TO_CODE.get(words.slice(i, i + len).join(" "));
      if (code) {
        terms.push({ kind: "state", code, name: US_STATES[code]! });
        i += len - 1;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const w = words[i]!;
    if (FILLER.has(w)) continue; // "lake of the ozarks" shouldn't require "of" and "the" to match
    const code = w.toUpperCase();
    if (w.length === 2 && US_STATES[code] && words.length > 1) terms.push({ kind: "state", code, name: US_STATES[code]! });
    else terms.push({ kind: "word", text: w });
  }
  return terms;
}

/** Two-letter state code for a listing's state field ("al", "AL", "Alabama" → "AL"); null if it isn't a US state. */
export function stateCode(region: string): string | null {
  const v = region.trim();
  if (/^\p{L}{2}$/u.test(v)) return US_STATES[v.toUpperCase()] ? v.toUpperCase() : null;
  return NAME_TO_CODE.get(v.toLowerCase().replace(/\s+/g, " ")) ?? null;
}
