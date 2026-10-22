import { describe, expect, it } from 'vitest';
import { CONVERSATIONS, loadConversations, parseConversation } from '../src/conversations';
import { GLOSSARY } from '../src/script';

function valid() {
  return {
    id: 'sample',
    order: 9,
    title: 'Sample',
    description: 'A sample.',
    station: 'W0TEST',
    lines: [
      { speaker: 'station', sent: 'CQ DE W0TEST K' },
      { speaker: 'learner', sent: 'W0TEST DE {MYCALL} SK' },
    ],
  };
}

function withLine(index: number, patch: Record<string, unknown>) {
  const data = valid();
  data.lines[index] = { ...data.lines[index], ...patch } as (typeof data.lines)[number];
  return data;
}

/** Every word sent in conversations that come before the given order. */
function wordsBefore(order: number): Set<string> {
  return new Set(CONVERSATIONS.filter((c) => c.order < order).flatMap((c) => c.lines.flatMap((l) => l.sent.split(' '))));
}

describe('bundled conversations', () => {
  it('load, validate, and have unique ids', () => {
    expect(CONVERSATIONS.length).toBeGreaterThan(0);
    expect(new Set(CONVERSATIONS.map((c) => c.id)).size).toBe(CONVERSATIONS.length);
  });

  it('start with Answer a CQ, matching the original script', () => {
    const first = CONVERSATIONS[0];
    expect(first.id).toBe('answer-cq');
    expect(first.station).toBe('K0DEMO');
    expect(first.lines.map((l) => l.sent)).toEqual([
      'CQ CQ DE K0DEMO K0DEMO K',
      'K0DEMO DE {MYCALL} K',
      '{MYCALL} DE K0DEMO UR RST {RANDOM_RST} NAME {RANDOM_NAME} QTH {RANDOM_QTH} K',
      'K0DEMO DE {MYCALL} UR RST 599 NAME {MYNAME} QTH TEXAS K',
      '{MYCALL} DE K0DEMO TNX FER QSO 73 K',
      'K0DEMO DE {MYCALL} 73 SK',
    ]);
  });

  it('include Trade the weather, which introduces WX and ES', () => {
    const weather = CONVERSATIONS.find((c) => c.id === 'trade-weather')!;
    expect(weather.lines).toHaveLength(8);
    const words = new Set(weather.lines.flatMap((l) => l.sent.split(' ')));
    expect(words.has('WX') && words.has('ES')).toBe(true);
    const earlier = new Set(
      CONVERSATIONS.filter((c) => c.order < weather.order).flatMap((c) => c.lines.flatMap((l) => l.sent.split(' '))),
    );
    expect(['WX', 'ES'].filter((w) => earlier.has(w))).toEqual([]);
  });

  it('include Talk about your rig, which drills B, V, and Z and adds equipment codes', () => {
    const rigs = CONVERSATIONS.find((c) => c.id === 'talk-rigs')!;
    const learnerText = rigs.lines.filter((l) => l.speaker === 'learner').map((l) => l.sent).join(' ');
    const count = (ch: string) => [...learnerText].filter((c) => c === ch).length;
    expect(count('B')).toBeGreaterThanOrEqual(6);
    expect(count('Z')).toBeGreaterThanOrEqual(8);
    expect(count('V')).toBeGreaterThanOrEqual(3);
    const earlier = new Set(
      CONVERSATIONS.filter((c) => c.order < rigs.order).flatMap((c) => c.lines.flatMap((l) => l.sent.split(' '))),
    );
    const words = new Set(rigs.lines.flatMap((l) => l.sent.split(' ')));
    const added = ['RIG', 'PWR', 'QRP', 'ANT', 'VERT'];
    expect(added.filter((w) => words.has(w))).toEqual(added);
    expect(added.filter((w) => earlier.has(w))).toEqual([]);
  });

  it('include Ask for a repeat, which adds repeat requests, ?, and doubled key words', () => {
    const repeat = CONVERSATIONS.find((c) => c.id === 'ask-repeat')!;
    const learner = repeat.lines.filter((l) => l.speaker === 'learner').map((l) => l.sent).join(' ');
    expect(learner).toContain('PSE RPT UR NAME ?');
    expect(learner).toContain('{MYNAME} {MYNAME}');
    const words = new Set(repeat.lines.flatMap((l) => l.sent.split(' ')));
    const added = ['QSB', 'QRM', 'PSE', 'RPT', 'AGN', '?', 'R'];
    expect(added.filter((w) => words.has(w))).toEqual(added);
    expect(added.filter((w) => wordsBefore(repeat.order).has(w))).toEqual([]);
  });

  it('include The classic ragchew, which adds greetings, HW ?, age and years licensed, and HPE CUL', () => {
    const chat = CONVERSATIONS.find((c) => c.id === 'ragchew')!;
    const words = new Set(chat.lines.flatMap((l) => l.sent.split(' ')));
    const added = ['GE', 'HW', 'FB', 'CPY', 'AGE', 'LIC', 'YRS', 'CW', 'FIST', 'HPE', 'CUL'];
    expect(added.filter((w) => words.has(w))).toEqual(added);
    expect(added.filter((w) => wordsBefore(chat.order).has(w))).toEqual([]);
    expect(chat.lines.filter((l) => l.speaker === 'learner').map((l) => l.sent).join(' ')).toContain('HW ?');
  });

  it('place the new everyday contacts after Trade the weather and before the harder ones', () => {
    expect(CONVERSATIONS.map((c) => c.id)).toEqual(['answer-cq', 'call-cq', 'trade-weather', 'ask-repeat', 'ragchew', 'talk-rigs', 'hunt-park']);
  });

  it('include Hunt a park, a terse POTA exchange with cut numbers, BK, and a park reference', () => {
    const park = CONVERSATIONS.find((c) => c.id === 'hunt-park')!;
    const learner = park.lines.filter((l) => l.speaker === 'learner').map((l) => l.sent);
    expect(learner.join(' ')).toContain('QSL {RANDOM_PARK}');
    expect(learner.join(' ')).toContain('5NN');
    expect(park.lines.slice(0, -1).some((l) => l.sent.endsWith(' BK'))).toBe(true);
    // After answering, the learner does not resend call signs.
    expect(learner.slice(1).some((l) => l.includes('{MYCALL}'))).toBe(false);
  });

  it('include Call CQ, where the learner sends first', () => {
    const callCq = CONVERSATIONS.find((c) => c.id === 'call-cq')!;
    expect(callCq.lines[0].speaker).toBe('learner');
    expect(CONVERSATIONS.map((c) => c.id).slice(0, 2)).toEqual(['answer-cq', 'call-cq']);
  });

  it('only use abbreviations that are in the glossary', () => {
    // Words that are plain English or data (names, places, numbers) rather than CW shorthand.
    // Plain words, names, places, numbers, and watts (e.g. 100W).
    const plain = /^(\d+W?|US-\d+|CO|TX|NAME|SAM|PAT|JO|LEE|BEV|OHIO|TEXAS|MAINE|IOWA|BOZEMAN|CLOUDY|SUNNY|COLD|WARM|DIPOLE|BAD|CALL|SOLID|LONG|NEW|TO|IS|YR|\{MYCALL\}|\{MYNAME\}|\{RANDOM_[A-Z]+(_\d+)?\})$/;
    for (const c of CONVERSATIONS) {
      for (const line of c.lines) {
        for (const word of line.sent.split(' ')) {
          if (word === c.station || plain.test(word)) continue;
          expect(GLOSSARY[word], `${c.id}: "${word}" needs a glossary entry`).toBeDefined();
        }
      }
    }
  });
});

