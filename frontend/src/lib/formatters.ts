/** Formatting utilities for the AEGIS-X frontend. */

/** Format a fraction [0,1] as a percentage string e.g. "82.4%" */
export function fmtPct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format a number with fixed decimals */
export function fmtNum(value: number, decimals = 3): string {
  return value.toFixed(decimals);
}

/** Format elapsed milliseconds as "1.23s" or "450ms" */
export function fmtDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

/** Capitalise the first letter of a string */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
