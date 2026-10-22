import { el } from './render';
import { normalizeCallSign, normalizeName } from './script';

export interface InlineEditor {
  /** Updates the displayed value (ignored while the learner is editing). */
  setValue(value: string): void;
}

export interface InlineEditorOptions {
  /** What is being edited, e.g. "call sign". */
  noun: string;
  maxLength: number;
  /** Returns the normalized value, or null when it is not valid. */
  normalize: (input: string) => string | null;
  /** Shown when the value is not valid. */
  invalidMessage: string;
}

let editorCount = 0;

/**
 * Click-to-edit value in the header. It shows as a button; clicking it swaps in a text field.
 * Enter saves, Escape cancels, and leaving the field saves a valid value or cancels.
 */
export function mountInlineEditor(
  container: HTMLElement,
  initial: string,
  options: InlineEditorOptions,
  onChange: (value: string) => void,
): InlineEditor {
  let value = initial;
  const errorId = `inline-error-${++editorCount}`;
  const label = el('span', {}, value);
  const display = el('button', { type: 'button', className: 'call-display', title: `Change your ${options.noun}` }, label, el('span', { className: 'call-pencil' }, '✎'));
  display.querySelector('.call-pencil')?.setAttribute('aria-hidden', 'true');
  const input = el('input', { className: 'call-input', maxLength: options.maxLength, autocomplete: 'off', spellcheck: false });
  input.setAttribute('aria-label', `Your ${options.noun}`);
  input.setAttribute('autocapitalize', 'characters');
  const error = el('span', { className: 'call-error', id: errorId });
  error.setAttribute('role', 'alert');
  input.setAttribute('aria-describedby', errorId);
  const form = el('form', { className: 'call-editor', noValidate: true }, input, error);
  form.hidden = true;
  container.replaceChildren(display, form);

  const describe = () => display.setAttribute('aria-label', `Your ${options.noun}: ${value}. Change`);
  describe();

  function open(): void {
    input.value = value;
    input.removeAttribute('aria-invalid');
    error.textContent = '';
    display.hidden = true;
    form.hidden = false;
    input.focus();
    input.select();
  }

  function close(): void {
    form.hidden = true;
    display.hidden = false;
    display.focus();
  }

  function save(): boolean {
    const next = options.normalize(input.value);
    if (!next) {
      input.setAttribute('aria-invalid', 'true');
      error.textContent = options.invalidMessage;
      return false;
    }
    if (next !== value) {
      value = next;
      label.textContent = next;
      describe();
      onChange(next);
    }
    close();
    return true;
  }

  display.addEventListener('click', open);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    save();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });
  input.addEventListener('blur', () => {
    if (form.hidden) return;
    if (options.normalize(input.value)) save();
    else close();
  });

  return {
    setValue(call: string) {
      if (call === value || !form.hidden) return;
      value = call;
      label.textContent = call;
      describe();
    },
  };
}

/** Click-to-edit call sign: 3–10 letters, digits, or "/". */
export function mountCallSignEditor(container: HTMLElement, initial: string, onChange: (call: string) => void): InlineEditor {
  return mountInlineEditor(
    container,
    initial,
    { noun: 'call sign', maxLength: 10, normalize: normalizeCallSign, invalidMessage: 'Use 3–10 letters, digits, or /.' },
    onChange,
  );
}

/** Click-to-edit operator name: 2–10 letters. */
export function mountNameEditor(container: HTMLElement, initial: string, onChange: (name: string) => void): InlineEditor {
  return mountInlineEditor(
    container,
    initial,
    { noun: 'name', maxLength: 10, normalize: normalizeName, invalidMessage: 'Use 2–10 letters.' },
    onChange,
  );
}
