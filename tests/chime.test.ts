import { describe, expect, it } from 'vitest';
import { chimeDuration, chimeNotes, cueNotes, incomingNotes, INCOMING_PAUSE_S, type ChimeNote } from '../src/chime';

const semitones = (notes: ChimeNote[]) => notes.map((n) => Math.round(12 * Math.log2(n.frequency / notes[0].frequency)));

describe.each([
  ['completion chime', chimeNotes],
  ['your-turn cue', cueNotes],
  ['incoming cue', incomingNotes],
])('%s', (_name, notes) => {
  it('is monophonic: each note ends before the next begins', () => {
    const list = notes();
    for (let i = 1; i < list.length; i++) {
      expect(list[i].start).toBeGreaterThan(list[i - 1].start + list[i - 1].length);
    }
  });

  it('is short and quiet', () => {
    expect(chimeDuration(notes())).toBeLessThan(1);
    for (const note of notes()) expect(note.peak).toBeLessThanOrEqual(0.1);
  });
});

describe('completion chime', () => {
  it('rises through a Cmaj7 figure, holding the last note', () => {
    const notes = chimeNotes();
    expect(semitones(notes)).toEqual([0, 4, 7, 11]);
    expect(notes[3].length).toBeGreaterThan(notes[0].length);
  });
});

describe('your-turn cue', () => {
  it('rises a perfect fourth in two notes', () => {
    expect(semitones(cueNotes())).toEqual([0, 5]);
  });

  it('is shorter and quieter than the completion chime, and starts on a different note', () => {
    expect(chimeDuration(cueNotes())).toBeLessThan(chimeDuration(chimeNotes()) / 2);
    expect(Math.max(...cueNotes().map((n) => n.peak))).toBeLessThan(Math.min(...chimeNotes().map((n) => n.peak)));
    expect(cueNotes()[0].frequency).not.toBe(chimeNotes()[0].frequency);
  });
});

describe('incoming cue', () => {
  it('is the your-turn cue backwards: same rhythm, falling a fourth', () => {
    const cue = cueNotes();
    const incoming = incomingNotes();
    expect(incoming.map((n) => n.frequency)).toEqual(cue.map((n) => n.frequency).reverse());
    expect(incoming.map((n) => [n.start, n.length])).toEqual(cue.map((n) => [n.start, n.length]));
    expect(semitones(incoming)).toEqual([0, -5]);
  });

  it('leaves a brief pause before the message', () => {
    expect(INCOMING_PAUSE_S).toBeGreaterThanOrEqual(0.2);
    expect(INCOMING_PAUSE_S).toBeLessThanOrEqual(0.5);
  });
});
