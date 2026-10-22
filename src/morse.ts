export const MORSE: Readonly<Record<string, string>> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '/': '-..-.', '?': '..--..', '.': '.-.-.-', ',': '--..--', '=': '-...-', '-': '-....-',
};

/** Prosigns are keyed as one run-together character but read as their letters. */
export const PROSIGNS: Readonly<Record<string, string>> = {
  SK: '...-.-',
};

const DECODE: ReadonlyMap<string, string> = new Map([
  ...Object.entries(MORSE).map(([char, code]) => [code, char] as const),
  ...Object.entries(PROSIGNS).map(([text, code]) => [code, text] as const),
]);

/** Returns the text for a Morse code sequence, or null if it is not a known character. */
export function decodeSequence(code: string): string | null {
  return DECODE.get(code) ?? null;
}

/** Splits text into words of letter codes for playback. Unknown characters are skipped. */
export function encodeText(text: string): string[][] {
  return text
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => [...word].map((ch) => MORSE[ch]).filter((code): code is string => !!code));
}

export function unitMs(wpm: number): number {
  return 1200 / wpm;
}

export interface ToneSegment {
  /** Start offset in units. */
  start: number;
  /** Length in units. */
  length: number;
}

/** Converts text into key-down segments using standard timing (1/3/1/3/7 units). */
export function textToSegments(text: string): { segments: ToneSegment[]; totalUnits: number } {
  const segments: ToneSegment[] = [];
  let t = 0;
  encodeText(text).forEach((word, wi) => {
    if (wi > 0) t += 7;
    word.forEach((code, ci) => {
      if (ci > 0) t += 3;
      [...code].forEach((el, ei) => {
        if (ei > 0) t += 1;
        const length = el === '-' ? 3 : 1;
        segments.push({ start: t, length });
        t += length;
      });
    });
  });
  return { segments, totalUnits: t };
}

export type ChartGroup = 'Letters' | 'Numbers' | 'Punctuation' | 'Prosigns';

export interface ChartEntry {
  label: string;
  code: string;
  group: ChartGroup;
}

/** Every character the decoder knows, grouped for a reference chart. */
export function chartEntries(): ChartEntry[] {
  const entries: ChartEntry[] = [];
  for (const [label, code] of Object.entries(MORSE)) {
    const group: ChartGroup = /[A-Z]/.test(label) ? 'Letters' : /\d/.test(label) ? 'Numbers' : 'Punctuation';
    entries.push({ label, code, group });
  }
  for (const [label, code] of Object.entries(PROSIGNS)) entries.push({ label, code, group: 'Prosigns' });
  const order: ChartGroup[] = ['Letters', 'Numbers', 'Punctuation', 'Prosigns'];
  return entries.sort(
    (a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.label.localeCompare(b.label, 'en', { numeric: true }),
  );
}

/** Key-down segments for a single character's code, such as a run-together prosign. */
export function codeToSegments(code: string): { segments: ToneSegment[]; totalUnits: number } {
  const segments: ToneSegment[] = [];
  let t = 0;
  [...code].forEach((el, i) => {
    if (i > 0) t += 1;
    const length = el === '-' ? 3 : 1;
    segments.push({ start: t, length });
    t += length;
  });
  return { segments, totalUnits: t };
}
