export type Paddle = 'dit' | 'dah';

export interface KeyEdge {
  type: 'down' | 'up';
  t: number;
}

/**
 * Iambic mode A paddle keyer. Holding both paddles alternates elements, starting with
 * whichever paddle was pressed first. A paddle tapped while an element is sounding is
 * remembered and sent next, so quick taps are not lost.
 */
export class IambicKeyer {
  private held: Record<Paddle, boolean> = { dit: false, dah: false };
  private memory: Record<Paddle, boolean> = { dit: false, dah: false };
  private phase: 'idle' | 'element' | 'space' = 'idle';
  private phaseEnd = 0;
  private current: Paddle = 'dit';

  constructor(private readonly getUnitMs: () => number) {}

  get active(): boolean {
    return this.phase !== 'idle';
  }

  press(paddle: Paddle, t: number): KeyEdge[] {
    if (this.held[paddle]) return [];
    const edges = this.update(t);
    this.held[paddle] = true;
    if (this.phase === 'idle') return [...edges, ...this.startElement(paddle, t)];
    if (this.phase === 'space' || paddle !== this.current) this.memory[paddle] = true;
    return edges;
  }

  release(paddle: Paddle, t: number): KeyEdge[] {
    const edges = this.update(t);
    this.held[paddle] = false;
    return edges;
  }

  /** Advances the keyer to time t, returning key edges at their exact scheduled times. */
  update(t: number): KeyEdge[] {
    const edges: KeyEdge[] = [];
    while (this.phase !== 'idle' && t >= this.phaseEnd) {
      if (this.phase === 'element') {
        edges.push({ type: 'up', t: this.phaseEnd });
        this.phase = 'space';
        this.phaseEnd += this.getUnitMs();
      } else {
        const next = this.nextElement();
        this.memory = { dit: false, dah: false };
        if (next) edges.push(...this.startElement(next, this.phaseEnd));
        else this.phase = 'idle';
      }
    }
    return edges;
  }

  /** Stops immediately; returns a key-up edge if an element was sounding. */
  reset(t: number): KeyEdge[] {
    const wasDown = this.phase === 'element';
    this.held = { dit: false, dah: false };
    this.memory = { dit: false, dah: false };
    this.phase = 'idle';
    return wasDown ? [{ type: 'up', t }] : [];
  }

  private nextElement(): Paddle | null {
    const other: Paddle = this.current === 'dit' ? 'dah' : 'dit';
    if (this.memory[other]) return other;
    if (this.held.dit && this.held.dah) return other;
    if (this.memory[this.current] || this.held[this.current]) return this.current;
    if (this.held[other]) return other;
    return null;
  }

  private startElement(paddle: Paddle, t: number): KeyEdge[] {
    this.current = paddle;
    this.phase = 'element';
    this.phaseEnd = t + (paddle === 'dah' ? 3 : 1) * this.getUnitMs();
    return [{ type: 'down', t }];
  }
}
