import { describe, expect, it } from 'vitest';
import { Decoder, splitUnrecognized, UNRECOGNIZED } from '../src/decoder';
import { keyCode, keyText } from './helpers';

const U = 100;
const make = () => new Decoder(() => U);

function press(d: Decoder, t: number, units: number): number {
  d.keyDown(t);
  d.keyUp(t + units * U);
  return t + units * U;
}

describe('Decoder', () => {
  it('uses 2 units as the dit/dah threshold', () => {
    const d = make();
    press(d, 0, 1.99);
    expect(d.pendingElements).toBe('.');
    const d2 = make();
    press(d2, 0, 2);
    expect(d2.pendingElements).toBe('-');
  });

  it('ends a letter after a 2-unit pause, not before', () => {
    const d = make();
    const end = press(d, 0, 1);
    expect(d.update(end + 1.99 * U)).toEqual([]);
    expect(d.text).toBe('');
    expect(d.update(end + 2 * U)).toEqual([{ type: 'letter', text: 'E', code: '.' }]);
    expect(d.text).toBe('E');
  });

  it('ends a word after a 5-unit pause, once', () => {
    const d = make();
    const end = press(d, 0, 1);
    d.update(end + 4.99 * U);
    expect(d.text).toBe('E');
    expect(d.update(end + 5 * U)).toEqual([{ type: 'word', word: 'E' }]);
    expect(d.text).toBe('E ');
    expect(d.update(end + 20 * U)).toEqual([]);
  });

  it('emits letter and word together when the first update comes late', () => {
    const d = make();
    const end = press(d, 0, 3);
    expect(d.update(end + 9 * U)).toEqual([
      { type: 'letter', text: 'T', code: '-' },
      { type: 'word', word: 'T' },
    ]);
  });

  it('applies elapsed gaps when the next key goes down', () => {
    const d = make();
    let t = press(d, 0, 1);
    t = press(d, t + 3 * U, 3); // letter gap -> "E", then T pending
    t = press(d, t + 7 * U, 1); // word gap -> "ET ", then E pending
    d.update(t + 10 * U);
    expect(d.text).toBe('ET E ');
  });

  it('decodes ideal-timing text with words', () => {
    const d = make();
    const end = keyText(d, 'K0DEMO DE N0CALL K', U);
    d.update(end + 7 * U);
    expect(d.text).toBe('K0DEMO DE N0CALL K ');
  });

  it('decodes at other speeds', () => {
    const unit = 60;
    const d = new Decoder(() => unit);
    const end = keyText(d, 'CQ DE K0DEMO', unit);
    d.update(end + 7 * unit);
    expect(d.text).toBe('CQ DE K0DEMO ');
  });

  it('tolerates uneven beginner timing within thresholds', () => {
    const d = make();
    // "K" with a long dit (1.8u), short dah (2.2u), gaps of 1.5u
    let t = press(d, 0, 2.5);
    t = press(d, t + 1.5 * U, 1.8);
    t = press(d, t + 1.5 * U, 2.2);
    d.update(t + 5 * U);
    expect(d.text).toBe('K ');
  });

  it('decodes the SK prosign as SK', () => {
    const d = make();
    const end = keyCode(d, '...-.-', U);
    expect(d.update(end + 5 * U)).toEqual([
      { type: 'letter', text: 'SK', code: '...-.-' },
      { type: 'word', word: 'SK' },
    ]);
  });

  it('marks unknown sequences as unrecognized', () => {
    const d = make();
    const end = keyCode(d, '........', U);
    d.update(end + 2 * U);
    expect(d.text).toBe(UNRECOGNIZED);
    expect(d.hasUnrecognized).toBe(true);
  });

  it('undo removes pending elements first, then the last letter', () => {
    const d = make();
    let t = keyText(d, 'AB', U);
    d.update(t + 2 * U);
    t = press(d, t + 3 * U, 1); // pending "."
    d.undo();
    expect(d.pendingElements).toBe('');
    expect(d.text).toBe('AB');
    d.undo();
    expect(d.text).toBe('A');
  });

  it('undo after a word ended keeps the word ended, so new letters start a new word', () => {
    const d = make();
    let t = keyText(d, 'DE K', U);
    d.update(t + 5 * U);
    expect(d.text).toBe('DE K ');
    d.undo(); // removes the one-letter word K entirely
    expect(d.text).toBe('DE ');
    d.undo(); // removes E but DE had ended, so the boundary stays
    expect(d.text).toBe('D ');
    expect(d.update(t + 100 * U)).toEqual([]);
    t = keyText(d, 'N', U, t + 200 * U);
    d.update(t + 5 * U);
    expect(d.text).toBe('D N ');
  });

  it('undo inside a word still being keyed lets the word continue', () => {
    const d = make();
    let t = keyText(d, 'NOCAM', U);
    d.update(t + 2 * U); // letter ended, word still open
    expect(d.text).toBe('NOCAM');
    d.undo();
    expect(d.text).toBe('NOCA');
    t = keyText(d, 'L', U, t + 50 * U); // no gap is measured from the undo
    d.update(t + 5 * U);
    expect(d.text).toBe('NOCAL ');
  });

  it('clear removes everything', () => {
    const d = make();
    const end = keyText(d, 'CQ', U);
    d.clear();
    expect(d.update(end + 10 * U)).toEqual([]);
    expect(d.text).toBe('');
  });

  it('ignores repeated key-down without key-up', () => {
    const d = make();
    d.keyDown(0);
    d.keyDown(50);
    d.keyUp(100);
    expect(d.pendingElements).toBe('.');
  });
});

describe('splitUnrecognized', () => {
  it('separates each unrecognized marker from known text', () => {
    const u = UNRECOGNIZED;
    expect(splitUnrecognized(`K${u}DEMO`)).toEqual(['K', u, 'DEMO']);
    expect(splitUnrecognized(`${u}${u} DE`)).toEqual([u, u, ' DE']);
    expect(splitUnrecognized('CQ')).toEqual(['CQ']);
    expect(splitUnrecognized('')).toEqual([]);
  });
});
