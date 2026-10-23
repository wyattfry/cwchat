import './styles.css';
import { AudioEngine, STATION_LEAD_MS } from './audio';
import { mountCallSignEditor, mountNameEditor } from './callsign';
import { keyboardHelp, keycapLabel, keySource, type KeySource } from './input';
import { audioDelayNote } from './latency';
import { UNRECOGNIZED } from './decoder';
import { CONVERSATIONS, type Conversation } from './conversations';
import { parseRoute, routeHash, sameRoute, type Route } from './route';
import { nextConversation, parseCompleted, selectConversation, serializeCompleted } from './progress';
import { codeChartNodes, copyForm, levelFocusIndex, levelNodes, nextLevelId, copyResultNodes, countdownText, visibleLines, decodedNodes, el, isLearnersTurn, taskHeading, taskNodes, waitingForLearner } from './render';
import { chartEntries, unitMs } from './morse';
import { conversationTerms, DEFAULT_CALL, DEFAULT_NAME, GLOSSARY, normalizeCallSign, normalizeName, type ScriptLine } from './script';
import { revealTimeline, visibleText, type RevealTimeline } from './reveal';
import { METER_MARKS, pauseProgress } from './pause';
import { adjustWpm, listenText, SpeedDetector, speedKeyDelta, speedSummary } from './speed';
import { COUNTDOWN_SECONDS, REPLY_PAUSE_MS, TurnGate } from './turn';
import { compareCopy, nextReceiveMode, parseReceiveMode, RECEIVE_MODES, type CopyResult, type ReceiveMode } from './receive';
import { ContactSession, type Activity, type SessionEvent } from './session';

const CALL_STORAGE_KEY = 'cw-contact.call-sign';
const SWAP_STORAGE_KEY = 'cw-contact.swap-paddles';
const CONVERSATION_STORAGE_KEY = 'cw-contact.conversation';
const COMPLETED_STORAGE_KEY = 'cw-contact.completed';
const RECEIVE_STORAGE_KEY = 'cw-contact.receive-mode';
const NAME_STORAGE_KEY = 'cw-contact.name';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable; the value still applies for this visit.
  }
}

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}


function loadCallSign(): string {
  try {
    return normalizeCallSign(localStorage.getItem(CALL_STORAGE_KEY) ?? '') ?? DEFAULT_CALL;
  } catch {
    return DEFAULT_CALL;
  }
}

function saveCallSign(call: string): void {
  try {
    localStorage.setItem(CALL_STORAGE_KEY, call);
  } catch {
    // Storage unavailable; the call sign still applies for this visit.
  }
}

const ui = {
  myCall: $('my-call'),
  myName: $('my-name'),
  layout: $('layout'),
  glossaryPanel: $('glossary-panel'),
  glossaryHeading: $('glossary-heading'),
  codeChart: $('code-chart'),
  transcriptPanel: $('transcript-panel'),
  taskHeading: $('task-heading'),
  activityButtons: [...document.querySelectorAll<HTMLButtonElement>('[data-activity]')],
  levels: $('levels'),
  restart: $<HTMLButtonElement>('restart'),
  contactBar: $('contact-bar'),
  contactTitle: $('contact-title'),
  back: $<HTMLAnchorElement>('back'),
  levelList: $<HTMLOListElement>('level-list'),
  transcript: $<HTMLOListElement>('transcript'),
  countdown: $('countdown'),
  glossary: $('glossary'),
  task: $('task'),
  taskOverlay: $('task-overlay'),
  feedback: $('feedback'),
  keyArea: $('key-area'),
  keycaps: [...document.querySelectorAll<HTMLElement>('.keycap')],
  decoded: $('decoded'),
  elements: $('elements'),
  pauseMeter: $('pause-meter'),
  pauseFill: $('pause-fill'),
  unrecognizedNote: $('unrecognized-note'),
  keyHelp: $('key-help'),
  focusHint: $('focus-hint'),
  latencyNote: $('latency-note'),
  touchKeys: $('touch-keys'),
  undo: $<HTMLButtonElement>('undo'),
  clear: $<HTMLButtonElement>('clear'),
  speed: $<HTMLInputElement>('speed'),
  speedValue: $<HTMLOutputElement>('speed-value'),
  speedSummary: $('speed-summary'),
  receiveSummary: $('receive-summary'),
  receiveModes: $('receive-modes'),
  listen: $<HTMLButtonElement>('listen'),
  detectSpeed: $<HTMLButtonElement>('detect-speed'),
  speedMessage: $('speed-message'),
  detectPrompt: $('detect-prompt'),
  detectProgress: $('detect-progress'),
  detectCancel: $<HTMLButtonElement>('detect-cancel'),
  mute: $<HTMLInputElement>('mute'),
  swapPaddles: $<HTMLInputElement>('swap-paddles'),
  adaptive: $<HTMLInputElement>('adaptive'),
  adaptiveHelp: $('adaptive-help'),
  announcer: $('announcer'),
};

