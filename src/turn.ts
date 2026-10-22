/** Pause between the learner's message appearing in the log and the station's reply appearing. */
export const REPLY_PAUSE_MS = 700;

/** Seconds counted down before a conversation that the station opens. */
export const COUNTDOWN_SECONDS = 3;

/** Pause between the end of a station message and the learner's turn (target and cue). */
export const TURN_PAUSE_MS = 800;

/**
 * Tracks which station messages the learner has heard, so the target appears only after the
 * latest one. A message that plays to the end opens the turn after a short pause; one that is
 * cut off opens it at once.
 */
export class TurnGate {
  private shown = -1;
  private pending: { index: number; at: number } | null = null;

  /** Index of the latest station message the learner's turn has opened after. */
  get shownThrough(): number {
    return this.shown;
  }

  reset(): void {
    this.shown = -1;
    this.pending = null;
  }

  /** A station message played to the end at `now`; the turn opens after the pause. */
  finished(index: number, now: number, pauseMs = TURN_PAUSE_MS): void {
    if (index <= this.shown) return;
    this.pending = { index, at: now + pauseMs };
  }

  /** A station message was cut off; the turn opens immediately. */
  openNow(index: number): void {
    this.shown = Math.max(this.shown, index);
    this.pending = null;
  }

  /** Opens a pending turn once its pause has passed. Returns true when something changed. */
  tick(now: number): boolean {
    if (!this.pending || now < this.pending.at) return false;
    this.shown = Math.max(this.shown, this.pending.index);
    this.pending = null;
    return true;
  }
}
