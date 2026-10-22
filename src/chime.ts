/**
 * App sounds are radio-like: one sine voice at a time, keyed on and off instantly
 * (0 ms attack and release), with each note ending before the next begins.
 */
export interface ChimeNote {
  /** Frequency in Hz. */
  frequency: number;
  /** Start offset in seconds. */
  start: number;
  /** How long the note sounds, in seconds. */
  length: number;
  /** Gain while sounding, kept low so the sound is subtle. */
  peak: number;
}

/** A short, quiet rising Cmaj7 figure (C5–E5–G5–B5) played when a contact is completed. */
export function chimeNotes(): ChimeNote[] {
  return [523.25, 659.25, 783.99, 987.77].map((frequency, i) => ({
    frequency,
    start: i * 0.11,
    length: i === 3 ? 0.24 : 0.08,
    peak: 0.08,
  }));
}

/**
 * A brief, quiet two-note cue (G5 up to C6, a perfect fourth) played when a new message for the
 * learner to send appears. Shorter and softer than the completion chime.
 */
export function cueNotes(): ChimeNote[] {
  return [783.99, 1046.5].map((frequency, i) => ({
    frequency,
    start: i * 0.12,
    length: 0.08,
    peak: 0.05,
  }));
}

/**
 * Played before every station transmission, including replays: the your-turn cue backwards
 * (C6 down to G5), so the learner can tell when a message is about to start.
 */
export function incomingNotes(): ChimeNote[] {
  const cue = cueNotes();
  return cue.map((note, i) => ({ ...note, frequency: cue[cue.length - 1 - i].frequency }));
}

/** Silence between the incoming cue and the station's first element, in seconds. */
export const INCOMING_PAUSE_S = 0.3;

/** Total length of a sound in seconds. */
export function chimeDuration(notes: ChimeNote[] = chimeNotes()): number {
  return Math.max(...notes.map((n) => n.start + n.length));
}