const audio = new AudioEngine();
let wpm = Number(ui.speed.value);
const unit = () => unitMs(wpm);
const completed = parseCompleted(readStorage(COMPLETED_STORAGE_KEY));
const session = new ContactSession(
  unit,
  loadCallSign(),
  selectConversation(CONVERSATIONS, readStorage(CONVERSATION_STORAGE_KEY)),
  normalizeName(readStorage(NAME_STORAGE_KEY) ?? '') ?? DEFAULT_NAME,
);
const callEditor = mountCallSignEditor(ui.myCall, session.myCall, (call) => {
  saveCallSign(call);
  session.setCallSign(call);
  render();
});
const nameEditor = mountNameEditor(ui.myName, session.myName, (name) => {
  writeStorage(NAME_STORAGE_KEY, name);
  session.setName(name);
  render();
});
let lastT = 0;
let keyDown = false;
interface Feedback {
  kind: 'error' | 'success' | 'info';
  text: string;
  detail?: Node;
}
let feedback: Feedback | null = null;

/** Monotonic timestamp in the performance.now() timebase. */
function now(eventTime?: number): number {
  lastT = Math.max(lastT, eventTime ?? performance.now());
  return lastT;
}

function handle(events: SessionEvent[]): void {
  if (events.length === 0) return;
  for (const event of events) {
    switch (event.type) {
      case 'key':
        keyDown = event.down;
        audio.setKey(event.down);
        break;
      case 'letter':
        announce(event.text ?? 'unrecognized');
        break;
      case 'station':
        finishReveal(false);
        // A station message at or before one already shown means a new contact has started.
        if (session.transcript.length - 1 <= turnGate.shownThrough) turnGate.reset();
        // Already held back after the learner's message; it appears and plays after the pause.
        if (deferredReply && deferredReply.index <= session.transcript.length - 1) break;
        if (holdPlayback) {
          // Shown now, played when the countdown ends.
          pendingPlay = session.transcript.length - 1;
          renderTranscript();
          break;
        }
        renderTranscript();
        playStation(session.transcript.length - 1);
        break;
      case 'accepted': {
        // The contact log already shows what was sent. Hold back any reply for a moment so the
        // learner's message and the station's response read as separate events.
        feedback = null;
        const sentAt = session.transcript.lastIndexOf(event.line);
        if (sentAt >= 0 && sentAt < session.transcript.length - 1) deferReply(sentAt + 1);
        else renderTranscript();
        break;
      }
      case 'rejected':
        feedback = {
          kind: 'error',
          text: `Not quite — the station didn't reply. ${event.result.message}`,
          detail: receivedDiff(event.result.received, event.result.matchedLength),
        };
        break;
      case 'over':
      case 'over-cancelled':
        // The pause meter already shows the closing gap; clear any earlier mistake message.
        feedback = null;
        break;
      case 'complete':
        feedback = null;
        audio.playChime();
        completed.add(session.conversation.id);
        writeStorage(COMPLETED_STORAGE_KEY, serializeCompleted(completed));
        renderTranscript();
        break;
    }
  }
  render();
}

function announce(text: string): void {
  // Toggle a trailing zero-width space so repeated letters are announced again.
  ui.announcer.textContent = ui.announcer.textContent === text ? `${text}\u200b` : text;
}


function receivedDiff(received: string, matched: number): Node {
  const wrap = el('p', { className: 'diff' }, 'Received: ');
  const code = el('code');
  code.append(
    el('span', { className: 'diff-ok' }, ...decodedNodes(received.slice(0, matched))),
    el('mark', { className: 'diff-bad' }, ...decodedNodes(received.slice(matched) || ' ')),
  );
  wrap.append(code);
  return wrap;
}

function renderGlossary(): void {
  ui.glossaryHeading.textContent = `Words in "${session.conversation.title}"`;
  const terms = conversationTerms(session.lines);
  // Fill down the first column, then the second, like a dictionary.
  ui.glossary.style.setProperty('--rows', String(Math.ceil(terms.length / 2)));
  ui.glossary.replaceChildren(...terms.map(glossaryRow));
}

function glossaryRow(term: string): HTMLElement {
  const { meaning, detail } = GLOSSARY[term];
  const dd = el('dd', {}, meaning);
  if (detail) {
    const id = `term-detail-${term}`;
    const button = el('button', { type: 'button', className: 'info', title: detail }, 'i');
    button.setAttribute('aria-label', `More about ${term}`);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('popovertarget', id);
    const bubble = el('div', { id, className: 'term-detail' }, el('strong', {}, term), ` ${detail}`);
    bubble.setAttribute('popover', 'auto');
    bubble.addEventListener('toggle', (e) => {
      const open = (e as ToggleEvent).newState === 'open';
      button.setAttribute('aria-expanded', String(open));
      if (open) positionBubble(bubble, button);
    });
    dd.append(' ', button, bubble);
  }
  return el('div', {}, el('dt', {}, term), dd);
}

