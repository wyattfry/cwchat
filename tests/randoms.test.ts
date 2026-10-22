import { describe, expect, it } from 'vitest';
import { fillRandoms, poolsAreSendable, RANDOM_POOLS, resolveRandoms, unknownRandomKinds } from '../src/randoms';

const TEXTS = [
  'N0CALL DE K0DEMO UR RST {RANDOM_RST} NAME {RANDOM_NAME} QTH {RANDOM_QTH} K',
  'K0DEMO DE N0CALL TNX {RANDOM_NAME} WX {RANDOM_WX} K',
  'N0CALL DE K0DEMO WX {RANDOM_WX_2} K',
];

describe('random placeholders', () => {
  it('picks the same values for the same seed', () => {
    expect(resolveRandoms(TEXTS, 42)).toEqual(resolveRandoms(TEXTS, 42));
  });

  it('usually picks different values for a different seed', () => {
    const distinct = new Set([1, 2, 3, 4, 5].map((seed) => [...resolveRandoms(TEXTS, seed).values()].join(' ')));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('fills the same token with the same value everywhere', () => {
    const values = resolveRandoms(TEXTS, 7);
    const name = values.get('{RANDOM_NAME}')!;
    expect(RANDOM_POOLS.NAME).toContain(name);
    expect(fillRandoms(TEXTS[0], values)).toContain(`NAME ${name} `);
    expect(fillRandoms(TEXTS[1], values)).toContain(`TNX ${name} `);
  });

  it('gives numbered tokens of the same kind different values', () => {
    for (let seed = 0; seed < 50; seed++) {
      const values = resolveRandoms(TEXTS, seed);
      expect(values.get('{RANDOM_WX}')).not.toBe(values.get('{RANDOM_WX_2}'));
    }
  });

  it('never picks an excluded value, such as the learner name', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(resolveRandoms(['{RANDOM_NAME}'], seed, ['SAM']).get('{RANDOM_NAME}')).not.toBe('SAM');
    }
  });

  it('reports unknown kinds', () => {
    expect(unknownRandomKinds('{RANDOM_NAME} {RANDOM_COLOR} {RANDOM_QTH_2}')).toEqual(['COLOR']);
  });

  it('only uses values that can be sent in Morse', () => {
    expect(poolsAreSendable()).toBe(true);
    expect(RANDOM_POOLS.QTH).not.toContain('TEXAS');
    expect(RANDOM_POOLS.STATE).not.toContain('TX');
  });
});
