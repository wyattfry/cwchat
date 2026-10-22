import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash, sameRoute } from '../src/route';

describe('parseRoute', () => {
  it('reads the level select, contact, and practice routes', () => {
    expect(parseRoute('')).toEqual({ view: 'levels' });
    expect(parseRoute('#/')).toEqual({ view: 'levels' });
    expect(parseRoute('#/contact/call-cq')).toEqual({ view: 'contact', id: 'call-cq' });
    expect(parseRoute('#/contact/call-cq/')).toEqual({ view: 'contact', id: 'call-cq' });
    expect(parseRoute('#/practice')).toEqual({ view: 'practice' });
  });

  it('falls back to the level select for anything else', () => {
    expect(parseRoute('#/nowhere')).toEqual({ view: 'levels' });
    expect(parseRoute('#/contact/')).toEqual({ view: 'levels' });
    expect(parseRoute('#/contact/a/b')).toEqual({ view: 'levels' });
  });
});

describe('routeHash', () => {
  it('round-trips through parseRoute', () => {
    for (const hash of ['#/', '#/contact/hunt-a-park', '#/practice']) {
      expect(routeHash(parseRoute(hash))).toBe(hash);
    }
  });

  it('compares routes by their hash', () => {
    expect(sameRoute({ view: 'contact', id: 'a' }, parseRoute('#/contact/a'))).toBe(true);
    expect(sameRoute({ view: 'contact', id: 'a' }, { view: 'contact', id: 'b' })).toBe(false);
  });
});
