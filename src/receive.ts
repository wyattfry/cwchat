/** How station messages are presented: read along, listen then read, or copy by ear. */
export type ReceiveMode = 'read' | 'listen' | 'copy';

export interface ReceiveModeInfo {
  id: ReceiveMode;
  label: string;
  description: string;
}

/** Modes from most to least support, as learners usually progress. */
export const RECEIVE_MODES: readonly ReceiveModeInfo[] = [
  { id: 'read', label: 'Read along', description: 'Letters appear as they play.' },
  { id: 'listen', label: 'Listen first', description: 'The text appears after the message finishes.' },
  { id: 'copy', label: 'Copy by ear', description: 'Type what you heard, then check it.' },
];

export function parseReceiveMode(raw: string | null): ReceiveMode {
  return RECEIVE_MODES.find((m) => m.id === raw)?.id ?? 'read';
}

/** The next, less supported mode, or null at the last one. */
export function nextReceiveMode(mode: ReceiveMode): ReceiveModeInfo | null {
  const index = RECEIVE_MODES.findIndex((m) => m.id === mode);
  return RECEIVE_MODES[index + 1] ?? null;
}

export interface CopyResult {
  /** The sent words, each marked as copied correctly or not. */
  words: { text: string; ok: boolean }[];
  correct: number;
  total: number;
}

function words(text: string): string[] {
  return text.trim().toUpperCase().split(/\s+/).filter(Boolean);
}

/**
 * Compares a learner's copy with what was sent, word by word. Words are aligned by their
 * longest common subsequence, so one missed or extra word does not mark the rest wrong.
 */
export function compareCopy(copy: string, sent: string): CopyResult {
  const a = words(sent);
  const b = words(copy);
  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ok = new Array<boolean>(a.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ok[i] = true;
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  const result = a.map((text, k) => ({ text, ok: ok[k] }));
  return { words: result, correct: ok.filter(Boolean).length, total: a.length };
}
