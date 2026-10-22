import { describe, expect, it } from 'vitest';
import { checkMessage } from '../src/check';

const TARGET = 'K0DEMO DE N0CALL K';

describe('checkMessage', () => {
  it('accepts an exact match ignoring case and extra spaces', () => {
    expect(checkMessage('  k0demo  de n0call   K ', TARGET).ok).toBe(true);
  });

  it('rejects a pause inside a word and names it', () => {
    const r = checkMessage('K0DEMO DE N0 CALL K', TARGET);
    expect(r.ok).toBe(false);
    expect(r.message).toBe('Extra pause inside N0CALL. Keep its letters together.');
  });

  it('rejects a missing pause between words and names it', () => {
    const r = checkMessage('K0DEMODE N0CALL K', TARGET);
    expect(r.ok).toBe(false);
    expect(r.message).toBe('Missing pause between K0DEMO and DE. Pause longer between words.');
  });

  it('reports a wrong word and where it diverges', () => {
    const r = checkMessage('K0DEMO DE N0CALM K', TARGET);
    expect(r.ok).toBe(false);
    expect(r.matchedLength).toBe('K0DEMO DE N0CAL'.length);
    expect(r.message).toBe('Word 3 should be N0CALL, but was received as N0CALM.');
  });

  it('reports a message that stops early', () => {
    const r = checkMessage('K0DEMO DE K', 'K0DEMO DE N0CALL K');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('should be N0CALL');
    const early = checkMessage('K0DEMO', 'K0DEMO DE N0CALL K');
    expect(early.message).toBe('The message ended early. Next expected: DE.');
    const partial = checkMessage('K', 'K0DEMO DE N0CALL K');
    expect(partial.message).toBe('Word 1 should be K0DEMO, but was received as K.');
  });

  it('reports extra text after the end', () => {
    const r = checkMessage('K0DEMO DE N0CALL K K', TARGET);
    expect(r.ok).toBe(false);
    expect(r.message).toBe('Extra text after the end of the message: K.');
  });

  it('requires the same word order', () => {
    expect(checkMessage('DE K0DEMO N0CALL K', TARGET).ok).toBe(false);
  });
});
