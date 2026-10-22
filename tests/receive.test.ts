import { describe, expect, it } from 'vitest';
import { compareCopy, nextReceiveMode, parseReceiveMode, RECEIVE_MODES } from '../src/receive';

const SENT = 'N0CALL DE K0RAIN UR RST 589 NAME LEE QTH IOWA K';
const marks = (copy: string) => compareCopy(copy, SENT).words.map((w) => (w.ok ? '+' : '-')).join('');

describe('receive modes', () => {
  it('progress from read along to copy by ear', () => {
    expect(RECEIVE_MODES.map((m) => m.id)).toEqual(['read', 'listen', 'copy']);
    expect(nextReceiveMode('read')?.id).toBe('listen');
    expect(nextReceiveMode('listen')?.id).toBe('copy');
    expect(nextReceiveMode('copy')).toBeNull();
  });

  it('parses stored values and defaults to read along', () => {
    expect(parseReceiveMode('copy')).toBe('copy');
    expect(parseReceiveMode(null)).toBe('read');
    expect(parseReceiveMode('nonsense')).toBe('read');
  });
});

describe('compareCopy', () => {
  it('marks a perfect copy, ignoring case and spacing', () => {
    const result = compareCopy('  n0call de k0rain ur rst 589 name lee qth iowa k ', SENT);
    expect(result.correct).toBe(11);
    expect(result.total).toBe(11);
  });

  it('marks only the wrong word', () => {
    expect(marks('N0CALL DE K0RAIN UR RST 599 NAME LEE QTH IOWA K')).toBe('+++++-+++++');
  });

  it('does not shift the rest when a word is missed or added', () => {
    expect(marks('N0CALL DE K0RAIN UR RST 589 LEE QTH IOWA K')).toBe('++++++-++++');
    expect(marks('N0CALL DE K0RAIN UR RST 589 NAME IS LEE QTH IOWA K')).toBe('+++++++++++');
  });

  it('counts an empty copy as nothing copied', () => {
    const result = compareCopy('', SENT);
    expect(result.correct).toBe(0);
    expect(result.words.every((w) => !w.ok)).toBe(true);
  });
});
