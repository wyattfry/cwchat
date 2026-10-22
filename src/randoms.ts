import { MORSE } from './morse';

/**
 * Value pools for {RANDOM_<KIND>} placeholders in conversation files. The learner's own QTH
 * (TEXAS) and state (TX) stay fixed in the conversations, so they are left out here.
 */
export const RANDOM_POOLS: Readonly<Record<string, readonly string[]>> = {
  NAME: ['AL', 'ANN', 'BOB', 'DAN', 'DON', 'ED', 'JIM', 'JOE', 'KAY', 'KEN', 'LEE', 'LYN', 'MAX', 'MEG', 'NED', 'RAY', 'ROY', 'SAM', 'SUE', 'TED', 'TOM', 'VAL'],
  QTH: ['OHIO', 'IOWA', 'MAINE', 'IDAHO', 'UTAH', 'OREGON', 'KANSAS', 'NEVADA', 'ALASKA', 'MONTANA', 'VERMONT', 'GEORGIA', 'FLORIDA', 'ARIZONA'],
  STATE: ['CO', 'OH', 'ME', 'IA', 'ID', 'UT', 'OR', 'KS', 'NV', 'AK', 'MT', 'VT', 'GA', 'FL', 'AZ', 'WA', 'NM'],
  RST: ['599', '589', '579', '569', '559', '549', '459', '449'],
  WX: ['SUNNY', 'CLOUDY', 'RAINY', 'WINDY', 'SNOWY', 'FOGGY', 'CLEAR'],
  TEMP: ['WARM', 'COLD', 'HOT', 'MILD', 'COOL'],
  PWR: ['5W', '10W', '20W', '50W', '100W'],
  AGE: ['28', '34', '41', '46', '52', '58', '63', '67', '71', '76'],
  YRS: ['3', '8', '12', '15', '22', '30', '35', '41', '48'],
  // Park references are made up: US- plus a four-digit number.
  PARK: Array.from({ length: 9000 }, (_, i) => `US-${1000 + i}`),
};

/** Matches {RANDOM_KIND} or {RANDOM_KIND_2}; the same token always gets the same value. */
export const RANDOM_PATTERN = /\{RANDOM_([A-Z]+)(?:_(\d+))?\}/g;

/** Small, fast seeded generator (mulberry32), so a contact's values can be reproduced. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}

/** Placeholder kinds used in `text` that have no pool. */
export function unknownRandomKinds(text: string): string[] {
  return [...text.matchAll(RANDOM_PATTERN)].map((m) => m[1]).filter((kind) => !RANDOM_POOLS[kind]);
}

/**
 * Picks a value for every distinct {RANDOM_…} token across `texts`, in order of first
 * appearance. Tokens of the same kind get different values, and values in `exclude`
 * (such as the learner's name) are never picked.
 */
export function resolveRandoms(texts: readonly string[], seed: number, exclude: readonly string[] = []): Map<string, string> {
  const next = seededRandom(seed);
  const values = new Map<string, string>();
  const used = new Map<string, Set<string>>();
  for (const text of texts) {
    for (const match of text.matchAll(RANDOM_PATTERN)) {
      const [token, kind] = match;
      if (values.has(token)) continue;
      const pool = RANDOM_POOLS[kind];
      if (!pool) continue;
      const taken = used.get(kind) ?? new Set<string>();
      const choices = pool.filter((v) => !taken.has(v) && !exclude.includes(v));
      const options = choices.length ? choices : pool;
      const value = options[Math.floor(next() * options.length)];
      values.set(token, value);
      taken.add(value);
      used.set(kind, taken);
    }
  }
  return values;
}

export function fillRandoms(text: string, values: ReadonlyMap<string, string>): string {
  return text.replace(RANDOM_PATTERN, (token) => values.get(token) ?? token);
}

/** True when every value in every pool can be sent in Morse. */
export function poolsAreSendable(): boolean {
  return Object.values(RANDOM_POOLS).every((pool) => pool.every((v) => [...v].every((ch) => MORSE[ch])));
}
