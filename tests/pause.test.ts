import { describe, expect, it } from 'vitest';
import { Decoder } from '../src/decoder';
import { METER_MARKS, pauseProgress } from '../src/pause';

describe('pauseProgress', () => {
  it('moves through the stages at 2 and 5 units', () => {
    expect(pauseProgress(150, 100).stage).toBe('inside-letter');
    expect(pauseProgress(200, 100).stage).toBe('letter-gap');
    expect(pauseProgress(499, 100).stage).toBe('letter-gap');
    expect(pauseProgress(500, 100).stage).toBe('word-gap');
  });

  it('fills over a 7-unit word gap and stops at full', () => {
    expect(pauseProgress(0, 100).fraction).toBe(0);
    expect(pauseProgress(350, 100).fraction).toBeCloseTo(0.5);
    expect(pauseProgress(2000, 100).fraction).toBe(1);
  });

  it('scales with speed', () => {
    expect(pauseProgress(300, 60).stage).toBe('word-gap'); // 20 WPM
    expect(pauseProgress(300, 240).stage).toBe('inside-letter'); // 5 WPM
  });

  it('places the markers at the thresholds', () => {
    expect(METER_MARKS.letter).toBeCloseTo(2 / 7);
    expect(METER_MARKS.word).toBeCloseTo(5 / 7);
  });
});

describe('Decoder.pauseStartedAt', () => {
  it('runs from key-up until the next key-down, including past the word gap', () => {
    const d = new Decoder(() => 100);
    expect(d.pauseStartedAt).toBeNull();
    d.keyDown(0);
    expect(d.pauseStartedAt).toBeNull();
    d.keyUp(100);
    expect(d.pauseStartedAt).toBe(100);
    d.update(400); // letter ended
    d.update(600); // word ended
    expect(d.text).toBe('E ');
    expect(d.pauseStartedAt).toBe(100);
    d.keyDown(900);
    expect(d.pauseStartedAt).toBeNull();
  });

  it('is cleared by undo and clear', () => {
    const d = new Decoder(() => 100);
    d.keyDown(0);
    d.keyUp(100);
    d.undo();
    expect(d.pauseStartedAt).toBeNull();
    d.keyDown(200);
    d.keyUp(300);
    d.clear();
    expect(d.pauseStartedAt).toBeNull();
  });
});
