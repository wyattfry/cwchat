import { LETTER_GAP_UNITS, WORD_GAP_UNITS } from './decoder';

/** The meter spans a standard word gap (7 units), so both thresholds are visible. */
export const METER_UNITS = 7;

export type PauseStage = 'inside-letter' | 'letter-gap' | 'word-gap';

export interface PauseProgress {
  /** Pause length in units. */
  units: number;
  /** Meter fill from 0 to 1. */
  fraction: number;
  stage: PauseStage;
}

/** Describes how far a pause has progressed toward the letter and word gaps. */
export function pauseProgress(elapsedMs: number, unitMs: number): PauseProgress {
  const units = Math.max(0, elapsedMs / unitMs);
  const stage: PauseStage =
    units >= WORD_GAP_UNITS ? 'word-gap' : units >= LETTER_GAP_UNITS ? 'letter-gap' : 'inside-letter';
  return { units, fraction: Math.min(1, units / METER_UNITS), stage };
}

/** Marker positions on the meter, as fractions of its width. */
export const METER_MARKS = {
  letter: LETTER_GAP_UNITS / METER_UNITS,
  word: WORD_GAP_UNITS / METER_UNITS,
} as const;
