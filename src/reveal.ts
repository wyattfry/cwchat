import { MORSE } from './morse';

export interface RevealTimeline {
  /** Normalized text: uppercase, single spaces, only characters that can be sent. */
  text: string;
  /** For each character in `text`, the unit offset at which it has been fully sent. */
  times: number[];
  /** Total length of the transmission in units. */
  totalUnits: number;
}

/** Times each character's completion using standard timing, matching `textToSegments`. */
export function revealTimeline(text: string): RevealTimeline {
  const words = text
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .map((word) => [...word].filter((ch) => MORSE[ch]).join(''))
    .filter(Boolean);
  const times: number[] = [];
  let t = 0;
  words.forEach((word, wi) => {
    if (wi > 0) {
      t += 7;
      times.push(Infinity); // placeholder for the space; filled below
    }
    [...word].forEach((ch, ci) => {
      if (ci > 0) t += 3;
      [...MORSE[ch]].forEach((el, ei) => {
        if (ei > 0) t += 1;
        t += el === '-' ? 3 : 1;
      });
      times.push(t);
    });
  });
  // A space appears together with the first letter of the next word.
  for (let i = times.length - 1; i >= 0; i--) {
    if (times[i] === Infinity) times[i] = times[i + 1];
  }
  return { text: words.join(' '), times, totalUnits: t };
}

/** The part of the message that has been fully sent after `elapsedUnits`. */
export function visibleText(timeline: RevealTimeline, elapsedUnits: number): string {
  let count = 0;
  while (count < timeline.times.length && timeline.times[count] <= elapsedUnits) count++;
  return timeline.text.slice(0, count);
}
