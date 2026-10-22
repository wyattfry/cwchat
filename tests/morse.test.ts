import { describe, expect, it } from 'vitest';
import { chartEntries, codeToSegments, decodeSequence, encodeText, MORSE, textToSegments, unitMs } from '../src/morse';

describe('morse', () => {
  it('round-trips every character', () => {
    for (const [char, code] of Object.entries(MORSE)) expect(decodeSequence(code)).toBe(char);
  });

  it('decodes the SK prosign', () => {
    expect(decodeSequence('...-.-')).toBe('SK');
  });

  it('returns null for unknown sequences', () => {
    expect(decodeSequence('........')).toBeNull();
  });

  it('computes unit length from WPM', () => {
    expect(unitMs(12)).toBe(100);
    expect(unitMs(20)).toBe(60);
  });

  it('encodes words into letter codes', () => {
    expect(encodeText(' de  k0demo ')).toEqual([['-..', '.'], ['-.-', '-----', '-..', '.', '--', '---']]);
  });

  it('uses standard timing for segments', () => {
    // "E E": dit (1), word gap (7), dit (1)
    expect(textToSegments('E E')).toEqual({
      segments: [{ start: 0, length: 1 }, { start: 8, length: 1 }],
      totalUnits: 9,
    });
    // "AN": .-  then letter gap 3, -.
    expect(textToSegments('AN').segments).toEqual([
      { start: 0, length: 1 }, { start: 2, length: 3 },
      { start: 8, length: 3 }, { start: 12, length: 1 },
    ]);
  });
});

describe('chartEntries', () => {
  it('covers every decodable character, grouped in order', () => {
    const entries = chartEntries();
    expect(entries).toHaveLength(Object.keys(MORSE).length + 1);
    const groups = [...new Set(entries.map((e) => e.group))];
    expect(groups).toEqual(['Letters', 'Numbers', 'Punctuation', 'Prosigns']);
    expect(entries.filter((e) => e.group === 'Letters').map((e) => e.label).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(entries.filter((e) => e.group === 'Numbers').map((e) => e.label).join('')).toBe('0123456789');
    expect(entries.at(-1)).toEqual({ label: 'SK', code: '...-.-', group: 'Prosigns' });
    for (const e of entries) expect(decodeSequence(e.code)).toBe(e.label);
  });
});

describe('codeToSegments', () => {
  it('times one character with 1-unit gaps between elements', () => {
    expect(codeToSegments('.-')).toEqual({ segments: [{ start: 0, length: 1 }, { start: 2, length: 3 }], totalUnits: 5 });
    expect(codeToSegments('...-.-').totalUnits).toBe(15);
    expect(codeToSegments('-.-')).toEqual(textToSegments('K'));
  });
});
