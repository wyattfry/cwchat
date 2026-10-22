import { describe, expect, it } from 'vitest';
import { CONVERSATIONS } from '../src/conversations';
import { nextConversation, parseCompleted, selectConversation, serializeCompleted } from '../src/progress';

describe('completed conversations', () => {
  it('round-trips a set of ids', () => {
    const completed = new Set(['call-cq', 'answer-cq']);
    expect(serializeCompleted(completed)).toBe('["answer-cq","call-cq"]');
    expect(parseCompleted(serializeCompleted(completed))).toEqual(completed);
  });

  it('ignores missing or malformed storage', () => {
    expect(parseCompleted(null)).toEqual(new Set());
    expect(parseCompleted('not json')).toEqual(new Set());
    expect(parseCompleted('{"a":1}')).toEqual(new Set());
    expect(parseCompleted('["ok", 3, null]')).toEqual(new Set(['ok']));
  });
});

describe('conversation order', () => {
  it('finds the next conversation and stops at the end', () => {
    expect(nextConversation(CONVERSATIONS, 'answer-cq')?.id).toBe('call-cq');
    expect(nextConversation(CONVERSATIONS, CONVERSATIONS.at(-1)!.id)).toBeNull();
    expect(nextConversation(CONVERSATIONS, 'missing')).toBeNull();
  });

  it('selects the remembered conversation or falls back to the first', () => {
    expect(selectConversation(CONVERSATIONS, 'call-cq').id).toBe('call-cq');
    expect(selectConversation(CONVERSATIONS, 'removed').id).toBe('answer-cq');
    expect(selectConversation(CONVERSATIONS, null).id).toBe('answer-cq');
  });
});