/** Places a detail bubble just below its button, kept inside the viewport. */
function positionBubble(bubble: HTMLElement, button: HTMLElement): void {
  const rect = button.getBoundingClientRect();
  const margin = 8;
  const width = bubble.offsetWidth;
  const left = Math.min(Math.max(margin, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - margin);
  bubble.style.left = `${left}px`;
  bubble.style.top = `${rect.bottom + 6}px`;
}

/** Closes an open detail bubble; returns true if one was open. */
function closeDetailBubble(): boolean {
  try {
    const open = document.querySelector<HTMLElement>('.term-detail:popover-open');
    open?.hidePopover();
    return open !== null;
  } catch {
    return false;
  }
}

function renderTranscript(): void {
  ui.transcript.replaceChildren(
    ...visibleLines(session.transcript, deferredReply?.index ?? null).map((line, i) => transcriptItem(line, i)),
  );
  ui.transcript.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
}

function transcriptItem(line: ScriptLine, index: number): HTMLLIElement {
  const isStation = line.speaker === 'station';
  // In Copy by ear the station's call stays hidden until the learner has copied that message.
  const hideCall = isStation && receiveMode === 'copy' && !copies.has(index) && index > turnGate.shownThrough;
  const who = isStation ? (hideCall ? 'Station' : session.stationCall) : session.myCall;
  const li = el('li', { className: `message ${line.speaker}` });
  const header = el('div', { className: 'message-header' }, el('span', { className: 'who' }, who));
  if (isStation) {
    const replay = el('button', { type: 'button', className: 'secondary small' }, 'Replay');
    replay.setAttribute('aria-label', `Replay ${who}'s message`);
    replay.addEventListener('click', () => playStation(index));
    replay.disabled = index === pendingPlay;
    header.append(replay);
  }
  li.dataset.index = String(index);
  li.append(header);
  const copied = copies.get(index);
  if (copied) {
    li.append(...copyResultNodes(copied.result, copied.copy));
    return li;
  }
  const playing = reveal?.index === index;
  if (playing) {
    li.classList.add('sending');
    li.setAttribute('aria-busy', 'true');
  }
  if (isStation && awaitingCopy(index)) {
    li.append(el('code', { className: 'sent' }), copyForm(who, (copy) => submitCopy(index, copy)));
    return li;
  }
  let text = line.sent;
  // Waiting for the countdown: show the bubble, but not the message yet.
  if (index === pendingPlay) text = '';
  if (playing && reveal) {
    // Read along shows letters as they play; Listen first holds the text until the end.
    text = receiveMode === 'read' ? visibleText(reveal.timeline, (performance.now() - reveal.start) / reveal.unit) : '';
  }
  li.append(el('code', { className: 'sent' }, text));
  return li;
}

// Receiving modes -------------------------------------------------------------

let receiveMode: ReceiveMode = parseReceiveMode(readStorage(RECEIVE_STORAGE_KEY));
/** Copy-by-ear results for station messages in the current contact, by transcript index. */
const copies = new Map<number, { copy: string; result: CopyResult }>();

/** In Copy by ear, the latest station message waits for the learner's copy before their turn. */
function awaitingCopy(index: number): boolean {
  return (
    receiveMode === 'copy' &&
    !copies.has(index) &&
    index === session.transcript.length - 1 &&
    session.transcript[index]?.speaker === 'station' &&
    index > turnGate.shownThrough
  );
}

function submitCopy(index: number, copy: string): void {
  const line = session.transcript[index];
  if (!line) return;
  const result = compareCopy(copy, line.sent);
  copies.set(index, { copy, result });
  if (reveal?.index === index) finishReveal(false);
  turnGate.openNow(index);
  bubble(index)?.replaceWith(transcriptItem(line, index));
  announce(`You copied ${result.correct} of ${result.total} words.`);
  render();
  ui.keyArea.focus();
}

function syncReceiveRadios(): void {
  for (const radio of ui.receiveModes.querySelectorAll<HTMLInputElement>('input[name="receive-mode"]')) {
    radio.checked = radio.value === receiveMode;
  }
}

function setReceiveMode(mode: ReceiveMode): void {
  receiveMode = mode;
  writeStorage(RECEIVE_STORAGE_KEY, mode);
  const latest = session.transcript.length - 1;
  // Leaving Copy by ear while a copy was pending opens the turn as the other modes would.
  if (mode !== 'copy' && !reveal && latest > turnGate.shownThrough && session.transcript[latest]?.speaker === 'station') {
    turnGate.openNow(latest);
  }
  renderTranscript();
  render();
}

// Station message reveal ----------------------------------------------------

interface Reveal {
  index: number;
  timeline: RevealTimeline;
  start: number;
  unit: number;
}

let reveal: Reveal | null = null;
/** Opens the learner's turn a short pause after the station finishes. */
const turnGate = new TurnGate();

function bubble(index: number): HTMLLIElement | null {
  return ui.transcript.querySelector<HTMLLIElement>(`li[data-index="${index}"]`);
}

/** Plays a station message and reveals its text letter by letter in time with the audio. */
function playStation(index: number): void {
  const line = session.transcript[index];
  if (!line) return;
  finishReveal(false);
  void audio.playStation(line.sent, unit());
  reveal = { index, timeline: revealTimeline(line.sent), start: performance.now() + STATION_LEAD_MS, unit: unit() };
  const li = bubble(index);
  li?.classList.add('sending');
  li?.setAttribute('aria-busy', 'true');
  if (receiveMode !== 'read') {
    const code = li?.querySelector('.sent');
    if (code && !copies.has(index)) code.textContent = '';
  }
  li?.querySelector<HTMLInputElement>('.copy-input')?.focus();
  updateReveal(performance.now());
}

function updateReveal(t: number): void {
  if (!reveal) return;
  const elapsed = (t - reveal.start) / reveal.unit;
  if (elapsed >= reveal.timeline.totalUnits) {
    finishReveal(true);
    render();
    return;
  }
  if (receiveMode !== 'read' || copies.has(reveal.index)) return;
  const code = bubble(reveal.index)?.querySelector('.sent');
  const text = visibleText(reveal.timeline, elapsed);
  if (code && code.textContent !== text) code.textContent = text;
}

function finishReveal(announceMessage: boolean): void {
  if (!reveal) return;
  const index = reveal.index;
  const waitForCopy = awaitingCopy(index);
  // Played to the end: the turn opens after a pause. Cut off (Listen, a new contact): at once.
  // In Copy by ear the turn opens when the learner submits their copy instead.
  if (!waitForCopy) {
    if (announceMessage) turnGate.finished(index, performance.now());
    else turnGate.openNow(index);
  }
  const line = session.transcript[index];
  const li = bubble(index);
  reveal = null;
  if (!li || !line) return;
  li.classList.remove('sending');
  li.removeAttribute('aria-busy');
  if (waitForCopy || copies.has(index)) return;
  const code = li.querySelector('.sent');
  if (code) code.textContent = line.sent;
  if (announceMessage) announce(`${session.stationCall}: ${line.sent}`);
}

/** The learner's most recent message in the contact log, if any. */
function lastSentByLearner(): ScriptLine | null {
  for (let i = session.transcript.length - 1; i >= 0; i--) {
    if (session.transcript[i].speaker === 'learner') return session.transcript[i];
  }
  return null;
}

let renderedTask = '';
/** Increments for each contact started, so a cue plays once per new target. */
let contactRun = 0;
let lastCue = '';

/** Plays the your-turn cue the first time each new target appears. */
function cueTarget(): void {
  const cue = `${contactRun}|${session.transcript.length}`;
  if (cue === lastCue) return;
  lastCue = cue;
  audio.playCue();
}
let renderedFeedback: Feedback | null | undefined;

function renderTask(): void {
  const target = session.currentTarget;
  const stationSending = target !== null && session.transcript.length - 1 > turnGate.shownThrough;
  const next = nextConversation(CONVERSATIONS, session.conversation.id);
  const state = {
    activity: session.activity,
    started: session.started,
    title: session.conversation.title,
    stationCall: session.stationCall,
    nextTitle: next?.title,
    target,
    stationSending,
    countdown: countdown?.remaining,
    previousTarget: stationSending ? lastSentByLearner() : null,
    harderMode: nextReceiveMode(receiveMode)?.label,
  };
  // Receiving: keep the panel as it was, dimmed and blurred under a Receiving overlay.
  ui.taskOverlay.hidden = !stationSending || countdown !== null;
  if (stationSending) ui.task.setAttribute('aria-hidden', 'true');
  else ui.task.removeAttribute('aria-hidden');
  const keyed = keyDown || session.decoder.text !== '' || session.decoder.pendingElements !== '';
  if (target && !stationSending) cueTarget();
  const waiting = waitingForLearner(state, keyed);
  ui.keyArea.classList.toggle('your-turn', isLearnersTurn(state));
  const key = `${session.conversation.id}|${session.activity}|${session.started}|${target?.sent ?? 'none'}|${session.myCall}|${stationSending}|${countdown?.remaining ?? ''}|${receiveMode}`;
  if (key === renderedTask) {
    ui.task.querySelector('.target')?.classList.toggle('waiting', waiting);
    return;
  }
  renderedTask = key;
  ui.taskHeading.textContent = taskHeading(state);
  ui.task.replaceChildren(
    ...taskNodes(state, {
      restart: beginContact,
      harder: () => {
        const harder = nextReceiveMode(receiveMode);
        if (!harder) return;
        setReceiveMode(harder.id);
        syncReceiveRadios();
        beginContact();
      },
      next: () => {
        if (next) navigate({ view: 'contact', id: next.id }, 'replace');
      },
      start,
    }),
  );
  ui.task.querySelector('.target')?.classList.toggle('waiting', waiting);
}

let renderedLevels = '';

function renderLevels(): void {
  const key = serializeCompleted(completed);
  if (key === renderedLevels) return;
  renderedLevels = key;
  ui.levelList.replaceChildren(
    ...levelNodes(CONVERSATIONS, completed, (c) => {
      // Unlock audio within the click, before navigating.
      audio.unlock().catch(() => undefined);
      navigate({ view: 'contact', id: c.id });
    }),
  );
}

/** True while a contact's view is open; otherwise Contact shows the level select screen. */
let contactOpen = false;

function selectingLevel(): boolean {
  return session.activity === 'contact' && !contactOpen;
}

/** Opens a contact's view, starting it at once unless the browser has not allowed sound yet. */
function openContact(conversation: Conversation, startNow: boolean): void {
  contactOpen = true;
  chooseConversation(conversation);
  if (startNow) start();
  else ui.task.querySelector<HTMLButtonElement>('button')?.focus();
}

function closeContact(): void {
  contactOpen = false;
  chooseConversation(session.conversation);
  focusLevel();
}

function currentRoute(): Route {
  if (session.activity === 'practice') return { view: 'practice' };
  return contactOpen ? { view: 'contact', id: session.conversation.id } : { view: 'levels' };
}

/** Brings the app to a route, from a link, the address bar, or browser Back and Forward. */
function applyRoute(route: Route, startNow: boolean): void {
  if (route.view === 'contact') {
    const id = route.id;
    if (!CONVERSATIONS.some((c) => c.id === id)) {
      route = { view: 'levels' };
      history.replaceState(null, '', routeHash(route));
    }
  }
  if (!sameRoute(route, currentRoute())) {
    if (route.view === 'practice') {
      contactOpen = false;
      setActivity('practice');
    } else {
      if (session.activity === 'practice') setActivity('contact');
      if (route.view === 'levels') {
        if (contactOpen) closeContact();
      } else {
        const id = route.id;
        openContact(CONVERSATIONS.find((c) => c.id === id)!, startNow);
      }
    }
  }
  document.title = routeTitle(route);
}

function routeTitle(route: Route): string {
  if (route.view === 'practice') return 'Practice · CW Contact';
  if (route.view === 'contact') return `${session.conversation.title} · CW Contact`;
  return 'CW Contact';
}

/** Navigates within the app, adding a browser history entry unless replacing the current one. */
function navigate(route: Route, how: 'push' | 'replace' = 'push'): void {
  const hash = routeHash(route);
  if (how === 'push' && location.hash !== hash) history.pushState({ back: routeHash(currentRoute()) }, '', hash);
  else history.replaceState(history.state, '', hash);
  applyRoute(route, true);
}

window.addEventListener('hashchange', () => applyRoute(parseRoute(location.hash), audio.ready));

function levelButtons(): HTMLButtonElement[] {
  return [...ui.levelList.querySelectorAll<HTMLButtonElement>('.level')];
}

/** Focuses the next level up, or the last one played once every level is complete. */
function focusLevel(): void {
  const id = nextLevelId(CONVERSATIONS, completed) ?? session.conversation.id;
  levelButtons().find((b) => b.dataset.id === id)?.focus();
}

function moveLevelFocus(key: string): void {
  const buttons = levelButtons();
  const columns = getComputedStyle(ui.levelList).gridTemplateColumns.split(' ').length;
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0) {
    focusLevel();
    return;
  }
  buttons[levelFocusIndex(index, key, buttons.length, columns)]?.focus();
}

