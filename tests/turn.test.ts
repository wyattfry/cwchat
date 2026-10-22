import { describe, expect, it } from 'vitest';
import { TURN_PAUSE_MS, TurnGate } from '../src/turn';

describe('TurnGate', () => {
  it('opens the turn only after the pause following a finished message', () => {
    const gate = new TurnGate();
    gate.finished(0, 1000);
    expect(gate.tick(1000 + TURN_PAUSE_MS - 1)).toBe(false);
    expect(gate.shownThrough).toBe(-1);
    expect(gate.tick(1000 + TURN_PAUSE_MS)).toBe(true);
    expect(gate.shownThrough).toBe(0);
    expect(gate.tick(5000)).toBe(false);
  });

  it('opens at once when a message is cut off', () => {
    const gate = new TurnGate();
    gate.finished(2, 0);
    gate.openNow(2);
    expect(gate.shownThrough).toBe(2);
    expect(gate.tick(TURN_PAUSE_MS)).toBe(false);
  });

  it('ignores replays of messages already shown', () => {
    const gate = new TurnGate();
    gate.openNow(2);
    gate.finished(0, 0);
    expect(gate.tick(TURN_PAUSE_MS)).toBe(false);
    expect(gate.shownThrough).toBe(2);
  });

  it('resets for a new contact', () => {
    const gate = new TurnGate();
    gate.openNow(4);
    gate.finished(5, 0);
    gate.reset();
    expect(gate.shownThrough).toBe(-1);
    expect(gate.tick(TURN_PAUSE_MS)).toBe(false);
  });
});