describe('parseConversation', () => {
  it('accepts a valid conversation', () => {
    expect(parseConversation(valid(), 'sample.json').station).toBe('W0TEST');
  });

  it('accepts BK to hand over and call signs only where they appear', () => {
    const quick = {
      ...valid(),
      lines: [
        { speaker: 'station', sent: 'CQ POTA DE W0TEST K' },
        { speaker: 'learner', sent: 'DE {MYCALL} K' },
        { speaker: 'station', sent: 'UR 5NN BK' },
        { speaker: 'learner', sent: 'TU 73 SK' },
      ],
    };
    expect(parseConversation(quick, 'quick.json').lines).toHaveLength(4);
  });

  it.each([
    ['repeated speaker', withLine(1, { speaker: 'station', sent: 'CQ DE W0TEST SK' }), 'repeats the previous speaker'],
    ['missing K', withLine(0, { sent: 'CQ DE W0TEST' }), 'must end with K or BK'],
    ['last line without SK', withLine(1, { sent: 'W0TEST DE {MYCALL} K' }), 'must end with SK'],
    ['unsendable character', withLine(0, { sent: 'CQ DE W0TEST! K' }), 'cannot be sent in Morse'],
    ['no learner MYCALL', withLine(1, { sent: 'W0TEST DE N0CALL SK' }), 'a learner message must include {MYCALL}'],
    ['a meaning field', withLine(0, { meaning: 'Calling.' }), 'unknown field "meaning"'],
    ['an instruction field', withLine(1, { instruction: 'Sign off.' }), 'unknown field "instruction"'],
    ['no station call', withLine(0, { sent: 'CQ DE K0DEMO K' }), 'a station message must include the station call W0TEST'],
    ['double spaces', withLine(0, { sent: 'CQ  DE W0TEST K' }), 'single spaces'],
  ])('rejects %s', (_name, data, message) => {
    expect(() => parseConversation(data, 'bad.json')).toThrow(message);
  });

  it('rejects a description that names the station', () => {
    expect(() => parseConversation({ ...valid(), description: 'W0TEST calls CQ.' }, 'bad.json')).toThrow('must not name the station');
  });

  it('rejects unknown placeholders', () => {
    expect(() => parseConversation(withLine(0, { sent: 'CQ DE W0TEST {RANDOM_COLOR} K' }), 'bad.json')).toThrow('unknown placeholder {RANDOM_COLOR}');
    expect(() => parseConversation(withLine(0, { sent: 'CQ DE W0TEST {STATION} K' }), 'bad.json')).toThrow('unknown placeholder');
  });

  it('rejects bad ids and stations', () => {
    expect(() => parseConversation({ ...valid(), id: 'Bad Id' }, 'bad.json')).toThrow('id must be');
    expect(() => parseConversation({ ...valid(), station: 'w0test' }, 'bad.json')).toThrow('uppercase call sign');
  });

  it('names the file in errors', () => {
    expect(() => parseConversation({}, 'conversations/oops.json')).toThrow('conversations/oops.json: id');
  });
});

describe('loadConversations', () => {
  it('sorts by order and rejects duplicate ids', () => {
    const a = { ...valid(), id: 'a', order: 2 };
    const b = { ...valid(), id: 'b', order: 1 };
    expect(loadConversations({ 'a.json': a, 'b.json': b }).map((c) => c.id)).toEqual(['b', 'a']);
    expect(() => loadConversations({ 'a.json': a, 'a2.json': { ...a } })).toThrow('Duplicate conversation id "a"');
  });
});