function renderFeedback(): void {
  if (feedback === renderedFeedback) return;
  renderedFeedback = feedback;
  ui.feedback.className = `feedback ${feedback?.kind ?? ''}`;
  ui.feedback.replaceChildren();
  if (!feedback) return;
  ui.feedback.append(el('p', {}, ...decodedNodes(feedback.text)));
  if (feedback.detail) ui.feedback.append(feedback.detail);
}

let renderedDecoded: string | null = null;

function render(): void {
  callEditor.setValue(session.myCall);
  nameEditor.setValue(session.myName);
  const practicing = session.activity === 'practice';
  const selecting = selectingLevel();
  ui.layout.classList.toggle('practice', practicing);
  ui.layout.classList.toggle('selecting', selecting);
  ui.levels.hidden = !selecting;
  ui.glossaryPanel.hidden = practicing;
  ui.transcriptPanel.hidden = practicing;
  for (const button of ui.activityButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.activity === session.activity));
  }
  // Keep the countdown line's space for the whole contact so the log does not shift when it ends.
  ui.countdown.hidden = !session.started && countdown === null;
  ui.countdown.classList.toggle('idle', countdown === null);
  ui.countdown.textContent = countdown ? countdownText(countdown.remaining) : '';
  ui.restart.hidden = !session.started;
  ui.contactBar.hidden = practicing || selecting;
  const level = CONVERSATIONS.findIndex((c) => c.id === session.conversation.id) + 1;
  ui.contactTitle.textContent = `Level ${level} · ${session.conversation.title}`;
  renderLevels();
  const text = session.decoder.text;
  if (text !== renderedDecoded) {
    renderedDecoded = text;
    ui.decoded.replaceChildren(...decodedNodes(text || '\u00a0'));
  }
  ui.elements.textContent = session.decoder.pendingElements.replace(/\./g, '·').replace(/-/g, '−') || '—';
  ui.unrecognizedNote.hidden = !text.includes(UNRECOGNIZED);
  ui.keyHelp.textContent = keyHelpText();
  ui.swapPaddles.checked = swapped;
  ui.touchKeys.classList.toggle('swapped', swapped);
  for (const cap of ui.keycaps) {
    const label = cap.querySelector('.cap-label');
    if (label) label.textContent = keycapLabel(cap.dataset.key ?? '', swapped);
  }
  const delayNote = audioDelayNote(audio.outputDelaySeconds);
  ui.latencyNote.hidden = !delayNote;
  if (delayNote && ui.latencyNote.textContent !== delayNote) ui.latencyNote.textContent = delayNote;
  ui.detectPrompt.hidden = !detector;
  ui.detectProgress.textContent = detector ? `${detector.count} of 9 presses.` : '';
  ui.detectSpeed.disabled = detector !== null;
  ui.adaptiveHelp.textContent = adaptiveHelpText();
  ui.receiveSummary.textContent = `Receiving: ${RECEIVE_MODES.find((m) => m.id === receiveMode)?.label}`;
  ui.speedSummary.textContent = speedSummary(wpm, session.decoder.adaptive ? Math.round(1200 / session.decoder.unitMs) : null);
  renderTask();
  renderFeedback();
}

