import { describe, expect, it } from 'vitest';
import { Decoder } from '../src/decoder';
import { unitMs } from '../src/morse';
import { adjustWpm, BENCHMARK_ELEMENTS, estimateSpeed, listenText, REFERENCE_WORD, SpeedDetector, speedKeyDelta, speedSummary, type Press } from '../src/speed';
import { textToSegments } from '../src/morse';

/** Builds SOS presses from per-element lengths and the gaps after each element (ms). */
function sos(lengths: number[], gaps: number[]): Press[] {
  const presses: Press[] = [];
  let t = 0;
  lengths.forEach((len, i) => {
    presses.push({ down: t, up: t + len });
    t += len + (gaps[i] ?? 0);
  });
  return presses;
}

function ideal(wpm: number, letterGaps = true): Press[] {
  const u = unitMs(wpm);
  const lengths = [...BENCHMARK_ELEMENTS].map((e) => (e === '-' ? 3 : 1) * u);
  const gaps = lengths.map((_, i) => (letterGaps && (i === 2 || i === 5) ? 3 : 1) * u);
  return sos(lengths, gaps);
}

function decode(presses: Press[], wpm: number): string {
  const d = new Decoder(() => unitMs(wpm));
  for (const p of presses) {
    d.keyDown(p.down);
    d.keyUp(p.up);
  }
  d.update(presses.at(-1)!.up + 10 * unitMs(wpm));
  return d.text.trim();
}

describe('estimateSpeed', () => {
  it.each([5, 12, 18, 20])('recovers %i WPM from ideal SOS', (wpm) => {
    expect(estimateSpeed(ideal(wpm))).toEqual({ ok: true, wpm, clamped: false });
  });

  it('accepts SOS keyed as one run-together character', () => {
    const presses = ideal(14, false);
    expect(estimateSpeed(presses)).toEqual({ ok: true, wpm: 14, clamped: false });
    expect(decode(presses, 14)).toBe('□');
  });

  it('picks a speed at which uneven beginner keying still decodes as SOS', () => {
    const presses = sos(
      [80, 130, 110, 280, 360, 320, 95, 140, 100],
      [150, 120, 420, 90, 140, 500, 110, 130],
    );
    const result = estimateSpeed(presses);
    expect(result.ok).toBe(true);
    if (result.ok) expect(decode(presses, result.wpm)).toBe('SOS');
  });

  it('clamps very slow keying to the slowest setting', () => {
    expect(estimateSpeed(ideal(3))).toEqual({ ok: true, wpm: 5, clamped: true });
  });

  it('rejects keying faster than the fastest setting', () => {
    const result = estimateSpeed(ideal(35));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toContain('faster than 20 WPM');
  });

  it('rejects the wrong number of presses', () => {
    const result = estimateSpeed(ideal(12).slice(0, 8));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toContain('8 received');
  });

  it('rejects dahs that are not longer than dits', () => {
    const result = estimateSpeed(sos([100, 100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 300, 100, 100, 300, 100, 100]));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toContain('clearly longer');
  });

  it('rejects pauses inside a letter that are as long as a dah', () => {
    const result = estimateSpeed(sos([100, 100, 100, 300, 300, 300, 100, 100, 100], [320, 320, 400, 320, 320, 400, 320, 320]));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toContain('pauses');
  });
});

describe('SpeedDetector', () => {
  it('estimates after the ninth press and then starts over', () => {
    const detector = new SpeedDetector();
    const presses = ideal(15);
    presses.forEach((p, i) => {
      detector.keyDown(p.down);
      const result = detector.keyUp(p.up);
      if (i < 8) {
        expect(result).toBeNull();
        expect(detector.count).toBe(i + 1);
      } else {
        expect(result).toEqual({ ok: true, wpm: 15, clamped: false });
      }
    });
    expect(detector.count).toBe(0);
  });

  it('ignores key-up without key-down and repeated key-down', () => {
    const detector = new SpeedDetector();
    expect(detector.keyUp(10)).toBeNull();
    detector.keyDown(0);
    detector.keyDown(50);
    detector.keyUp(100);
    expect(detector.count).toBe(1);
  });
});

describe('listenText', () => {
  it('plays the current target when there is one', () => {
    expect(listenText('K0DEMO DE N0CALL K')).toBe('K0DEMO DE N0CALL K');
  });

  it('falls back to the reference word twice', () => {
    expect(listenText(null)).toBe('PARIS PARIS');
    expect(listenText('  ')).toBe('PARIS PARIS');
  });

  it('uses PARIS, which is 50 units with its word gap', () => {
    expect(textToSegments(REFERENCE_WORD).totalUnits + 7).toBe(50);
  });
});

describe('speedSummary', () => {
  it('shows the setting', () => {
    expect(speedSummary(12, null)).toBe('Speed: 12 WPM');
    expect(speedSummary(12, 12)).toBe('Speed: 12 WPM');
  });

  it('adds the followed speed when it differs', () => {
    expect(speedSummary(12, 15)).toBe('Speed: 12 WPM (following you at 15)');
  });
});

describe('speed shortcuts', () => {
  it('maps - to slower and = or + to faster', () => {
    expect(speedKeyDelta('-')).toBe(-1);
    expect(speedKeyDelta('=')).toBe(1);
    expect(speedKeyDelta('+')).toBe(1);
    expect(speedKeyDelta('a')).toBe(0);
  });

  it('steps within 5 to 20 WPM', () => {
    expect(adjustWpm(12, 1)).toBe(13);
    expect(adjustWpm(12, -1)).toBe(11);
    expect(adjustWpm(20, 1)).toBe(20);
    expect(adjustWpm(5, -1)).toBe(5);
  });
});
