import { describe, expect, it } from 'vitest';
import { keyboardHelp, keycapLabel, keySource } from '../src/input';

describe('keySource', () => {
  it('uses the conventional left dit, right dah by default', () => {
    expect(keySource('ArrowLeft', false)).toBe('dit');
    expect(keySource('ArrowRight', false)).toBe('dah');
    expect(keySource('ArrowDown', false)).toBe('straight');
  });

  it('swaps the paddles but not the straight key', () => {
    expect(keySource('ArrowLeft', true)).toBe('dah');
    expect(keySource('ArrowRight', true)).toBe('dit');
    expect(keySource('ArrowDown', true)).toBe('straight');
  });

  it('ignores other keys', () => {
    expect(keySource('ArrowUp', false)).toBeNull();
    expect(keySource('a', true)).toBeNull();
  });
});

describe('keycap labels and help', () => {
  it('label the keycaps to match the mapping', () => {
    expect(['ArrowLeft', 'ArrowDown', 'ArrowRight'].map((k) => keycapLabel(k, false))).toEqual(['dit', 'key', 'dah']);
    expect(['ArrowLeft', 'ArrowDown', 'ArrowRight'].map((k) => keycapLabel(k, true))).toEqual(['dah', 'key', 'dit']);
  });

  it('describes the swapped paddles', () => {
    expect(keyboardHelp(false)).toContain('Arrow Left sends dits and Arrow Right sends dahs');
    expect(keyboardHelp(true)).toContain('Arrow Left sends dahs and Arrow Right sends dits');
  });
});