const touchQuery = window.matchMedia('(hover: none), (pointer: coarse)');
touchQuery.addEventListener('change', () => render());

function keyHelpText(): string {
  return touchQuery.matches
    ? 'Press and hold Key: short for dit, long for dah. Or use the Dit and Dah paddles; hold both to alternate.'
    : keyboardHelp(swapped);
}

/** Lights the on-screen keycap for a held arrow key. */
function showCap(key: string, held: boolean): void {
  ui.keycaps.find((cap) => cap.dataset.key === key)?.classList.toggle('pressed', held);
}

let swapped = loadSwap();

function loadSwap(): boolean {
  try {
    return localStorage.getItem(SWAP_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function setSwapped(value: boolean): void {
  // Release first so a held paddle cannot change meaning before its key-up.
  releaseAll();
  swapped = value;
  try {
    localStorage.setItem(SWAP_STORAGE_KEY, String(value));
  } catch {
    // Storage unavailable; the setting still applies for this visit.
  }
  render();
}

// Key input -----------------------------------------------------------------

function blocksShortcuts(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  return target instanceof HTMLInputElement && !['checkbox', 'button', 'submit', 'reset'].includes(target.type);
}


function keyInput(source: KeySource, down: boolean, t: number): void {
  // A key press counts as a user gesture, so audio can start without pressing Start first.
  if (down && !audio.ready) audio.unlock().catch(() => undefined);
  if (source === 'straight') {
    if (detector) {
      detectInput(down, t);
      return;
    }
    handle(down ? session.straightDown(t) : session.straightUp(t));
  } else {
    if (detector) return; // Speed detection uses the straight key.
    handle(down ? session.paddlePress(source, t) : session.paddleRelease(source, t));
  }
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // Escape stops a playing message even from the copy field.
  if (e.key === 'Escape' && e.target instanceof Element && e.target.closest('.copy-form') && stopPlayback()) {
    e.preventDefault();
    return;
  }
  if (blocksShortcuts(e.target)) return;
  if (selectingLevel()) {
    // No keying on the level screen: the arrow keys move between levels.
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      moveLevelFocus(e.key);
    }
    return;
  }
  if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    if (e.repeat) return;
    const source = keySource(e.key, swapped);
    if (source) {
      showCap(e.key, true);
      keyInput(source, true, now(e.timeStamp));
    }
  } else if (speedKeyDelta(e.key) !== 0) {
    e.preventDefault();
    ui.speed.value = String(adjustWpm(wpm, speedKeyDelta(e.key)));
    updateSpeed();
    announce(`${wpm} WPM`);
    render();
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    undo();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    if (closeDetailBubble()) return; // Escape closes the bubble instead of clearing.
    if (detector) {
      stopDetecting('Speed detection cancelled.');
      return;
    }
    if (stopPlayback()) return; // Stop the message first; a second Escape clears.
    clear();
  }
});

