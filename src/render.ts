import { splitUnrecognized, UNRECOGNIZED } from './decoder';
import type { Conversation } from './conversations';
import type { ChartEntry } from './morse';
import type { CopyResult } from './receive';
import type { ScriptLine } from './script';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/**
 * Renders decoded text, showing each unrecognized character as a gray "?" so it keeps the
 * same width as the letters around it.
 */
export function decodedNodes(text: string): Node[] {
  return splitUnrecognized(text).map((part) => {
    if (part !== UNRECOGNIZED) return document.createTextNode(part);
    const mark = el('span', { className: 'unknown' }, '?');
    mark.setAttribute('role', 'img');
    mark.setAttribute('aria-label', 'unrecognized character');
    return mark;
  });
}

export interface TaskState {
  activity: 'contact' | 'practice';
  started: boolean;
  /** Title of the selected conversation. */
  title: string;
  stationCall: string;
  /** Title of the next conversation, if there is one. */
  nextTitle?: string;
  /** Label of the next, harder receiving mode, if there is one. */
  harderMode?: string;
  /** The learner's current target, or null when there is none. */
  target: ScriptLine | null;
  /** True while the station's latest message is still being sent. */
  stationSending: boolean;
  /** The learner's last sent message, kept visible under the Receiving overlay. */
  previousTarget?: ScriptLine | null;
  /** Seconds left before the station starts a conversation it opens. */
  countdown?: number;
}

/** True when the learner's target is showing and it is their turn to key it. */
export function isLearnersTurn(state: TaskState): boolean {
  return state.activity === 'contact' && state.started && state.target !== null && !state.stationSending;
}

/** True when it is the learner's turn and they have not started keying yet. */
export function waitingForLearner(state: TaskState, keyed: boolean): boolean {
  return isLearnersTurn(state) && !keyed;
}

/** Heading for the task panel, matching what the learner should be doing. */
export function taskHeading(state: TaskState): string {
  if (state.activity === 'practice') return 'Practice';
  if (state.countdown) return 'Get ready';
  if (!state.started) return 'Ready';
  if (!state.target) return 'Contact complete';
  // While receiving, the panel keeps its last state under the Receiving overlay.
  if (state.stationSending) return state.previousTarget ? 'Your turn' : 'Get ready';
  return 'Your turn';
}

/** Contents of the Your turn panel. The target stays hidden until the station finishes sending. */
export function taskNodes(
  state: TaskState,
  actions: { restart: () => void; next: () => void; harder?: () => void; start?: () => void },
): Node[] {
  if (state.activity === 'practice') {
    return [
      el('p', { className: 'instruction' }, 'Key anything you like.'),
      el('p', {}, 'Letters and words appear in the keying station as you send them. Nothing is sent to a station.'),
      el('p', { className: 'meaning' }, 'Clear (Esc) starts over.'),
    ];
  }
  // The countdown itself shows in the contact log; this panel just says to get ready.
  if (state.countdown) return [];
  if (!state.started) {
    if (!actions.start) return [el('p', {}, 'Choose a contact to begin.')];
    const start = el('button', { type: 'button', className: 'primary' }, 'Start');
    start.addEventListener('click', actions.start);
    return [el('p', {}, `Press Start to begin ${state.title}.`), el('div', { className: 'task-actions' }, start)];
  }
  if (!state.target) {
    const buttons = el('div', { className: 'task-actions' });
    if (state.nextTitle) {
      const next = el('button', { type: 'button', className: 'primary' }, `Next: ${state.nextTitle}`);
      next.addEventListener('click', actions.next);
      buttons.append(next);
    }
    if (state.harderMode && actions.harder) {
      const harder = el('button', { type: 'button', className: 'secondary' }, `Again with ${state.harderMode}`);
      harder.addEventListener('click', actions.harder);
      buttons.append(harder);
    }
    const restart = el('button', { type: 'button', className: state.nextTitle ? 'secondary' : 'primary' }, 'Restart');
    restart.addEventListener('click', actions.restart);
    buttons.append(restart);
    return [el('p', { className: 'complete' }, `You completed a contact with ${state.stationCall}.`), buttons];
  }
  // While receiving, keep showing the message the learner just sent; an overlay says Receiving.
  if (state.stationSending) return state.previousTarget ? targetNodes(state.previousTarget) : [];
  return targetNodes(state.target);
}

function targetNodes(target: ScriptLine): Node[] {
  return [el('p', { className: 'target-label' }, 'Send exactly:'), el('code', { className: 'target' }, target.sent)];
}

