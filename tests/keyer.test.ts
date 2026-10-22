import { describe, expect, it } from 'vitest';
import { IambicKeyer, type KeyEdge } from '../src/keyer';
import { Decoder } from '../src/decoder';

const U = 100;
const make = () => new IambicKeyer(() => U);

/** Renders edges as an element string like ".-" assuming exact durations. */
function elements(edges: KeyEdge[]): string {
  let out = '';
  for (let i = 0; i < edges.length; i += 2) {
    out += edges[i + 1].t - edges[i].t >= 2 * U ? '-' : '.';
  }
  return out;
}

describe('IambicKeyer (mode A)', () => {
  it('sends one dit for a quick tap', () => {
    const k = make();
    const edges = [...k.press('dit', 0), ...k.release('dit', 10), ...k.update(1000)];
    expect(edges).toEqual([{ type: 'down', t: 0 }, { type: 'up', t: 100 }]);
    expect(k.active).toBe(false);
  });

  it('sends a 3-unit dah', () => {
    const k = make();
    const edges = [...k.press('dah', 0), ...k.release('dah', 10), ...k.update(1000)];
    expect(edges).toEqual([{ type: 'down', t: 0 }, { type: 'up', t: 300 }]);
  });

  it('repeats a held paddle with 1-unit spacing', () => {
    const k = make();
    const edges = [...k.press('dit', 0), ...k.update(550), ...k.release('dit', 550), ...k.update(2000)];
    // dits start at 0, 200, 400 (held through the decision at 400)
    expect(edges.filter((e) => e.type === 'down').map((e) => e.t)).toEqual([0, 200, 400]);
    expect(elements(edges)).toBe('...');
  });

  it('alternates when both are held, starting with the first pressed', () => {
    const k = make();
    const edges = [
      ...k.press('dah', 0),
      ...k.press('dit', 50),
      ...k.update(1100),
      ...k.release('dah', 1100),
      ...k.release('dit', 1100),
      ...k.update(3000),
    ];
    // dah 0-300, dit 400-500, dah 600-900, dit 1000-1100
    expect(elements(edges)).toBe('-.-.');
  });

  it('continues with the other paddle after one is released', () => {
    const k = make();
    const edges = [
      ...k.press('dit', 0),
      ...k.press('dah', 10),
      ...k.release('dit', 150),
      ...k.update(950),
      ...k.release('dah', 950),
      ...k.update(3000),
    ];
    // dit 0-100, dah 200-500, dah 600-900 (dah still held)
    expect(elements(edges)).toBe('.--');
  });

  it('remembers a quick tap of the other paddle during an element', () => {
    const k = make();
    const edges = [
      ...k.press('dah', 0),
      ...k.release('dah', 50),
      ...k.press('dit', 100),
      ...k.release('dit', 150),
      ...k.update(3000),
    ];
    expect(elements(edges)).toBe('-.');
  });

  it('reset releases an element in progress', () => {
    const k = make();
    k.press('dah', 0);
    expect(k.reset(120)).toEqual([{ type: 'up', t: 120 }]);
    expect(k.update(2000)).toEqual([]);
  });

  it('drives the decoder to the expected letters', () => {
    const k = make();
    const d = new Decoder(() => U);
    const apply = (edges: KeyEdge[]) => edges.forEach((e) => (e.type === 'down' ? d.keyDown(e.t) : d.keyUp(e.t)));
    // Squeeze dah then dit for "-.-." = C
    apply(k.press('dah', 0));
    apply(k.press('dit', 10));
    apply(k.update(1050));
    apply(k.release('dah', 1050));
    apply(k.release('dit', 1050));
    apply(k.update(3000));
    d.update(3000);
    expect(d.text).toBe('C ');
  });
});
