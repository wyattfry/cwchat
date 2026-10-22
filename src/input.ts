import type { Paddle } from './keyer';

export type KeySource = 'straight' | Paddle;

/**
 * Maps an arrow key to what it keys. Arrow Down is always the straight key. By convention the
 * left paddle sends dits and the right paddle dahs; `swapped` reverses them for left-handed use.
 */
export function keySource(key: string, swapped: boolean): KeySource | null {
  switch (key) {
    case 'ArrowDown':
      return 'straight';
    case 'ArrowLeft':
      return swapped ? 'dah' : 'dit';
    case 'ArrowRight':
      return swapped ? 'dit' : 'dah';
    default:
      return null;
  }
}

/** Short label for each on-screen keycap. */
export function keycapLabel(key: string, swapped: boolean): string {
  const source = keySource(key, swapped);
  return source === 'straight' ? 'key' : (source ?? '');
}

/** Screen reader description of the keyboard keys. */
export function keyboardHelp(swapped: boolean): string {
  const left = swapped ? 'dah' : 'dit';
  const right = swapped ? 'dit' : 'dah';
  return (
    'Arrow Down is a straight key: short for dit, long for dah. ' +
    `Arrow Left sends ${left}s and Arrow Right sends ${right}s; hold both to alternate. ` +
    'Minus and equals change the speed.'
  );
}
