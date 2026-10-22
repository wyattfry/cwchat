/** Output delay above which the sidetone feels out of step with the key. */
export const NOTICEABLE_DELAY_MS = 60;

/**
 * Explains a noticeable audio output delay, or returns null when the delay is small or unknown.
 * `seconds` is the browser-reported base plus output latency.
 */
export function audioDelayNote(seconds: number | undefined): string | null {
  if (seconds === undefined || !Number.isFinite(seconds)) return null;
  const ms = Math.round((seconds * 1000) / 10) * 10;
  if (ms < NOTICEABLE_DELAY_MS) return null;
  return (
    `Your audio output adds about ${ms} ms of delay, so the tone lags your key. ` +
    'Bluetooth headphones often do this; wired headphones or speakers stay in step. ' +
    'Decoding uses your key timing and is not affected.'
  );
}
