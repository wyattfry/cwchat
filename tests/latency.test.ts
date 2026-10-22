import { describe, expect, it } from 'vitest';
import { audioDelayNote } from '../src/latency';

describe('audioDelayNote', () => {
  it('stays quiet for small or unknown delays', () => {
    expect(audioDelayNote(undefined)).toBeNull();
    expect(audioDelayNote(Number.NaN)).toBeNull();
    expect(audioDelayNote(0.012)).toBeNull();
    expect(audioDelayNote(0.054)).toBeNull();
  });

  it('explains a noticeable delay, rounded to 10 ms', () => {
    const note = audioDelayNote(0.2134);
    expect(note).toContain('about 210 ms');
    expect(note).toContain('Bluetooth');
    expect(note).toContain('Decoding uses your key timing');
  });
});
