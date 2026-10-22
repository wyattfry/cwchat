import { textToSegments } from '../src/morse';

export interface Keyable {
  keyDown(t: number): unknown;
  keyUp(t: number): unknown;
}

/** Keys text with ideal timing starting at t0; returns the time of the final key-up. */
export function keyText(target: Keyable, text: string, unit: number, t0 = 0): number {
  const { segments } = textToSegments(text);
  let end = t0;
  for (const seg of segments) {
    target.keyDown(t0 + seg.start * unit);
    end = t0 + (seg.start + seg.length) * unit;
    target.keyUp(end);
  }
  return end;
}

/** Keys a raw element sequence like "...-.-" as a single character. */
export function keyCode(target: Keyable, code: string, unit: number, t0 = 0): number {
  let t = t0;
  [...code].forEach((el, i) => {
    if (i > 0) t += unit;
    target.keyDown(t);
    t += (el === '-' ? 3 : 1) * unit;
    target.keyUp(t);
  });
  return t;
}