/** The first conversation not yet completed, or null once all are done. */
export function nextLevelId(conversations: readonly Conversation[], completed: ReadonlySet<string>): string | null {
  return conversations.find((c) => !completed.has(c.id))?.id ?? null;
}

/** The level select screen: a numbered card per conversation; choosing one starts it. */
export function levelNodes(
  conversations: readonly Conversation[],
  completed: ReadonlySet<string>,
  onStart: (conversation: Conversation) => void,
): Node[] {
  const nextId = nextLevelId(conversations, completed);
  return conversations.map((conversation, i) => {
    const status = completed.has(conversation.id) ? 'done' : conversation.id === nextId ? 'next' : 'open';
    const button = el(
      'button',
      { type: 'button', className: 'level' },
      el('span', { className: 'level-number' }, el('span', { className: 'visually-hidden' }, 'Level '), String(i + 1)),
      el('span', { className: 'level-title' }, conversation.title),
      el('span', { className: 'level-description' }, conversation.description),
      el('span', { className: 'level-status' }, status === 'done' ? '✓ Completed' : status === 'next' ? '▶ Up next' : '▶ Start'),
    );
    button.dataset.status = status;
    button.dataset.id = conversation.id;
    button.addEventListener('click', () => onStart(conversation));
    return el('li', {}, button);
  });
}

/** Where an arrow key moves focus in a grid of `count` cards laid out in `columns` columns. */
export function levelFocusIndex(index: number, key: string, count: number, columns: number): number {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[key] ?? 0;
  const target = index + step;
  return target >= 0 && target < count ? target : index;
}

/** Shows a code with middle dots and minus signs, e.g. "·−". */
export function displayCode(code: string): string {
  return code.replace(/\./g, '·').replace(/-/g, '−');
}

/** The Morse code chart, grouped, with a button per character that plays it. */
export function codeChartNodes(entries: readonly ChartEntry[], onPlay: (entry: ChartEntry) => void): Node[] {
  const groups = [...new Set(entries.map((e) => e.group))];
  return groups.map((group) => {
    const list = el('ul', { className: 'code-chart' });
    for (const entry of entries.filter((e) => e.group === group)) {
      const spoken = [...entry.code].map((c) => (c === '.' ? 'dit' : 'dah')).join(' ');
      const button = el(
        'button',
        { type: 'button', className: 'code-cell' },
        el('span', { className: 'code-char' }, entry.label),
        el('span', { className: 'code-pattern' }, displayCode(entry.code)),
      );
      button.setAttribute('aria-label', `${entry.label}: ${spoken}. Play`);
      button.addEventListener('click', () => onPlay(entry));
      list.append(el('li', {}, button));
    }
    return el('section', { className: 'chart-group' }, el('h3', {}, group), list);
  });
}

/** Copy by ear: a field in the station's message for what the learner heard. */
export function copyForm(sender: string, onSubmit: (copy: string) => void): HTMLFormElement {
  const input = el('input', {
    className: 'copy-input',
    placeholder: 'Type what you heard, then press Enter',
    autocomplete: 'off',
    spellcheck: false,
  });
  input.setAttribute('aria-label', sender === 'Station' ? 'What you heard' : `What you heard from ${sender}`);
  input.setAttribute('autocapitalize', 'characters');
  const form = el('form', { className: 'copy-form', noValidate: true }, input, el('button', { type: 'submit', className: 'secondary small' }, 'Check'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    onSubmit(input.value);
  });
  return form;
}

/** The sent text with each word marked as copied or missed, and a short summary. */
export function copyResultNodes(result: CopyResult, copy: string): Node[] {
  const code = el('code', { className: 'sent' });
  result.words.forEach((word, i) => {
    if (i > 0) code.append(' ');
    const span = el('span', { className: word.ok ? 'copy-ok' : 'copy-miss' }, word.text);
    if (!word.ok) span.title = 'Missed';
    code.append(span);
  });
  const typed = copy.trim().toUpperCase().split(/\s+/).filter(Boolean).join(' ');
  const summary = el(
    'p',
    { className: 'copy-summary' },
    `You copied ${result.correct} of ${result.total} words.`,
    typed ? ` Your copy: ${typed}` : '',
  );
  return [code, summary];
}

/** Countdown text shown in the contact log before the station opens a conversation. */
export function countdownText(seconds: number): string {
  return `Starting in ${seconds}…`;
}

/** Log entries to show: everything before `hiddenFrom`, which holds back a reply not yet due. */
export function visibleLines<T>(lines: readonly T[], hiddenFrom: number | null): T[] {
  return hiddenFrom === null ? [...lines] : lines.slice(0, hiddenFrom);
}
