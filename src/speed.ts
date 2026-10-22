import { DAH_MIN_UNITS, LETTER_GAP_UNITS } from './decoder';
import { unitMs } from './morse';

export interface Press {
  down: number;
  up: number;
}

export const BENCHMARK = 'SOS';
export const BENCHMARK_ELEMENTS = '...---...';
export const MIN_WPM = 5;
export const MAX_WPM = 20;

export type SpeedEstimate =
  | { ok: true; wpm: number; /** True when the measured speed was outside 5–20 WPM. */ clamped: boolean }
  | { ok: false; reason: string };

/**
 * Estimates keying speed from one SOS (··· −−− ···), keyed as letters or as one run-together
 * character. Picks the whole WPM, within the speed range, closest to the learner's average rhythm
 * at which every dit, dah, and pause inside a letter decodes correctly.
 */
export function estimateSpeed(presses: readonly Press[]): SpeedEstimate {
  if (presses.length !== BENCHMARK_ELEMENTS.length) {
    return { ok: false, reason: `Key SOS as three short, three long, three short presses (${presses.length} received).` };
  }
  const durations = presses.map((p) => p.up - p.down);
  const dits = durations.filter((_, i) => BENCHMARK_ELEMENTS[i] === '.');
  const dahs = durations.filter((_, i) => BENCHMARK_ELEMENTS[i] === '-');
  if (Math.min(...dahs) <= Math.max(...dits)) {
    return { ok: false, reason: 'Make the three middle presses (dahs) clearly longer than the short ones (dits).' };
  }
  // Pauses after the 3rd and 6th presses may be letter gaps, so only pauses inside letters count.
  const innerGaps = presses
    .slice(1)
    .map((p, i) => ({ gap: p.down - presses[i].up, index: i }))
    .filter(({ index }) => index !== 2 && index !== 5)
    .map(({ gap }) => gap);

  const measuredUnit = (sum(dits) + sum(dahs) / 3) / (dits.length + dahs.length);
  const measuredWpm = 1200 / measuredUnit;
  const fits = (wpm: number): boolean => {
    const unit = unitMs(wpm);
    return (
      Math.max(...dits) < DAH_MIN_UNITS * unit &&
      Math.min(...dahs) >= DAH_MIN_UNITS * unit &&
      Math.max(...innerGaps) < LETTER_GAP_UNITS * unit
    );
  };
  const candidates: number[] = [];
  for (let wpm = MIN_WPM; wpm <= MAX_WPM; wpm++) candidates.push(wpm);
  candidates.sort((a, b) => Math.abs(a - measuredWpm) - Math.abs(b - measuredWpm));
  const wpm = candidates.find(fits);
  if (wpm !== undefined) {
    return { ok: true, wpm, clamped: measuredWpm < MIN_WPM - 0.5 || measuredWpm > MAX_WPM + 0.5 };
  }
  if (measuredWpm > MAX_WPM) {
    return { ok: false, reason: `That was faster than ${MAX_WPM} WPM, the fastest setting. Try a little slower.` };
  }
  return { ok: false, reason: 'Keep the pauses between dits and dahs inside a letter shorter than a dah.' };
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Collects straight-key presses for one SOS and estimates speed once all nine are in. */
export class SpeedDetector {
  private presses: Press[] = [];
  private downAt: number | null = null;

  /** Number of presses collected so far. */
  get count(): number {
    return this.presses.length;
  }

  keyDown(t: number): void {
    if (this.downAt === null) this.downAt = t;
  }

  /** Records a press; returns an estimate after the ninth, then starts over. */
  keyUp(t: number): SpeedEstimate | null {
    if (this.downAt === null) return null;
    this.presses.push({ down: this.downAt, up: t });
    this.downAt = null;
    if (this.presses.length < BENCHMARK_ELEMENTS.length) return null;
    const estimate = estimateSpeed(this.presses);
    this.presses = [];
    return estimate;
  }
}

/** The standard word for measuring Morse speed: one PARIS is exactly 50 units including its word gap. */
export const REFERENCE_WORD = 'PARIS';

/** What Listen plays: the learner's current target when there is one, otherwise the reference word twice. */
export function listenText(target: string | null | undefined): string {
  return target?.trim() || `${REFERENCE_WORD} ${REFERENCE_WORD}`;
}

/** Heading for the collapsed speed settings, including the followed speed when it differs. */
export function speedSummary(wpm: number, followingWpm: number | null): string {
  return followingWpm !== null && followingWpm !== wpm
    ? `Speed: ${wpm} WPM (following you at ${followingWpm})`
    : `Speed: ${wpm} WPM`;
}

/** Steps the speed by `delta` WPM, staying within the speed range. */
export function adjustWpm(wpm: number, delta: number): number {
  return Math.min(MAX_WPM, Math.max(MIN_WPM, wpm + delta));
}

/** Keyboard shortcuts for speed: "-" slows down, "=" (or "+") speeds up. */
export function speedKeyDelta(key: string): number {
  if (key === '-' || key === '_') return -1;
  if (key === '=' || key === '+') return 1;
  return 0;
}
