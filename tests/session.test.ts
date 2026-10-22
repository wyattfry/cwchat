import { describe, expect, it } from 'vitest';
import { CONVERSATIONS, parseConversation } from '../src/conversations';
import { ContactSession, SEND_DELAY_UNITS, type SessionEvent } from '../src/session';
import { textToSegments } from '../src/morse';

const U = 100;

/** Keys text with the straight key, then waits out the word gap and the send delay. */
function send(s: ContactSession, text: string, t0: number): { events: SessionEvent[]; t: number } {
  const events: SessionEvent[] = [];
  const { segments } = textToSegments(text);
  let t = t0;
  for (const seg of segments) {
    events.push(...s.update(t0 + seg.start * U));
    events.push(...s.straightDown(t0 + seg.start * U));
    t = t0 + (seg.start + seg.length) * U;
    events.push(...s.straightUp(t));
  }
  t += 5 * U;
  events.push(...s.update(t));
  t += SEND_DELAY_UNITS * U;
  events.push(...s.update(t));
  return { events, t: t + 10 * U };
}

const types = (events: SessionEvent[]) =>
  events.filter((e) => !['key', 'letter', 'over', 'over-cancelled'].includes(e.type)).map((e) => e.type);

describe('ContactSession', () => {
  it('completes the full contact with keying only', () => {
    const s = new ContactSession(() => U);
    expect(types(s.start())).toEqual(['station']);
    let t = 0;
    for (const msg of ['K0DEMO DE N0CALL K', 'K0DEMO DE N0CALL UR RST 599 NAME PAT QTH TEXAS K']) {
      const r = send(s, msg, t);
      expect(types(r.events)).toEqual(['accepted', 'station']);
      t = r.t;
    }
    const last = send(s, 'K0DEMO DE N0CALL 73 SK', t);
    expect(types(last.events)).toEqual(['accepted', 'complete']);
    expect(s.complete).toBe(true);
    expect(s.transcript.map((l) => l.speaker)).toEqual(['station', 'learner', 'station', 'learner', 'station', 'learner']);
  });

  it('does not send on a K inside a call sign', () => {
    const s = new ContactSession(() => U);
    s.start();
    const r = send(s, 'K0DEMO', 0);
    expect(types(r.events)).toEqual([]);
    expect(s.decoder.text).toBe('K0DEMO ');
  });

  it('keeps the station silent on a wrong message and continues after a fix', () => {
    const s = new ContactSession(() => U);
    s.start();
    let r = send(s, 'K0DEMO DE N0CALM K', 0);
    expect(types(r.events)).toEqual(['rejected']);
    expect(s.lastResult?.message).toContain('N0CALL');
    expect(s.transcript).toHaveLength(1);
    expect(s.decoder.text).toBe('K0DEMO DE N0CALM K ');
    s.undo(); // K
    for (let i = 0; i < 'N0CALM'.length; i++) s.undo(); // the finished word, letter by letter
    expect(s.decoder.text).toBe('K0DEMO DE ');
    r = send(s, 'N0CALL K', r.t);
    expect(s.decoder.text).toBe('');
    expect(types(r.events)).toEqual(['accepted', 'station']);
  });

  it('accepts SK keyed as separate S and K letters', () => {
    const s = new ContactSession(() => U);
    s.start();
    let t = send(s, 'K0DEMO DE N0CALL K', 0).t;
    t = send(s, 'K0DEMO DE N0CALL UR RST 599 NAME PAT QTH TEXAS K', t).t;
    const r = send(s, 'K0DEMO DE N0CALL 73 SK', t); // textToSegments keys S then K
    expect(types(r.events)).toEqual(['accepted', 'complete']);
  });

  it('accepts SK keyed as one prosign', () => {
    const s = new ContactSession(() => U);
    s.start();
    let t = send(s, 'K0DEMO DE N0CALL K', 0).t;
    t = send(s, 'K0DEMO DE N0CALL UR RST 599 NAME PAT QTH TEXAS K', t).t;
    t = send(s, 'K0DEMO DE N0CALL 73', t).t;
    const events: SessionEvent[] = [];
    [...'...-.-'].forEach((el) => {
      events.push(...s.straightDown(t));
      t += (el === '-' ? 3 : 1) * U;
      events.push(...s.straightUp(t));
      t += U;
    });
    events.push(...s.update(t + 5 * U));
    events.push(...s.update(t + (5 + SEND_DELAY_UNITS) * U));
    expect(types(events)).toEqual(['accepted', 'complete']);
  });

  it('does not send before Start', () => {
    const s = new ContactSession(() => U);
    const r = send(s, 'K0DEMO DE N0CALL K', 0);
    expect(types(r.events)).toEqual([]);
  });

  it('changes the call sign mid-contact without restarting', () => {
    const s = new ContactSession(() => U);
    s.start();
    const r = send(s, 'K0DEMO DE N0CALL K', 0);
    expect(s.transcript).toHaveLength(3);
    s.setCallSign('W1XYZ');
    expect(s.started).toBe(true);
    expect(s.transcript).toHaveLength(3);
    expect(s.transcript[1].sent).toBe('K0DEMO DE N0CALL K'); // already sent
    expect(s.currentTarget?.sent).toBe('K0DEMO DE W1XYZ UR RST 599 NAME PAT QTH TEXAS K');
    expect(s.lines[4].sent).toBe('W1XYZ DE K0DEMO TNX FER QSO 73 K');
    const next = send(s, 'K0DEMO DE W1XYZ UR RST 599 NAME PAT QTH TEXAS K', r.t);
    expect(types(next.events)).toEqual(['accepted', 'station']);
  });

  it('uses a custom call sign before Start', () => {
    const s = new ContactSession(() => U);
    s.setCallSign('W1XYZ');
    s.start();
    expect(s.currentTarget?.sent).toBe('K0DEMO DE W1XYZ K');
  });

  it('keys with the paddle keyer', () => {
    const s = new ContactSession(() => U);
    s.start();
    // Key "K" (-.-) by squeezing dah first, releasing both during the final dah.
    const events = [
      ...s.paddlePress('dah', 0),
      ...s.paddlePress('dit', 10),
      ...s.update(700),
      ...s.paddleRelease('dit', 700),
      ...s.paddleRelease('dah', 700),
      ...s.update(2000),
    ];
    expect(events.filter((e) => e.type === 'letter')).toEqual([{ type: 'letter', text: 'K' }]);
    expect(types(events)).toEqual([]); // a lone K never sends
  });

  it('releases a held key when focus is lost', () => {
    const s = new ContactSession(() => U);
    s.straightDown(0);
    expect(s.releaseAll(350).filter((e) => e.type === 'key')).toEqual([{ type: 'key', down: false, t: 350 }]);
    expect(s.decoder.pendingElements).toBe('-');
  });

  it('practice mode decodes keying without sending on K or SK', () => {
    const s = new ContactSession(() => U);
    s.setActivity('practice');
    let r = send(s, 'K0DEMO DE N0CALL K', 0);
    expect(types(r.events)).toEqual([]);
    r = send(s, 'CQ 73 SK', r.t);
    expect(types(r.events)).toEqual([]);
    expect(s.decoder.text).toBe('K0DEMO DE N0CALL K CQ 73 SK ');
    expect(s.currentTarget).toBeNull();
    expect(s.lastResult).toBeNull();
  });

  it('switching activity resets the contact and clears the decoder', () => {
    const s = new ContactSession(() => U);
    s.start();
    const r = send(s, 'K0DEMO DE N0CALL K', 0);
    send(s, 'CQ', r.t);
    s.setActivity('practice');
    expect(s.activity).toBe('practice');
    expect(s.started).toBe(false);
    expect(s.transcript).toHaveLength(0);
    expect(s.decoder.text).toBe('');
    s.setActivity('contact');
    expect(s.activity).toBe('contact');
    expect(s.started).toBe(false);
    expect(types(s.start())).toEqual(['station']);
  });

  it('changing the call sign during practice does not start a contact', () => {
    const s = new ContactSession(() => U);
    s.setActivity('practice');
    s.setCallSign('W1XYZ');
    expect(s.started).toBe(false);
    expect(s.activity).toBe('practice');
  });

  it('ignores the straight key while a paddle element is sounding', () => {
    const s = new ContactSession(() => U);
    const events = [...s.paddlePress('dah', 0), ...s.straightDown(50), ...s.straightUp(80), ...s.paddleRelease('dah', 100)];
    expect(events.filter((e) => e.type === 'key')).toEqual([{ type: 'key', down: true, t: 0 }]);
    const later = s.update(1000);
    expect(later.filter((e) => e.type === 'key')).toEqual([{ type: 'key', down: false, t: 300 }]);
    expect(s.decoder.text).toBe('T ');
  });

  it('ignores paddles while the straight key is held', () => {
    const s = new ContactSession(() => U);
    const events = [...s.straightDown(0), ...s.paddlePress('dit', 20), ...s.paddleRelease('dit', 40), ...s.straightUp(100)];
    expect(events.filter((e) => e.type === 'key').map((e) => e.type === 'key' && e.down)).toEqual([true, false]);
    expect(s.update(150).filter((e) => e.type === 'key')).toEqual([]);
    expect(s.decoder.pendingElements).toBe('.');
  });

  it('accepts the straight key once the paddle keyer is idle', () => {
    const s = new ContactSession(() => U);
    s.paddlePress('dit', 0);
    s.paddleRelease('dit', 50);
    // dit 0-100, inter-element space until 200; the straight key is free after that
    expect(s.straightDown(150).filter((e) => e.type === 'key')).toEqual([{ type: 'key', down: false, t: 100 }]);
    expect(s.straightDown(250).filter((e) => e.type === 'key')).toEqual([{ type: 'key', down: true, t: 250 }]);
  });

  it('follows the learner\'s speed by default', () => {
    const s = new ContactSession(() => U);
    expect(s.decoder.adaptive).toBe(true);
  });

  it('does not send a lone K, which is likely the start of a call sign', () => {
    const s = new ContactSession(() => U);
    s.start();
    const r = send(s, 'K', 0);
    expect(r.events.map((e) => e.type).filter((t) => t !== 'key' && t !== 'letter')).toEqual([]);
    expect(s.lastResult).toBeNull();
  });

  it('waits after the closing K before sending', () => {
    const s = new ContactSession(() => U);
    s.start();
    const { segments } = textToSegments('K0DEMO DE N0CALL K');
    let t = 0;
    for (const seg of segments) {
      s.straightDown(seg.start * U);
      t = (seg.start + seg.length) * U;
      s.straightUp(t);
    }
    const atWordEnd = s.update(t + 5 * U).map((e) => e.type);
    expect(atWordEnd).toContain('over');
    expect(atWordEnd).not.toContain('accepted');
    expect(s.overPending).toBe(true);
    expect(s.update(t + (5 + SEND_DELAY_UNITS) * U - 1).map((e) => e.type)).not.toContain('accepted');
    expect(s.update(t + (5 + SEND_DELAY_UNITS) * U).map((e) => e.type)).toContain('accepted');
    expect(s.overPending).toBe(false);
  });

  it('cancels the send when keying continues during the wait', () => {
    const s = new ContactSession(() => U);
    s.start();
    const { segments } = textToSegments('K0DEMO DE K');
    let t = 0;
    for (const seg of segments) {
      s.straightDown(seg.start * U);
      t = (seg.start + seg.length) * U;
      s.straightUp(t);
    }
    expect(s.update(t + 5 * U).map((e) => e.type)).toContain('over');
    const resumed = s.straightDown(t + 8 * U).map((e) => e.type);
    expect(resumed).toContain('over-cancelled');
    expect(s.overPending).toBe(false);
    s.straightUp(t + 9 * U);
    expect(s.update(t + 40 * U).map((e) => e.type)).not.toContain('rejected');
  });

  it('cancels a pending send on undo and clear', () => {
    const s = new ContactSession(() => U);
    s.start();
    send(s, 'K0DEMO DE', 0);
    const { segments } = textToSegments('K');
    const t0 = 5000;
    let t = t0;
    for (const seg of segments) {
      s.straightDown(t0 + seg.start * U);
      t = t0 + (seg.start + seg.length) * U;
      s.straightUp(t);
    }
    s.update(t + 5 * U);
    expect(s.overPending).toBe(true);
    s.undo();
    expect(s.overPending).toBe(false);
  });

  it('runs a conversation where the learner sends first', () => {
    const callCq = CONVERSATIONS.find((c) => c.id === 'call-cq')!;
    const s = new ContactSession(() => U, 'N0CALL', callCq);
    expect(s.stationCall).toBe('W0TEST');
    expect(s.start()).toEqual([]);
    expect(s.transcript).toHaveLength(0);
    expect(s.currentTarget?.sent).toBe('CQ CQ DE N0CALL N0CALL K');
    let r = send(s, 'CQ CQ DE N0CALL N0CALL K', 0);
    expect(types(r.events)).toEqual(['accepted', 'station']);
    expect(s.transcript.at(-1)?.sent).toBe('N0CALL DE W0TEST K');
    r = send(s, 'W0TEST DE N0CALL UR RST 579 NAME PAT QTH TEXAS K', r.t);
    expect(types(r.events)).toEqual(['accepted', 'station']);
    r = send(s, 'W0TEST DE N0CALL TNX FER QSO 73 SK', r.t);
    expect(types(r.events)).toEqual(['accepted', 'complete']);
    expect(s.transcript.map((l) => l.speaker)).toEqual(['learner', 'station', 'learner', 'station', 'learner']);
  });

  it('switches conversations back to the Start screen', () => {
    const s = new ContactSession(() => U);
    s.start();
    send(s, 'K0DEMO DE N0CALL K', 0);
    s.setConversation(CONVERSATIONS.find((c) => c.id === 'call-cq')!);
    expect(s.started).toBe(false);
    expect(s.transcript).toHaveLength(0);
    expect(s.stationCall).toBe('W0TEST');
    expect(s.decoder.text).toBe('');
    s.start();
    expect(s.currentTarget?.sent).toBe('CQ CQ DE N0CALL N0CALL K');
  });

  it.each(CONVERSATIONS.map((c) => [c.id, c] as const))('completes %s by keying every learner message', (_id, conversation) => {
    const s = new ContactSession(() => U, 'N0CALL', conversation);
    s.start(12345);
    let t = 0;
    const turns = s.lines.filter((l) => l.speaker === 'learner').length;
    for (let i = 0; i < turns; i++) {
      const target = s.currentTarget!.sent;
      expect(target).not.toMatch(/[{}]/); // every placeholder filled in
      const r = send(s, target, t);
      expect(types(r.events)).toEqual(i === turns - 1 ? ['accepted', 'complete'] : ['accepted', 'station']);
      t = r.t;
    }
    expect(s.complete).toBe(true);
  });

  it('keeps random values for the whole contact and draws new ones on restart', () => {
    const weather = CONVERSATIONS.find((c) => c.id === 'trade-weather')!;
    const s = new ContactSession(() => U, 'N0CALL', weather);
    s.start(1);
    const first = s.lines.map((l) => l.sent);
    const r = send(s, s.currentTarget!.sent, 0);
    send(s, s.currentTarget!.sent, r.t);
    // The station's name is reused in the learner's reply, and survives a call sign change.
    const name = first[2].match(/NAME (\w+)/)![1];
    expect(first[3]).toContain(`TNX ${name} `);
    s.setCallSign('W1XYZ');
    expect(s.transcript[2].sent).toBe(first[2]);
    expect(s.lines[4].sent.replace('W1XYZ', 'N0CALL')).toBe(first[4]);
    const restarts = new Set([2, 3, 4, 5, 6].map((seed) => (s.start(seed), s.lines.map((l) => l.sent).join('|'))));
    expect(restarts.size).toBeGreaterThan(1);
  });

  it('changes the learner name mid-contact without restarting', () => {
    const s = new ContactSession(() => U);
    s.start();
    const r = send(s, 'K0DEMO DE N0CALL K', 0);
    s.setName('ALEX');
    expect(s.myName).toBe('ALEX');
    expect(s.currentTarget?.sent).toBe('K0DEMO DE N0CALL UR RST 599 NAME ALEX QTH TEXAS K');
    expect(types(send(s, 'K0DEMO DE N0CALL UR RST 599 NAME ALEX QTH TEXAS K', r.t).events)).toEqual(['accepted', 'station']);
  });

  it('sends on a closing BK, but not on a BK that starts a message', () => {
    const quick = parseConversation(
      {
        id: 'quick', order: 99, title: 'Quick', description: 'Quick.', station: 'W0TEST',
        lines: [
          { speaker: 'station', sent: 'CQ DE W0TEST K' },
          { speaker: 'learner', sent: 'BK TU {MYCALL} BK' },
          { speaker: 'station', sent: 'TU 73 SK' },
        ],
      },
      'quick.json',
    );
    const s = new ContactSession(() => U, 'N0CALL', quick);
    s.start();
    const first = send(s, 'BK', 0);
    expect(types(first.events)).toEqual([]);
    s.clear();
    const r = send(s, 'BK TU N0CALL BK', first.t);
    expect(types(r.events)).toEqual(['accepted', 'station', 'complete']);
  });
});
