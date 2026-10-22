import { checkMessage, type CheckResult } from './check';
import { Decoder, type DecoderEvent } from './decoder';
import { IambicKeyer, type KeyEdge, type Paddle } from './keyer';
import { CONVERSATIONS, type Conversation } from './conversations';
import { randomSeed } from './randoms';
import { buildScript, DEFAULT_CALL, DEFAULT_NAME, type ScriptLine } from './script';

/** Contact runs the scripted conversation; practice only decodes the learner's keying. */
export type Activity = 'contact' | 'practice';

export type SessionEvent =
  | { type: 'key'; down: boolean; t: number }
  | { type: 'letter'; text: string | null }
  | { type: 'station'; line: ScriptLine }
  | { type: 'accepted'; line: ScriptLine }
  | { type: 'rejected'; result: CheckResult }
  | { type: 'complete' }
  /** A closing K or SK was keyed; the message sends after a short wait unless keying continues. */
  | { type: 'over' }
  | { type: 'over-cancelled' };

/** Words that end a message: K (over), BK (back to you, in quick exchanges), and SK (end of contact). */
const SEND_WORDS = new Set(['K', 'BK', 'SK']);

/** How long to wait after the word gap that ends a closing K or SK before sending, in units. */
export const SEND_DELAY_UNITS = 10;

/** Contact state: keying, decoding, sending on a closing K or SK, and turn progression. */
export class ContactSession {
  readonly decoder: Decoder;
  private readonly keyer: IambicKeyer;
  private script: ScriptLine[];
  private _myCall: string;
  private _myName: string;
  /** Seed for this contact's random values; new on each start. */
  private seed = 0;
  private _conversation: Conversation;
  private straightHeld = false;
  private _activity: Activity = 'contact';
  private _started = false;
  private _complete = false;
  private _transcript: ScriptLine[] = [];
  private turn = 0;
  private _lastResult: CheckResult | null = null;
  private sendAt: number | null = null;

  constructor(
    getUnitMs: () => number,
    myCall: string = DEFAULT_CALL,
    conversation: Conversation = CONVERSATIONS[0],
    myName: string = DEFAULT_NAME,
  ) {
    this.decoder = new Decoder(getUnitMs, { adaptive: true });
    this.keyer = new IambicKeyer(getUnitMs);
    this._myCall = myCall;
    this._conversation = conversation;
    this._myName = myName;
    this.script = this.build();
  }

  get myCall(): string { return this._myCall; }
  get myName(): string { return this._myName; }
  get conversation(): Conversation { return this._conversation; }
  get stationCall(): string { return this._conversation.station; }
  get activity(): Activity { return this._activity; }
  get started(): boolean { return this._started; }
  get complete(): boolean { return this._complete; }
  get transcript(): readonly ScriptLine[] { return this._transcript; }
  get lastResult(): CheckResult | null { return this._lastResult; }
  get lines(): readonly ScriptLine[] { return this.script; }

  /** The learner line currently expected, or null before Start or after completion. */
  get currentTarget(): ScriptLine | null {
    return this._started && !this._complete ? this.script[this.turn] : null;
  }

  /**
   * Switches between the scripted contact and free practice. Either way the contact
   * is reset to its not-started state and the decoder is cleared.
   */
  setActivity(activity: Activity): void {
    this.sendAt = null;
    this._activity = activity;
    this._started = false;
    this._complete = false;
    this._transcript = [];
    this._lastResult = null;
    this.decoder.clear();
  }

  /** Starts the contact from the top with fresh random values (or a given seed, for tests). */
  start(seed: number = randomSeed()): SessionEvent[] {
    this.seed = seed;
    this.script = this.build();
    this.sendAt = null;
    this._activity = 'contact';
    this._started = true;
    this._complete = false;
    this._lastResult = null;
    this.decoder.clear();
    this._transcript = [];
    this.turn = 0;
    return this.advance();
  }

  /** Reveals station messages up to the learner's next turn, and completes at the end. */
  private advance(): SessionEvent[] {
    const events: SessionEvent[] = [];
    while (this.script[this.turn]?.speaker === 'station') {
      const line = this.script[this.turn];
      this._transcript.push(line);
      this.turn += 1;
      events.push({ type: 'station', line });
    }
    if (this.turn >= this.script.length) {
      this._complete = true;
      events.push({ type: 'complete' });
    }
    return events;
  }

  private build(): ScriptLine[] {
    return buildScript(this._conversation, this._myCall, this._myName, this.seed);
  }

