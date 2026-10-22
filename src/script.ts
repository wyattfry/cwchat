import type { Conversation } from './conversations';
import { fillRandoms, resolveRandoms } from './randoms';

/** Placeholder for the learner's call sign in conversation text. */
export const MYCALL = '{MYCALL}';
/** Placeholder for the learner's name in conversation text. */
export const MYNAME = '{MYNAME}';
export const DEFAULT_NAME = 'PAT';
export const DEFAULT_CALL = 'N0CALL';

export type Speaker = 'station' | 'learner';

export interface ScriptLine {
  speaker: Speaker;
  sent: string;
}

export interface GlossaryEntry {
  /** One-line meaning shown in the chart. */
  meaning: string;
  /** Optional extra explanation shown on request. */
  detail?: string;
}

export const GLOSSARY: Readonly<Record<string, GlossaryEntry>> = {
  CQ: { meaning: 'Calling any station' },
  DE: { meaning: 'From; "this is"' },
  K: { meaning: 'Over; your turn', detail: 'Ending your message with K sends it to the other station.' },
  UR: { meaning: 'Your' },
  RST: {
    meaning: 'Signal report',
    detail: 'Readability (1–5), strength (1–9), and tone (1–9). 579 is perfectly readable, fairly strong, clean tone; 599 is perfect on all three.',
  },
  NAME: { meaning: "Operator's name follows" },
  QTH: { meaning: 'Location' },
  TNX: { meaning: 'Thanks' },
  FER: {
    meaning: 'For',
    detail: 'Faster to send than FOR: E (·) replaces O (−−−), so FER takes 23 units instead of 33. It also sounds like casual speech ("thanks fer the call"). FR is used too.',
  },
  QSO: { meaning: 'A contact', detail: 'A two-way conversation between two stations.' },
  WX: { meaning: 'Weather' },
  FB: { meaning: 'Fine business; great' },
  RIG: { meaning: 'Radio' },
  HR: { meaning: 'Here' },
  PWR: { meaning: 'Power', detail: 'Usually followed by watts, as in 100W.' },
  QRP: { meaning: 'Low power', detail: 'Transmitting with 5 watts or less. QRO means high power.' },
  ANT: { meaning: 'Antenna' },
  VERT: { meaning: 'Vertical antenna' },
  POTA: {
    meaning: 'Parks on the Air',
    detail:
      'An award program for operating from parks. The station in the park is the activator; you are the hunter. ' +
      'The exchange is a signal report plus your state or province (CO is Colorado, TX is Texas). ' +
      'The activator also sends the park reference: a country prefix and number, like US-4567 (made up here).',
  },
  GM: { meaning: 'Good morning' },
  '5NN': {
    meaning: '599 report, shortened',
    detail: 'Cut numbers: N stands for 9 (−· instead of −−−−·). Quick exchanges almost always send 5NN.',
  },
  BK: { meaning: 'Back to you', detail: 'Hands the turn back without call signs, in quick exchanges.' },
  QSL: { meaning: 'I confirm; copied', detail: 'Also the card stations send each other to confirm a contact.' },
  TU: { meaning: 'Thank you' },
  GL: { meaning: 'Good luck' },
  ES: {
    meaning: 'And',
    detail: 'From the old American Morse sign for "&", which sounded like E then S (· ···).',
  },
  QSB: {
    meaning: 'Fading signals',
    detail: 'Signals fading in and out. Operators send key words twice so at least one gets through.',
  },
  QRM: { meaning: 'Interference', detail: 'Other stations transmitting on or near your frequency. QRN is static from storms.' },
  PSE: { meaning: 'Please' },
  RPT: { meaning: 'Repeat' },
  AGN: { meaning: 'Again' },
  '?': {
    meaning: 'Question; please repeat',
    detail: 'Sent as ··−−··. After a word it asks a question (HW ?); on its own it asks for a repeat.',
  },
  R: { meaning: 'Received; copied', detail: 'Often doubled, as R R, to confirm everything came through.' },
  GE: { meaning: 'Good evening' },
  HW: { meaning: 'How', detail: 'HW ? asks how well the other station copies you.' },
  CPY: { meaning: 'Copy' },
  AGE: { meaning: 'Age follows' },
  LIC: { meaning: 'Licensed' },
  YRS: { meaning: 'Years' },
  CW: { meaning: 'Morse code', detail: 'Short for continuous wave, the steady carrier keyed on and off.' },
  FIST: { meaning: 'Sending style', detail: "Every operator's keying has its own rhythm. UR FIST FB is a compliment." },
  HPE: { meaning: 'Hope' },
  CUL: { meaning: 'See you later' },
  '73': { meaning: 'Best regards' },
  SK: {
    meaning: 'End of contact',
    detail: 'Can be keyed as one run-together character (···−·−) or as S then K.',
  },
};

const CALL_SIGN_PATTERN = /^[A-Z0-9/]{3,10}$/;
const NAME_PATTERN = /^[A-Z]{2,10}$/;

/** Returns the normalized operator name, or null if it is not 2–10 letters. */
export function normalizeName(input: string): string | null {
  const name = input.trim().toUpperCase();
  return NAME_PATTERN.test(name) ? name : null;
}

/** Returns the normalized call sign, or null if it is not 3–10 letters, digits, or "/". */
export function normalizeCallSign(input: string): string | null {
  const call = input.trim().toUpperCase();
  return CALL_SIGN_PATTERN.test(call) ? call : null;
}

/** The conversation's lines with the learner's call sign filled in. */
export function buildScript(
  conversation: Conversation,
  myCall: string,
  myName: string = DEFAULT_NAME,
  seed = 0,
): ScriptLine[] {
  // Random values depend only on the seed, so they stay fixed for a whole contact.
  const randoms = resolveRandoms(conversation.lines.map((l) => l.sent), seed, [myName]);
  return conversation.lines.map((line) => ({
    speaker: line.speaker,
    sent: fillRandoms(line.sent.replaceAll(MYCALL, myCall).replaceAll(MYNAME, myName), randoms),
  }));
}

/** Glossary words used anywhere in the script, sorted alphabetically (numbers first). */
export function conversationTerms(script: readonly ScriptLine[]): string[] {
  const terms = new Set<string>();
  for (const line of script) {
    for (const word of line.sent.split(' ')) {
      if (GLOSSARY[word]) terms.add(word);
    }
  }
  return [...terms].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}