window.addEventListener('keyup', (e) => {
  if (selectingLevel()) return;
  const source = keySource(e.key, swapped);
  if (!source) return;
  showCap(e.key, false);
  keyInput(source, false, now(e.timeStamp));
});

function releaseAll(): void {
  for (const cap of ui.keycaps) cap.classList.remove('pressed');
  handle(session.releaseAll(now()));
}

window.addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseAll();
});

function hapticPulse(e: PointerEvent): void {
  if (e.pointerType !== 'touch') return;
  try {
    navigator.vibrate?.(10);
  } catch {
    // Haptics are optional; keying must still work if the browser rejects vibration.
  }
}

for (const button of ui.touchKeys.querySelectorAll<HTMLButtonElement>('.touch-key')) {
  const source = button.dataset.key as KeySource;
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    button.classList.add('pressed');
    keyInput(source, true, now(e.timeStamp));
    hapticPulse(e);
  });
  const up = (e: PointerEvent) => {
    if (!button.classList.contains('pressed')) return;
    button.classList.remove('pressed');
    keyInput(source, false, now(e.timeStamp));
    if (e.type === 'pointerup') hapticPulse(e);
  };
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('lostpointercapture', up);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

document.addEventListener('focusin', (e) => {
  ui.focusHint.classList.toggle('show', blocksShortcuts(e.target));
});
document.addEventListener('focusout', () => {
  ui.focusHint.classList.remove('show');
});
ui.keyArea.addEventListener('pointerdown', () => ui.keyArea.focus());