  /** Switches to another conversation, back at its Start screen. */
  setConversation(conversation: Conversation): void {
    this._conversation = conversation;
    this.script = this.build();
    this.setActivity('contact');
  }

  /**
   * Sets the learner's call sign without restarting. The current target and later messages
   * use the new call sign; messages already in the transcript keep the one they were sent with.
   */
  setCallSign(call: string): void {
    this._myCall = call;
    this.script = this.build();
  }

  /** Sets the learner's name without restarting, like setCallSign. */
  setName(name: string): void {
    this._myName = name;
    this.script = this.build();
  }

  /**
   * Straight key and paddles are both always available. Whichever starts first keeps the
   * line until it is released; input from the other is ignored meanwhile.
   */
  straightDown(t: number): SessionEvent[] {
    const events = this.applyEdges(this.keyer.update(t));
    if (this.straightHeld || this.keyer.active) return events;
    this.straightHeld = true;
    return events.concat(this.applyEdges([{ type: 'down', t }]));
  }

  straightUp(t: number): SessionEvent[] {
    if (!this.straightHeld) return [];
    this.straightHeld = false;
    return this.applyEdges([{ type: 'up', t }]);
  }

  paddlePress(paddle: Paddle, t: number): SessionEvent[] {
    if (this.straightHeld) return [];
    return this.applyEdges(this.keyer.press(paddle, t));
  }

  paddleRelease(paddle: Paddle, t: number): SessionEvent[] {
    return this.applyEdges(this.keyer.release(paddle, t));
  }

  /** Releases any held key, e.g. when the window loses focus. */
  releaseAll(t: number): SessionEvent[] {
    this.straightHeld = false;
    const edges = this.keyer.reset(t);
    if (this.decoder.isKeyDown && edges.length === 0) edges.push({ type: 'up', t });
    return this.applyEdges(edges);
  }

  update(t: number): SessionEvent[] {
    const events = this.applyEdges(this.keyer.update(t));
    events.push(...this.handleDecoder(this.decoder.update(t), t));
    return events.concat(this.flushSend(t));
  }

  /** True while a closing K or SK is waiting to send. */
  get overPending(): boolean {
    return this.sendAt !== null;
  }

  undo(): void {
    this.sendAt = null;
    this.decoder.undo();
  }

  clear(): void {
    this.sendAt = null;
    this.decoder.clear();
    this._lastResult = null;
  }

  private applyEdges(edges: KeyEdge[]): SessionEvent[] {
    const events: SessionEvent[] = [];
    for (const edge of edges) {
      events.push(...this.flushSend(edge.t));
      const decoded = edge.type === 'down' ? this.decoder.keyDown(edge.t) : this.decoder.keyUp(edge.t);
      events.push(...this.handleDecoder(decoded, edge.t));
      if (edge.type === 'down' && this.sendAt !== null) {
        // Keying again before the wait ends means the message is not finished.
        this.sendAt = null;
        events.push({ type: 'over-cancelled' });
      }
      events.push({ type: 'key', down: edge.type === 'down', t: edge.t });
    }
    return events;
  }

  private handleDecoder(decoded: DecoderEvent[], t: number): SessionEvent[] {
    const events: SessionEvent[] = [];
    for (const event of decoded) {
      if (event.type === 'letter') {
        events.push({ type: 'letter', text: event.text });
      } else if (SEND_WORDS.has(event.word) && this.currentTarget && this.wordCount() > 1) {
        // A lone K is more likely the start of a call sign than a finished message.
        this.sendAt = t + SEND_DELAY_UNITS * this.decoder.unitMs;
        events.push({ type: 'over' });
      }
    }
    return events;
  }

  private wordCount(): number {
    return this.decoder.text.trim().split(/\s+/).filter(Boolean).length;
  }

  private flushSend(t: number): SessionEvent[] {
    if (this.sendAt === null || t < this.sendAt) return [];
    this.sendAt = null;
    return this.send();
  }

  private send(): SessionEvent[] {
    const target = this.currentTarget;
    if (!target) return [];
    const result = checkMessage(this.decoder.text, target.sent);
    this._lastResult = result;
    if (!result.ok) return [{ type: 'rejected', result }];

    const events: SessionEvent[] = [{ type: 'accepted', line: target }];
    this._transcript.push(target);
    this.decoder.clear();
    this._lastResult = null;
    this.turn += 1;
    return events.concat(this.advance());
  }
}
