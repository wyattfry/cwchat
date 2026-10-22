import { MORSE } from './morse';
import { RANDOM_PATTERN, unknownRandomKinds } from './randoms';
import { MYCALL, MYNAME, normalizeCallSign, type Speaker } from './script';

export interface ConversationLine {
  speaker: Speaker;
  /** Exact text sent, using {MYCALL} and {MYNAME} for the learner's call sign and name. */
  sent: string;
}

const LINE_FIELDS = new Set(['speaker', 'sent']);

export interface Conversation {
  /** Stable identifier, used to remember progress. */
  id: string;
  /** Position in the conversation list. */
  order: number;
  title: string;
  /** One sentence shown in the conversation list. */
  description: string;
  /** The simulated station's call sign. */
  station: string;
  lines: ConversationLine[];
}

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function fail(source: string, message: string): never {
  throw new Error(`${source}: ${message}`);
}

function text(value: unknown, source: string, field: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(source, `${field} must be a non-empty string`);
  return value;
}

/**
 * Validates one conversation file. Rules: speakers alternate; every message ends with K (or BK)
 * except the last, which ends with SK; learner messages have at least two words; {MYCALL} and
 * the station call each appear at least once; station messages include the station call; and
 * every character can be sent in Morse.
 */
export function parseConversation(data: unknown, source: string): Conversation {
  if (typeof data !== 'object' || data === null) fail(source, 'must be a JSON object');
  const raw = data as Record<string, unknown>;
  const id = text(raw.id, source, 'id');
  if (!ID_PATTERN.test(id)) fail(source, 'id must be lowercase words separated by hyphens');
  if (typeof raw.order !== 'number' || !Number.isFinite(raw.order)) fail(source, 'order must be a number');
  const station = normalizeCallSign(text(raw.station, source, 'station'));
  if (!station || station !== raw.station) fail(source, 'station must be an uppercase call sign');
  if (!Array.isArray(raw.lines) || raw.lines.length < 2) fail(source, 'lines must list at least two messages');

  const lines = raw.lines.map((item: unknown, i: number): ConversationLine => {
    const where = `line ${i + 1}`;
    if (typeof item !== 'object' || item === null) fail(source, `${where} must be an object`);
    const line = item as Record<string, unknown>;
    if (line.speaker !== 'station' && line.speaker !== 'learner') {
      fail(source, `${where} speaker must be "station" or "learner"`);
    }
    const sent = text(line.sent, source, `${where} sent`);
    if (sent !== sent.trim() || /\s{2,}/.test(sent)) fail(source, `${where} sent must use single spaces`);
    const unknown = unknownRandomKinds(sent);
    if (unknown.length) fail(source, `${where} uses unknown placeholder {RANDOM_${unknown[0]}}`);
    const placeholders = sent.replaceAll(MYCALL, '').replaceAll(MYNAME, '').replace(RANDOM_PATTERN, '');
    if (/[{}]/.test(placeholders)) fail(source, `${where} has an unknown placeholder`);
    for (const ch of placeholders) {
      if (ch !== ' ' && !MORSE[ch]) fail(source, `${where} sent has "${ch}", which cannot be sent in Morse`);
    }
    const extra = Object.keys(line).filter((key) => !LINE_FIELDS.has(key));
    if (extra.length) fail(source, `${where} has unknown field "${extra[0]}"; lines only have speaker and sent`);
    return { speaker: line.speaker, sent };
  });

  lines.forEach((line, i) => {
    const where = `line ${i + 1}`;
    if (i > 0 && line.speaker === lines[i - 1].speaker) fail(source, `${where} repeats the previous speaker`);
    const words = line.sent.split(' ');
    const last = words.at(-1);
    const isFinal = i === lines.length - 1;
    if (isFinal && last !== 'SK') fail(source, `${where} is the last message and must end with SK`);
    if (!isFinal && last !== 'K' && last !== 'BK') fail(source, `${where} must end with K or BK`);
    if (line.speaker === 'learner' && words.length < 2) {
      fail(source, `${where} needs at least two words so a lone K is not a message`);
    }
  });
  // Quick exchanges (like POTA) drop call signs after the first turns, so each only has to appear once.
  if (!lines.some((l) => l.speaker === 'learner' && l.sent.includes(MYCALL))) {
    fail(source, `a learner message must include ${MYCALL}`);
  }
  if (!lines.some((l) => l.speaker === 'station' && l.sent.split(' ').includes(station))) {
    fail(source, `a station message must include the station call ${station}`);
  }

  const description = text(raw.description, source, 'description');
  // The list is shown before the contact, so naming the station would spoil copying by ear.
  if (description.toUpperCase().includes(station)) fail(source, 'description must not name the station call sign');

  return {
    id,
    order: raw.order,
    title: text(raw.title, source, 'title'),
    description,
    station,
    lines,
  };
}

/** Validates a set of conversations and returns them in list order. */
export function loadConversations(files: Record<string, unknown>): Conversation[] {
  const conversations = Object.entries(files).map(([path, data]) => parseConversation(data, path));
  const ids = new Set<string>();
  for (const c of conversations) {
    if (ids.has(c.id)) throw new Error(`Duplicate conversation id "${c.id}"`);
    ids.add(c.id);
  }
  if (conversations.length === 0) throw new Error('No conversations found');
  return conversations.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** Every conversation in the conversations/ folder, validated and in order. */
export const CONVERSATIONS: readonly Conversation[] = loadConversations(
  import.meta.glob('../conversations/*.json', { eager: true, import: 'default' }),
);