// Controls ------------------------------------------------------------------

function undo(): void {
  session.undo();
  render();
}

/** Stops anything playing. A station message counts as cut off, so the learner's turn opens at once. */
function stopPlayback(): boolean {
  if (!reveal && !audio.playing) return false;
  audio.stop();
  finishReveal(false);
  render();
  return true;
}

function clear(): void {
  session.clear();
  feedback = null;
  render();
}

function start(): void {
  // Unlock audio in the click gesture, but don't let a stuck audio device block the lesson.
  audio.unlock().catch(() => undefined);
  beginContact();
}

/** Starts (or restarts) the selected conversation from the top. */
function beginContact(): void {
  cancelCountdown();
  cancelDeferredReply();
  stopDetecting();
  audio.stop();
  finishReveal(false);
  turnGate.reset();
  copies.clear();
  contactRun += 1;
  feedback = null;
  const stationOpens = session.lines[0]?.speaker === 'station';
  // When the station opens, show its first message (empty, or with the copy field) right away
  // under "Starting in 3… 2… 1…", and play it when the countdown ends.
  holdPlayback = stationOpens;
  handle(session.start());
  holdPlayback = false;
  renderTranscript();
  if (stationOpens) countdown = { remaining: COUNTDOWN_SECONDS, timer: window.setInterval(tickCountdown, 1000) };
  render();
  // In Copy by ear, start in the copy field; otherwise ready to key.
  (ui.transcript.querySelector<HTMLInputElement>('.copy-input') ?? ui.keyArea).focus();
}

let countdown: { remaining: number; timer: number } | null = null;
/** A station reply held back briefly after the learner's message appears. */
let deferredReply: { index: number; timer: number } | null = null;

function deferReply(index: number): void {
  cancelDeferredReply();
  deferredReply = { index, timer: window.setTimeout(showDeferredReply, REPLY_PAUSE_MS) };
  renderTranscript();
}

function showDeferredReply(): void {
  if (!deferredReply) return;
  const { index } = deferredReply;
  deferredReply = null;
  renderTranscript();
  playStation(index);
  render();
}

function cancelDeferredReply(): void {
  if (!deferredReply) return;
  window.clearTimeout(deferredReply.timer);
  deferredReply = null;
}
/** True while starting a contact whose first station message waits for the countdown. */
let holdPlayback = false;
/** Index of a station message shown but not yet played, during the countdown. */
let pendingPlay: number | null = null;

function tickCountdown(): void {
  if (!countdown) return;
  countdown.remaining -= 1;
  if (countdown.remaining > 0) {
    render();
    return;
  }
  const index = pendingPlay;
  cancelCountdown();
  if (index !== null) {
    // Enable Replay in place; re-rendering would clear anything typed in a copy field.
    const replay = bubble(index)?.querySelector<HTMLButtonElement>('.message-header button');
    if (replay) replay.disabled = false;
    playStation(index);
  }
  render();
}

function cancelCountdown(): void {
  pendingPlay = null;
  if (!countdown) return;
  window.clearInterval(countdown.timer);
  countdown = null;
}

/** Selects a conversation and resets it, ready to start. */
function chooseConversation(conversation: Conversation): void {
  cancelCountdown();
  cancelDeferredReply();
  stopDetecting();
  audio.stop();
  finishReveal(false);
  handle(session.releaseAll(now()));
  session.setConversation(conversation);
  copies.clear();
  writeStorage(CONVERSATION_STORAGE_KEY, conversation.id);
  feedback = null;
  renderGlossary();
  renderTranscript();
  render();
}

ui.restart.addEventListener('click', beginContact);
ui.back.addEventListener('click', (e) => {
  e.preventDefault();
  // Step back through history when the level screen is where we came from, so Forward still works.
  if (history.state?.back === routeHash({ view: 'levels' })) history.back();
  else navigate({ view: 'levels' });
});
ui.undo.addEventListener('click', undo);

function setActivity(activity: Activity): void {
  if (activity === session.activity) return;
  cancelCountdown();
  cancelDeferredReply();
  stopDetecting();
  audio.stop();
  finishReveal(false);
  handle(session.releaseAll(now()));
  session.setActivity(activity);
  copies.clear();
  feedback = null;
  renderTranscript();
  render();
  if (selectingLevel()) focusLevel();
  else ui.keyArea.focus();
}

