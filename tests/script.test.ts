import { describe, expect, it } from 'vitest';
import { textToSegments } from '../src/morse';
import { CONVERSATIONS } from '../src/conversations';
import { buildScript, conversationTerms, GLOSSARY, normalizeCallSign, normalizeName } from '../src/script';

const ANSWER_CQ = CONVERSATIONS.find((c) => c.id === 'answer-cq')!;

describe('script', () => {
  it('substitutes the learner call sign into sent text', () => {
    const script = buildScript(ANSWER_CQ, 'W9XYZ/P');
    expect(script[1].sent).toBe('K0DEMO DE W9XYZ/P K');
    expect(script[2].sent).toMatch(/^W9XYZ\/P DE K0DEMO UR RST \d{3} NAME [A-Z]+ QTH [A-Z]+ K$/);
    expect(script.map((l) => l.speaker)).toEqual(['station', 'learner', 'station', 'learner', 'station', 'learner']);
  });

  it('lists every glossary word used in the conversation, alphabetically', () => {
    const terms = conversationTerms(buildScript(ANSWER_CQ, 'N0CALL'));
    expect(terms).toEqual(['73', 'CQ', 'DE', 'FER', 'K', 'NAME', 'QSO', 'QTH', 'RST', 'SK', 'TNX', 'UR']);
  });

  it('uses every glossary word in at least one conversation', () => {
    const used = new Set(CONVERSATIONS.flatMap((c) => conversationTerms(buildScript(c, 'N0CALL'))));
    expect([...used].sort()).toEqual(Object.keys(GLOSSARY).sort());
  });

  it('builds the words chart from the selected conversation', () => {
    for (const conversation of CONVERSATIONS) {
      const words = new Set(conversation.lines.flatMap((l) => l.sent.split(' ')).filter((w) => GLOSSARY[w]));
      expect(new Set(conversationTerms(buildScript(conversation, 'N0CALL')))).toEqual(words);
    }
    const short = { ...ANSWER_CQ, lines: ANSWER_CQ.lines.slice(0, 2) };
    expect(conversationTerms(buildScript(short, 'N0CALL'))).toEqual(['CQ', 'DE', 'K']);
  });

  it('keeps chart meanings to one short line, with detail where needed', () => {
    for (const [term, entry] of Object.entries(GLOSSARY)) {
      expect(entry.meaning.length, term).toBeLessThanOrEqual(24);
      expect(entry.meaning, term).not.toContain('\n');
    }
    expect(Object.keys(GLOSSARY).filter((term) => GLOSSARY[term].detail)).toEqual(['K', 'RST', 'FER', 'QSO', 'PWR', 'QRP', 'POTA', '5NN', 'BK', 'QSL', 'ES', 'QSB', 'QRM', '?', 'R', 'HW', 'CW', 'FIST', 'SK']);
  });

  it('states FER and FOR sending lengths correctly', () => {
    expect(textToSegments('FOR').totalUnits).toBe(33);
    expect(textToSegments('FER').totalUnits).toBe(23);
    expect(GLOSSARY.FER.detail).toContain('23 units instead of 33');
  });

  it('fills in the learner name, defaulting to PAT', () => {
    expect(buildScript(ANSWER_CQ, 'N0CALL')[3].sent).toBe('K0DEMO DE N0CALL UR RST 599 NAME PAT QTH TEXAS K');
    expect(buildScript(ANSWER_CQ, 'N0CALL', 'ALEX')[3].sent).toBe('K0DEMO DE N0CALL UR RST 599 NAME ALEX QTH TEXAS K');
    const weather = CONVERSATIONS.find((c) => c.id === 'trade-weather')!;
    expect(buildScript(weather, 'N0CALL', 'ALEX')[4].sent).toMatch(/^N0CALL DE K0RAIN TNX ALEX WX [A-Z]+ ES [A-Z]+ K$/);
  });

  it('validates names', () => {
    expect(normalizeName(' alex ')).toBe('ALEX');
    expect(normalizeName('JO')).toBe('JO');
    expect(normalizeName('A')).toBeNull();
    expect(normalizeName('AL3X')).toBeNull();
    expect(normalizeName('ABCDEFGHIJK')).toBeNull();
  });

  it('explains the POTA exchange: state abbreviations and park references', () => {
    const detail = GLOSSARY.POTA.detail ?? '';
    expect(detail).toContain('state or province');
    expect(detail).toContain('CO is Colorado');
    expect(detail).toContain('park reference');
    expect(detail).toContain('US-4567');
  });

  it('validates call signs', () => {
    expect(normalizeCallSign(' w1abc ')).toBe('W1ABC');
    expect(normalizeCallSign('VE3/W1ABC')).toBe('VE3/W1ABC');
    expect(normalizeCallSign('AB')).toBeNull();
    expect(normalizeCallSign('W1-ABC')).toBeNull();
    expect(normalizeCallSign('ABCDEFGHIJK')).toBeNull();
  });
});
