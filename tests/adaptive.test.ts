import { describe, expect, it } from 'vitest';
import { ADAPT_RANGE, Decoder } from '../src/decoder';
import { MORSE } from '../src/morse';

const TEXT = 'CQ CQ DE N0CALL N0CALL K';

/** Keys text with ideal proportions while the unit drifts linearly from `from` to `to` ms. */
function keyDrifting(d: Decoder, text: string, from: number, to: number): number {
  const letters = [...text].filter((c) => c !== ' ').length;
  let t = 0;
  let index = 0;
  const words = text.split(' ');
  words.forEach((word, wi) => {
    [...word].forEach((ch, ci) => {
      const u = from + ((to - from) * index) / Math.max(1, letters - 1);
      if (wi > 0 && ci === 0) t += 7 * u;
      else if (ci > 0) t += 3 * u;
      [...MORSE[ch]].forEach((el, ei) => {
        if (ei > 0) t += u;
        d.keyDown(t);
        t += (el === '-' ? 3 : 1) * u;
        d.keyUp(t);
      });
      index++;
    });
  });
  d.update(t + 10 * to);
  return t;
}

describe('adaptive decoding', () => {
  it('follows a learner who speeds up from 12 to 20 WPM', () => {
    const fixed = new Decoder(() => 100);
    keyDrifting(fixed, TEXT, 100, 60);
    expect(fixed.text.trim()).not.toBe(TEXT);

    const adaptive = new Decoder(() => 100, { adaptive: true });
    keyDrifting(adaptive, TEXT, 100, 60);
    expect(adaptive.text.trim()).toBe(TEXT);
    expect(adaptive.unitMs).toBeLessThan(75);
  });

  it('follows a learner who slows down from 12 to 7 WPM', () => {
    const fixed = new Decoder(() => 100);
    keyDrifting(fixed, TEXT, 100, 171);
    expect(fixed.text.trim()).not.toBe(TEXT);

    const adaptive = new Decoder(() => 100, { adaptive: true });
    keyDrifting(adaptive, TEXT, 100, 171);
    expect(adaptive.text.trim()).toBe(TEXT);
    expect(adaptive.unitMs).toBeGreaterThan(140);
  });

  it('decodes steady keying exactly like the fixed decoder', () => {
    const adaptive = new Decoder(() => 100, { adaptive: true });
    keyDrifting(adaptive, TEXT, 100, 100);
    expect(adaptive.text.trim()).toBe(TEXT);
    expect(adaptive.unitMs).toBeCloseTo(100);
  });

  it('keeps one long outlier press from turning later dits into dahs', () => {
    const d = new Decoder(() => 100, { adaptive: true });
    let t = 0;
    const press = (len: number) => {
      d.keyDown(t);
      t += len;
      d.keyUp(t);
      t += 100;
    };
    press(900); // a stuck key
    press(100);
    press(100);
    expect(d.pendingElements).toBe('-..');
  });

  it('stays within the allowed range of the speed setting', () => {
    const d = new Decoder(() => 100, { adaptive: true });
    let t = 0;
    for (let i = 0; i < 40; i++) {
      d.keyDown(t);
      t += 20; // far faster than the setting allows
      d.keyUp(t);
      t += 20;
    }
    expect(d.unitMs).toBeGreaterThanOrEqual(100 / ADAPT_RANGE - 1e-9);
  });

  it('restarts its estimate when the speed setting changes', () => {
    let unit = 100;
    const d = new Decoder(() => unit, { adaptive: true });
    keyDrifting(d, 'EEEE', 70, 70);
    expect(d.unitMs).toBeLessThan(100);
    unit = 150;
    expect(d.unitMs).toBe(150);
  });

  it('uses the speed setting when adaptation is turned off', () => {
    const d = new Decoder(() => 100, { adaptive: true });
    keyDrifting(d, 'EEEE', 70, 70);
    d.adaptive = false;
    expect(d.unitMs).toBe(100);
  });
});
