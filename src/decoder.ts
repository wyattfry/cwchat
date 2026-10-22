import { decodeSequence } from './morse';

/** Decoder thresholds in units, from the first-release specification. */
export const DAH_MIN_UNITS = 2;
export const LETTER_GAP_UNITS = 2;
export const WORD_GAP_UNITS = 5;

export type DecodedItem =
  | { kind: 'char'; code: string; text: string | null }
  | { kind: 'space' };

export type DecoderEvent =
  | { type: 'letter'; text: string | null; code: string }
  | { type: 'word'; word: string };

export const UNRECOGNIZED = '□';

/** Weight of each new press in the adaptive dit and dah averages. */
export const ADAPT_RATE = 0.25;
/** Adaptive estimates stay within this factor of the speed setting. */
export const ADAPT_RANGE = 2;

/** Splits decoded text into runs of known text and single unrecognized markers, for display. */
export function splitUnrecognized(text: string): string[] {
  return text.split(new RegExp(`(${UNRECOGNIZED})`)).filter(Boolean);
}

/**
 * Turns key-down/key-up timestamps (ms) into letters and words.
 * Time only moves forward through keyDown, keyUp, and update; callers supply timestamps.
 */
export class Decoder {
  private items: DecodedItem[] = [];
  private pending = '';
  private downAt: number | null = null;
  private lastUp: number | null = null;
  private pauseStart: number | null = null;
  private _adaptive: boolean;
  private baseUnit = Number.NaN;
  private ditMs = 0;
  private dahMs = 0;

  /**
   * With `adaptive`, the decoder follows the learner's rhythm: it keeps running averages of
   * dit and dah lengths, splits dits from dahs midway between them, and scales the letter and
   * word gaps from the resulting unit. The averages restart whenever the speed setting changes.
   */
  constructor(
    private readonly getUnitMs: () => number,
    options: { adaptive?: boolean } = {},
  ) {
    this._adaptive = options.adaptive ?? false;
  }

  get adaptive(): boolean {
    return this._adaptive;
  }

  set adaptive(value: boolean) {
    this._adaptive = value;
    this.baseUnit = Number.NaN;
  }

  /** The unit in ms the decoder is currently using. */
  get unitMs(): number {
    const base = this.syncBase();
    return this._adaptive ? (this.ditMs + this.dahMs / 3) / 2 : base;
  }

  private get dahThresholdMs(): number {
    const base = this.syncBase();
    return this._adaptive ? (this.ditMs + this.dahMs) / 2 : DAH_MIN_UNITS * base;
  }

  private syncBase(): number {
    const base = this.getUnitMs();
    if (base !== this.baseUnit) {
      this.baseUnit = base;
      this.ditMs = base;
      this.dahMs = 3 * base;
    }
    return base;
  }

  private learn(held: number, isDah: boolean): void {
    const base = this.syncBase();
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    if (isDah) {
      this.dahMs = clamp(this.dahMs + ADAPT_RATE * (held - this.dahMs), (3 * base) / ADAPT_RANGE, 3 * base * ADAPT_RANGE);
    } else {
      this.ditMs = clamp(this.ditMs + ADAPT_RATE * (held - this.ditMs), base / ADAPT_RANGE, base * ADAPT_RANGE);
    }
    // Keep dahs clearly longer than dits so the split point cannot collapse.
    this.dahMs = Math.max(this.dahMs, 2 * this.ditMs);
  }

  get isKeyDown(): boolean {
    return this.downAt !== null;
  }

  /** Elements keyed for the letter in progress, e.g. ".-". */
  get pendingElements(): string {
    return this.pending;
  }

  /** When the current pause began (last key-up), until the next key-down; otherwise null. */
  get pauseStartedAt(): number | null {
    return this.pauseStart;
  }

  get text(): string {
    return this.items
      .map((item) => (item.kind === 'space' ? ' ' : (item.text ?? UNRECOGNIZED)))
      .join('');
  }

  get hasUnrecognized(): boolean {
    return this.items.some((item) => item.kind === 'char' && item.text === null);
  }

  keyDown(t: number): DecoderEvent[] {
    if (this.downAt !== null) return [];
    const events = this.update(t);
    this.downAt = t;
    this.pauseStart = null;
    return events;
  }

  keyUp(t: number): DecoderEvent[] {
    if (this.downAt === null) return [];
    const held = t - this.downAt;
    const isDah = held >= this.dahThresholdMs;
    this.pending += isDah ? '-' : '.';
    if (this._adaptive) this.learn(held, isDah);
    this.downAt = null;
    this.lastUp = t;
    this.pauseStart = t;
    return [];
  }

  /** Applies any letter or word gaps that have elapsed by time t. */
  update(t: number): DecoderEvent[] {
    if (this.downAt !== null || this.lastUp === null) return [];
    const events: DecoderEvent[] = [];
    const gap = t - this.lastUp;
    const unit = this.unitMs;
    if (this.pending && gap >= LETTER_GAP_UNITS * unit) {
      const text = decodeSequence(this.pending);
      this.items.push({ kind: 'char', code: this.pending, text });
      events.push({ type: 'letter', text, code: this.pending });
      this.pending = '';
    }
    if (!this.pending && gap >= WORD_GAP_UNITS * unit && this.wordOpen()) {
      events.push({ type: 'word', word: this.currentWord() });
      this.items.push({ kind: 'space' });
      this.lastUp = null;
    }
    return events;
  }

  /**
   * Removes the pending elements, or else the last decoded letter. If that letter's word had
   * already ended, the word stays ended, so the next letter keyed starts a new word. Inside a
   * word still being keyed, the next letter continues it.
   */
  undo(): void {
    this.downAt = null;
    this.lastUp = null;
    this.pauseStart = null;
    if (this.pending) {
      this.pending = '';
      return;
    }
    const wordEnded = this.items.at(-1)?.kind === 'space';
    while (this.items.at(-1)?.kind === 'space') this.items.pop();
    this.items.pop();
    if (wordEnded && this.items.at(-1)?.kind === 'char') this.items.push({ kind: 'space' });
  }

  clear(): void {
    this.items = [];
    this.pending = '';
    this.downAt = null;
    this.lastUp = null;
    this.pauseStart = null;
  }

  private wordOpen(): boolean {
    return this.items.at(-1)?.kind === 'char';
  }

  private currentWord(): string {
    let word = '';
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.kind === 'space') break;
      word = (item.text ?? UNRECOGNIZED) + word;
    }
    return word;
  }
}
