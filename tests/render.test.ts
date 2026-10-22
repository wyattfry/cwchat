// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { UNRECOGNIZED } from '../src/decoder';
import { CONVERSATIONS } from '../src/conversations';
import { chartEntries } from '../src/morse';
import { compareCopy } from '../src/receive';
import { codeChartNodes, copyForm, levelFocusIndex, levelNodes, nextLevelId, copyResultNodes, countdownText, visibleLines, decodedNodes, displayCode, el, isLearnersTurn, taskHeading, taskNodes, waitingForLearner, type TaskState } from '../src/render';

function html(nodes: Node[]): string {
  const p = document.createElement('p');
  p.append(...nodes);
  return p.innerHTML;
}

describe('decodedNodes', () => {
  it('renders known text as plain text', () => {
    expect(html(decodedNodes('CQ DE'))).toBe('CQ DE');
  });

  it('renders each unrecognized character as one labelled gray question mark', () => {
    const nodes = decodedNodes(`K${UNRECOGNIZED}DEMO`);
    expect(nodes).toHaveLength(3);
    const mark = nodes[1] as HTMLElement;
    expect(mark.className).toBe('unknown');
    expect(mark.textContent).toBe('?');
    expect(mark.getAttribute('aria-label')).toBe('unrecognized character');
    expect(html(nodes).replace(/<[^>]+>/g, '')).toBe('K?DEMO');
  });
});

describe('el', () => {
  it('creates an element with properties and children', () => {
    const button = el('button', { type: 'button', className: 'x' }, 'Go');
    expect(button.outerHTML).toBe('<button type="button" class="x">Go</button>');
  });
});

