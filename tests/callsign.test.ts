// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mountCallSignEditor, mountNameEditor } from '../src/callsign';

let container: HTMLElement;
let changes: string[];

function setup(initial = 'N0CALL') {
  container = document.createElement('dd');
  document.body.replaceChildren(container);
  changes = [];
  return mountCallSignEditor(container, initial, (call) => changes.push(call));
}

const display = () => container.querySelector<HTMLButtonElement>('.call-display')!;
const form = () => container.querySelector<HTMLFormElement>('form')!;
const input = () => container.querySelector<HTMLInputElement>('input')!;
const submit = () => form().dispatchEvent(new Event('submit', { cancelable: true }));
const key = (k: string) => input().dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true }));

describe('call sign editor', () => {
  beforeEach(() => setup());

  it('shows the call sign as a button', () => {
    expect(display().textContent).toContain('N0CALL');
    expect(display().getAttribute('aria-label')).toBe('Your call sign: N0CALL. Change');
    expect(form().hidden).toBe(true);
  });

  it('opens an input with the current call sign', () => {
    display().click();
    expect(form().hidden).toBe(false);
    expect(display().hidden).toBe(true);
    expect(input().value).toBe('N0CALL');
  });

  it('saves a valid call sign in uppercase on Enter', () => {
    display().click();
    input().value = 'w1xyz';
    submit();
    expect(changes).toEqual(['W1XYZ']);
    expect(form().hidden).toBe(true);
    expect(display().textContent).toContain('W1XYZ');
  });

  it('keeps editing and explains an invalid call sign', () => {
    display().click();
    input().value = 'bad call!';
    submit();
    expect(changes).toEqual([]);
    expect(form().hidden).toBe(false);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('.call-error')!.textContent).toContain('3–10');
  });

  it('cancels on Escape', () => {
    display().click();
    input().value = 'W1XYZ';
    key('Escape');
    expect(changes).toEqual([]);
    expect(form().hidden).toBe(true);
    expect(display().textContent).toContain('N0CALL');
  });

  it('does not report an unchanged call sign', () => {
    display().click();
    submit();
    expect(changes).toEqual([]);
  });

  it('updates the display from outside, but not while editing', () => {
    const editor = setup();
    editor.setValue('K1ABC');
    expect(display().textContent).toContain('K1ABC');
    display().click();
    editor.setValue('K2DEF');
    expect(input().value).toBe('K1ABC');
  });
});

describe('name editor', () => {
  it('saves letters only, uppercased, and explains invalid names', () => {
    const box = document.createElement('dd');
    document.body.replaceChildren(box);
    const names: string[] = [];
    mountNameEditor(box, 'PAT', (n) => names.push(n));
    const button = box.querySelector<HTMLButtonElement>('.call-display')!;
    expect(button.getAttribute('aria-label')).toBe('Your name: PAT. Change');
    button.click();
    const field = box.querySelector('input')!;
    field.value = 'al3x';
    box.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(names).toEqual([]);
    expect(box.querySelector('.call-error')!.textContent).toBe('Use 2–10 letters.');
    field.value = 'alex';
    box.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(names).toEqual(['ALEX']);
    expect(button.textContent).toContain('ALEX');
  });
});
