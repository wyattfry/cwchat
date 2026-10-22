import type { Conversation } from './conversations';

/** Reads the stored list of completed conversation ids, ignoring anything malformed. */
export function parseCompleted(raw: string | null): Set<string> {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function serializeCompleted(completed: ReadonlySet<string>): string {
  return JSON.stringify([...completed].sort());
}

/** The conversation after `currentId` in list order, or null at the end. */
export function nextConversation(conversations: readonly Conversation[], currentId: string): Conversation | null {
  const index = conversations.findIndex((c) => c.id === currentId);
  return index >= 0 ? (conversations[index + 1] ?? null) : null;
}

/** The remembered conversation if it still exists, otherwise the first. */
export function selectConversation(conversations: readonly Conversation[], id: string | null): Conversation {
  return conversations.find((c) => c.id === id) ?? conversations[0];
}
