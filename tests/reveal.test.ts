import { describe, expect, it } from 'vitest';
import { textToSegments } from '../src/morse';
import { revealTimeline, visibleText } from '../src/reveal';

describe('revealTimeline', () => {
  it('times each letter at the end of its last element', () => {
    // E = 1 unit; letter gap 3; T = 3 units -> E done at 1, T done at 7
    expect(revealTimeline('ET')).toEqual({ text: 'ET', times: [1, 7], totalUnits: 7 });
  });

  it('shows a space together with the next word', () => {
    // E (1) + word gap 7 + E (1) = 9
    expect(revealTimeline('E E')).toEqual({ text: 'E E', times: [1, 9, 9], totalUnits: 9 });
  });

  it('matches the audio timing for script messages', () => {
    const message = 'N0CALL DE K0DEMO UR RST 579 NAME SAM QTH OHIO K';
    const timeline = revealTimeline(message);
    const { segments, totalUnits } = textToSegments(message);
    expect(timeline.totalUnits).toBe(totalUnits);
    expect(timeline.times.at(-1)).toBe(segments.at(-1)!.start + segments.at(-1)!.length);
    expect(timeline.text).toBe(message);
  });

  it('normalizes case and spacing', () => {
    expect(revealTimeline('  cq   de k0demo ').text).toBe('CQ DE K0DEMO');
  });
});

describe('visibleText', () => {
  const timeline = revealTimeline('CQ DE');

  it('shows nothing before the first letter is complete', () => {
    expect(visibleText(timeline, 0)).toBe('');
    expect(visibleText(timeline, timeline.times[0] - 0.01)).toBe('');
  });

  it('reveals letters as they finish', () => {
    expect(visibleText(timeline, timeline.times[0])).toBe('C');
    expect(visibleText(timeline, timeline.times[1])).toBe('CQ');
  });

  it('does not show a trailing space during the word gap', () => {
    expect(visibleText(timeline, timeline.times[1] + 6)).toBe('CQ');
    expect(visibleText(timeline, timeline.times[3])).toBe('CQ D');
  });

  it('shows the full text when finished', () => {
    expect(visibleText(timeline, timeline.totalUnits)).toBe('CQ DE');
    expect(visibleText(timeline, Infinity)).toBe('CQ DE');
  });
});