describe('taskNodes', () => {
  const target = {
    speaker: 'learner' as const,
    sent: 'K0DEMO DE N0CALL K',
  };
  const base: TaskState = { activity: 'contact', started: true, title: 'Answer a CQ', stationCall: 'K0DEMO', target, stationSending: false };
  const noop = { restart: () => {}, next: () => {} };
  const text = (state: TaskState) => html(taskNodes(state, noop)).replace(/<[^>]+>/g, ' ');

  it('waits for the learner only while the target shows and nothing is keyed', () => {
    expect(waitingForLearner(base, false)).toBe(true);
    expect(waitingForLearner(base, true)).toBe(false);
    expect(waitingForLearner({ ...base, stationSending: true }, false)).toBe(false);
    expect(waitingForLearner({ ...base, target: null }, false)).toBe(false);
    expect(waitingForLearner({ ...base, started: false }, false)).toBe(false);
    expect(waitingForLearner({ ...base, activity: 'practice' }, false)).toBe(false);
  });

  it('counts down before a station-opened conversation', () => {
    const counting = { ...base, started: false, target: null, countdown: 2 };
    expect(taskHeading(counting)).toBe('Get ready');
    expect(taskNodes(counting, noop)).toEqual([]);
    expect(countdownText(2)).toBe('Starting in 2…');
    expect(taskHeading({ ...counting, countdown: 0 })).toBe('Ready');
  });

  it('titles the panel by what the learner should be doing', () => {
    expect(taskHeading({ ...base, stationSending: true, previousTarget: target })).toBe('Your turn');
    expect(taskHeading({ ...base, stationSending: true, previousTarget: null })).toBe('Get ready');
    expect(taskHeading(base)).toBe('Your turn');
    expect(taskHeading({ ...base, target: null })).toBe('Contact complete');
    expect(taskHeading({ ...base, started: false })).toBe('Ready');
    expect(taskHeading({ ...base, activity: 'practice' })).toBe('Practice');
  });

  it('keeps the last sent message under the overlay while the station sends', () => {
    const previous = { speaker: 'learner' as const, sent: 'K0DEMO DE N0CALL K' };
    const next = { speaker: 'learner' as const, sent: 'K0DEMO DE N0CALL UR RST 599 NAME PAT QTH TEXAS K' };
    const shown = text({ ...base, target: next, stationSending: true, previousTarget: previous });
    expect(shown).toContain('K0DEMO DE N0CALL K');
    expect(shown).not.toContain('UR RST 599');
    expect(taskNodes({ ...base, stationSending: true, previousTarget: null }, noop)).toEqual([]);
  });

  it("marks the learner's turn only while their target shows", () => {
    expect(isLearnersTurn(base)).toBe(true);
    expect(isLearnersTurn({ ...base, stationSending: true })).toBe(false);
    expect(isLearnersTurn({ ...base, target: null })).toBe(false);
    expect(isLearnersTurn({ ...base, started: false })).toBe(false);
    expect(isLearnersTurn({ ...base, activity: 'practice' })).toBe(false);
  });

  it('shows the exact target once the station finishes', () => {
    const shown = text(base);
    expect(shown).toContain('Send exactly:');
    expect(shown).toContain('K0DEMO DE N0CALL K');
  });

  it('shows Start, completion, and practice states', () => {
    expect(text({ ...base, started: false })).toContain('Choose a contact to begin.');
    const started: string[] = [];
    const wrap = document.createElement('div');
    wrap.append(...taskNodes({ ...base, started: false }, { ...noop, start: () => started.push('start') }));
    expect(wrap.textContent).toContain('Press Start to begin Answer a CQ.');
    wrap.querySelector('button')?.click();
    expect(started).toEqual(['start']);
    expect(text({ ...base, target: null })).toContain('You completed a contact with K0DEMO.');
    expect(text({ ...base, activity: 'practice' })).toContain('Key anything you like.');
  });

  it('suggests the next receiving mode after a completed contact', () => {
    const calls: string[] = [];
    const wrap = document.createElement('div');
    wrap.append(
      ...taskNodes(
        { ...base, target: null, nextTitle: 'Call CQ', harderMode: 'Listen first' },
        { restart: () => calls.push('restart'), next: () => calls.push('next'), harder: () => calls.push('harder') },
      ),
    );
    const buttons = [...wrap.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Next: Call CQ', 'Again with Listen first', 'Restart']);
    buttons[1].click();
    expect(calls).toEqual(['harder']);
  });

  it('offers Restart, and Next when there is a next conversation', () => {
    const calls: string[] = [];
    const actions = { restart: () => calls.push('restart'), next: () => calls.push('next') };
    const wrap = document.createElement('div');
    wrap.append(...taskNodes({ ...base, target: null, nextTitle: 'Call CQ' }, actions));
    const buttons = [...wrap.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Next: Call CQ', 'Restart']);
    buttons.forEach((b) => b.click());
    expect(calls).toEqual(['next', 'restart']);
    wrap.replaceChildren(...taskNodes({ ...base, target: null }, actions));
    expect([...wrap.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Restart']);
  });
});

describe('levelNodes', () => {
  it('numbers each conversation, marks completed ones and the next one up, and starts the chosen one', () => {
    const started: string[] = [];
    const list = document.createElement('ul');
    list.append(...levelNodes(CONVERSATIONS, new Set(['answer-cq']), (c) => started.push(c.id)));
    const buttons = [...list.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons).toHaveLength(CONVERSATIONS.length);
    expect(buttons[0].querySelector('.level-number')?.textContent).toBe('Level 1');
    expect(buttons[0].querySelector('.level-title')?.textContent).toBe('Answer a CQ');
    expect(buttons.map((b) => b.dataset.status)).toEqual(['done', 'next', ...Array(CONVERSATIONS.length - 2).fill('open')]);
    expect(buttons[0].querySelector('.level-status')?.textContent).toBe('✓ Completed');
    expect(buttons[1].querySelector('.level-status')?.textContent).toBe('▶ Up next');
    buttons[1].click();
    expect(started).toEqual(['call-cq']);
  });
});

describe('nextLevelId', () => {
  it('is the first conversation not completed, or null when all are', () => {
    expect(nextLevelId(CONVERSATIONS, new Set())).toBe(CONVERSATIONS[0].id);
    expect(nextLevelId(CONVERSATIONS, new Set([CONVERSATIONS[0].id, CONVERSATIONS[2].id]))).toBe(CONVERSATIONS[1].id);
    expect(nextLevelId(CONVERSATIONS, new Set(CONVERSATIONS.map((c) => c.id)))).toBeNull();
  });
});

describe('levelFocusIndex', () => {
  it('moves by one sideways and by a row vertically, staying inside the grid', () => {
    expect(levelFocusIndex(0, 'ArrowRight', 5, 3)).toBe(1);
    expect(levelFocusIndex(0, 'ArrowLeft', 5, 3)).toBe(0);
    expect(levelFocusIndex(1, 'ArrowDown', 5, 3)).toBe(4);
    expect(levelFocusIndex(2, 'ArrowDown', 5, 3)).toBe(2);
    expect(levelFocusIndex(4, 'ArrowUp', 5, 3)).toBe(1);
    expect(levelFocusIndex(4, 'Enter', 5, 3)).toBe(4);
  });
});

describe('codeChartNodes', () => {
  it('groups characters with readable patterns and plays the clicked one', () => {
    const played: string[] = [];
    const wrap = document.createElement('div');
    wrap.append(...codeChartNodes(chartEntries(), (e) => played.push(e.label)));
    expect([...wrap.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Letters', 'Numbers', 'Punctuation', 'Prosigns']);
    const a = wrap.querySelector<HTMLButtonElement>('.code-cell')!;
    expect(a.textContent).toBe('A·−');
    expect(a.getAttribute('aria-label')).toBe('A: dit dah. Play');
    const sk = [...wrap.querySelectorAll<HTMLButtonElement>('.code-cell')].at(-1)!;
    expect(sk.textContent).toBe('SK···−·−');
    a.click();
    sk.click();
    expect(played).toEqual(['A', 'SK']);
  });

  it('displays codes with middle dots and minus signs', () => {
    expect(displayCode('-.-.')).toBe('−·−·');
  });
});

describe('copy by ear', () => {
  it('submits what the learner typed', () => {
    const copies: string[] = [];
    const form = copyForm('K0RAIN', (c) => copies.push(c));
    const input = form.querySelector('input')!;
    expect(input.getAttribute('aria-label')).toBe('What you heard from K0RAIN');
    expect(copyForm('Station', () => {}).querySelector('input')!.getAttribute('aria-label')).toBe('What you heard');
    input.value = 'n0call de k0rain k';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(copies).toEqual(['n0call de k0rain k']);
  });

  it('marks missed words and summarizes the copy', () => {
    const sent = 'N0CALL DE K0RAIN WX CLOUDY ES COLD K';
    const nodes = copyResultNodes(compareCopy('n0call de k0rain wx rainy es cold k', sent), 'n0call de k0rain wx rainy es cold k');
    const wrap = document.createElement('div');
    wrap.append(...nodes);
    expect(wrap.querySelector('.sent')!.textContent).toBe(sent);
    expect([...wrap.querySelectorAll('.copy-miss')].map((e) => e.textContent)).toEqual(['CLOUDY']);
    expect(wrap.querySelector('.copy-summary')!.textContent).toBe(
      'You copied 7 of 8 words. Your copy: N0CALL DE K0RAIN WX RAINY ES COLD K',
    );
  });
});

describe('visibleLines', () => {
  it('holds back a reply until it is due', () => {
    expect(visibleLines(['cq', 'answer', 'reply'], 2)).toEqual(['cq', 'answer']);
    expect(visibleLines(['cq', 'answer', 'reply'], null)).toEqual(['cq', 'answer', 'reply']);
  });
});