for (const button of ui.activityButtons) {
  button.addEventListener('click', () => {
    const activity = button.dataset.activity as Activity;
    if (activity !== session.activity) navigate(activity === 'practice' ? { view: 'practice' } : { view: 'levels' });
  });
}
ui.clear.addEventListener('click', clear);

function updateSpeed(): void {
  wpm = Number(ui.speed.value);
  ui.speedValue.textContent = `${wpm} WPM`;
  ui.listen.textContent = `Listen at ${wpm} WPM`;
}

/** Plays the current target (or PARIS) at the selected speed so the learner can imitate it. */
function listen(): void {
  audio.unlock().catch(() => undefined);
  finishReveal(false);
  const text = listenText(session.currentTarget?.sent);
  ui.speedMessage.textContent = `Playing ${text} at ${wpm} WPM.`;
  void audio.play(text, unit());
}

ui.listen.addEventListener('click', listen);
ui.speed.addEventListener('input', () => {
  updateSpeed();
  render();
});

// Speed detection ------------------------------------------------------------

let detector: SpeedDetector | null = null;

function startDetecting(): void {
  handle(session.releaseAll(now()));
  detector = new SpeedDetector();
  ui.speedMessage.textContent = '';
  render();
  ui.keyArea.focus();
}

function stopDetecting(message = ''): void {
  if (!detector) return;
  detector = null;
  keyDown = false;
  audio.setKey(false);
  ui.speedMessage.textContent = message;
  render();
}

/** Straight-key input while detecting speed: sounds the sidetone but bypasses the decoder. */
function detectInput(down: boolean, t: number): void {
  if (!detector) return;
  keyDown = down;
  audio.setKey(down);
  if (down) {
    detector.keyDown(t);
  } else {
    const result = detector.keyUp(t);
    if (result?.ok) {
      ui.speed.value = String(result.wpm);
      updateSpeed();
      stopDetecting(
        result.clamped
          ? `That was slower than ${result.wpm} WPM, so speed is set to the slowest setting, ${result.wpm} WPM.`
          : `Speed set to ${result.wpm} WPM from your SOS.`,
      );
      return;
    }
    if (result) ui.speedMessage.textContent = `${result.reason} Try again.`;
  }
  render();
}

ui.detectSpeed.addEventListener('click', startDetecting);
ui.detectCancel.addEventListener('click', () => stopDetecting('Speed detection cancelled.'));

function adaptiveHelpText(): string {
  if (!session.decoder.adaptive) return 'Uses the speed setting exactly.';
  const following = Math.round(1200 / session.decoder.unitMs);
  return following === wpm
    ? 'Adjusts dit, dah, and spacing timing to your keying as you go.'
    : `Following your keying at about ${following} WPM.`;
}

ui.adaptive.addEventListener('change', () => {
  session.decoder.adaptive = ui.adaptive.checked;
  render();
});

ui.swapPaddles.addEventListener('change', () => setSwapped(ui.swapPaddles.checked));

ui.mute.addEventListener('change', () => {
  audio.muted = ui.mute.checked;
  audio.setKey(keyDown);
});

// Startup -------------------------------------------------------------------

updateSpeed();
for (const mode of RECEIVE_MODES) {
  const radio = el('input', { type: 'radio', name: 'receive-mode', value: mode.id, checked: mode.id === receiveMode });
  radio.addEventListener('change', () => radio.checked && setReceiveMode(mode.id));
  ui.receiveModes.append(
    el('label', { className: 'receive-mode' }, radio, el('span', {}, el('strong', {}, mode.label), el('span', { className: 'help' }, mode.description))),
  );
}
renderGlossary();
ui.codeChart.replaceChildren(
  ...codeChartNodes(chartEntries(), (entry) => {
    audio.unlock().catch(() => undefined);
    finishReveal(false);
    void audio.playCode(entry.code, unit());
  }),
);
render();
// Sound needs a click first, so a contact opened from the address bar waits for Start.
applyRoute(parseRoute(location.hash), false);

// Pause meter: shows a pause filling toward the letter and word gaps.
$('pause-mark-letter').style.left = `${METER_MARKS.letter * 100}%`;
$('pause-mark-word').style.left = `${METER_MARKS.word * 100}%`;

function updatePauseMeter(): void {
  const start = session.decoder.pauseStartedAt;
  const progress = start === null ? null : pauseProgress(performance.now() - start, session.decoder.unitMs);
  ui.pauseFill.style.transform = `scaleX(${progress?.fraction ?? 0})`;
  ui.pauseMeter.dataset.stage = progress?.stage ?? 'idle';
  requestAnimationFrame(updatePauseMeter);
}
requestAnimationFrame(updatePauseMeter);

window.setInterval(() => {
  handle(session.update(now()));
  updateReveal(performance.now());
  if (turnGate.tick(performance.now())) render();
}, 5);
