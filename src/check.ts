export interface CheckResult {
  ok: boolean;
  /** Normalized received text. */
  received: string;
  /** Normalized target text. */
  expected: string;
  /** Length of the matching prefix of `received` (normalized). */
  matchedLength: number;
  /** Plain-language explanation of the first mistake; empty when ok. */
  message: string;
}

export function normalize(text: string): string {
  return text.trim().toUpperCase().split(/\s+/).filter(Boolean).join(' ');
}

/**
 * Compares a sent message with its target. Letters, numbers, word order, and word
 * boundaries must match; case and extra spaces are ignored.
 */
export function checkMessage(sent: string, target: string): CheckResult {
  const received = normalize(sent);
  const expected = normalize(target);
  let matchedLength = 0;
  while (
    matchedLength < received.length &&
    matchedLength < expected.length &&
    received[matchedLength] === expected[matchedLength]
  ) {
    matchedLength++;
  }
  const ok = received === expected;
  const message = ok ? '' : describeMistake(received, expected, matchedLength);
  return { ok, received, expected, matchedLength, message };
}

function describeMistake(received: string, expected: string, at: number): string {
  if (received.replace(/ /g, '') === expected.replace(/ /g, '')) {
    return describeSpacing(received, expected);
  }
  const expectedWords = expected.split(' ');
  const receivedWords = received.split(' ');
  const wordIndex = expected.slice(0, at).split(' ').length - 1;
  const want = expectedWords[wordIndex];
  const got = receivedWords[received.slice(0, at).split(' ').length - 1];
  if (at >= received.length && expected[at] === ' ') {
    return `The message ended early. Next expected: ${expectedWords[wordIndex + 1]}.`;
  }
  if (at >= expected.length) {
    return `Extra text after the end of the message: ${received.slice(at).trim()}.`;
  }
  return `Word ${wordIndex + 1} should be ${want}, but was received as ${got ?? 'nothing'}.`;
}

function describeSpacing(received: string, expected: string): string {
  let r = 0;
  let e = 0;
  while (r < received.length && e < expected.length) {
    const rSpace = received[r] === ' ';
    const eSpace = expected[e] === ' ';
    if (rSpace && !eSpace) {
      return `Extra pause inside ${wordAt(expected, e)}. Keep its letters together.`;
    }
    if (eSpace && !rSpace) {
      const before = wordAt(expected, e - 1);
      const after = wordAt(expected, e + 1);
      return `Missing pause between ${before} and ${after}. Pause longer between words.`;
    }
    r++;
    e++;
  }
  return 'Check the pauses between words.';
}

function wordAt(text: string, index: number): string {
  const start = text.lastIndexOf(' ', index - 1) + 1;
  const end = text.indexOf(' ', index);
  return text.slice(start, end === -1 ? undefined : end);
}
