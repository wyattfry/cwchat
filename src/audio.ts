import { chimeDuration, chimeNotes, cueNotes, incomingNotes, INCOMING_PAUSE_S, type ChimeNote } from './chime';
import { codeToSegments, textToSegments, type ToneSegment } from './morse';

const SIDETONE_HZ = 600;
const STATION_HZ = 700;
const LEVEL = 0.25;
/** Delay between scheduling station audio and its first tone. */
export const PLAYBACK_LEAD_MS = 100;
/** Start offset of the cue sounds after they are requested, in seconds. */
const NOTES_LEAD_S = 0.05;
/** Delay before a station transmission's first element: the incoming cue plus a pause. */
export const STATION_LEAD_MS = Math.round((NOTES_LEAD_S + chimeDuration(incomingNotes()) + INCOMING_PAUSE_S) * 1000);

/** Sidetone for the learner's key and scheduled Morse playback for station messages. */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sidetone: GainNode | null = null;
  private playback: { osc: OscillatorNode; gain: GainNode; timer: number; resolve: () => void } | null = null;
  muted = false;

  /** Must be called from a user gesture so the browser allows sound. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      const osc = this.ctx.createOscillator();
      osc.frequency.value = SIDETONE_HZ;
      this.sidetone = this.ctx.createGain();
      this.sidetone.gain.value = 0;
      osc.connect(this.sidetone).connect(this.ctx.destination);
      osc.start();
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  get ready(): boolean {
    return this.ctx?.state === 'running';
  }

  setKey(down: boolean): void {
    if (!this.ctx || !this.sidetone) return;
    const target = down && !this.muted ? LEVEL : 0;
    const now = this.ctx.currentTime;
    // Hard on and off, like a keyed transmitter.
    this.sidetone.gain.cancelScheduledValues(now);
    this.sidetone.gain.setValueAtTime(target, now);
  }

  /** Browser-reported delay from scheduling a sound to hearing it, in seconds, if known. */
  get outputDelaySeconds(): number | undefined {
    if (!this.ctx) return undefined;
    const output = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency;
    return (this.ctx.baseLatency ?? 0) + (output ?? 0);
  }

  get playing(): boolean {
    return this.playback !== null;
  }

  /** Plays text as Morse at the given unit length; resolves when finished or stopped. */
  play(text: string, unitMs: number): Promise<void> {
    return this.playSegments(textToSegments(text), unitMs);
  }

  /** Plays a station transmission: the incoming cue, a short pause, then the Morse. */
  playStation(text: string, unitMs: number): Promise<void> {
    const done = this.playSegments(textToSegments(text), unitMs, STATION_LEAD_MS);
    this.playNotes(incomingNotes());
    return done;
  }

  /** Plays one character's code, such as a run-together prosign. */
  playCode(code: string, unitMs: number): Promise<void> {
    return this.playSegments(codeToSegments(code), unitMs);
  }

  private playSegments(
    { segments, totalUnits }: { segments: ToneSegment[]; totalUnits: number },
    unitMs: number,
    leadMs = PLAYBACK_LEAD_MS,
  ): Promise<void> {
    this.stop();
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve();
    const unit = unitMs / 1000;
    const osc = ctx.createOscillator();
    osc.frequency.value = STATION_HZ;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    const t0 = ctx.currentTime + leadMs / 1000;
    for (const seg of segments) {
      const start = t0 + seg.start * unit;
      const end = start + seg.length * unit;
      gain.gain.setValueAtTime(LEVEL, start);
      gain.gain.setValueAtTime(0, end);
    }
    osc.start(t0);
    osc.stop(t0 + totalUnits * unit + 0.05);
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => this.stop(), (leadMs / 1000 + totalUnits * unit + 0.05) * 1000);
      this.playback = { osc, gain, timer, resolve };
    });
  }

  /** Plays a short, quiet completion chime. */
  playChime(): void {
    this.playNotes(chimeNotes());
  }

  /** Plays a brief cue when a new message for the learner to send appears. */
  playCue(): void {
    this.playNotes(cueNotes());
  }

  /** Plays notes on one sine oscillator, keyed on and off instantly, one note at a time. */
  private playNotes(notes: ChimeNote[]): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + NOTES_LEAD_S;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    for (const note of notes) {
      const start = t0 + note.start;
      osc.frequency.setValueAtTime(note.frequency, start);
      gain.gain.setValueAtTime(note.peak, start);
      gain.gain.setValueAtTime(0, start + note.length);
    }
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + chimeDuration(notes) + 0.02);
    osc.onended = () => gain.disconnect();
  }

  stop(): void {
    const p = this.playback;
    if (!p) return;
    this.playback = null;
    window.clearTimeout(p.timer);
    try {
      p.osc.stop();
    } catch {
      // Already stopped.
    }
    p.osc.disconnect();
    p.gain.disconnect();
    p.resolve();
  }
}
