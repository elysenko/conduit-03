/**
 * Namespaced browser storage.
 *
 * Mockups are served many-per-origin under `/<mockup_id>/` and storage is
 * origin-scoped, so every key is prefixed with the first path segment.
 * All localStorage access in the app must go through these helpers.
 */
const NS =
  (typeof location !== 'undefined' ? location.pathname.split('/')[1] : '') ||
  'app';

export const nsKey = (key: string): string => `${NS}:${key}`;

export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(nsKey(key));
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(nsKey(key), value);
  } catch {
    /* storage unavailable (private mode / quota) — non-fatal */
  }
}

export function removeKeys(...keys: string[]): void {
  try {
    for (const key of keys) {
      localStorage.removeItem(nsKey(key));
    }
  } catch {
    /* non-fatal */
  }
}
