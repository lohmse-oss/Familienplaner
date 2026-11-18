import { useEffect, useState } from 'preact/hooks';

/**
 * Android beendet die App im Hintergrund gern (Speicher), wenn man kurz in eine andere App wechselt.
 * Beim Zurückkehren startet die WebView dann neu – ohne diese Sicherung wären offene Eingaben weg.
 * Darum wird der UI-Zustand (Tab, offenes Fenster, Entwürfe) laufend gesichert und beim Neustart
 * wiederhergestellt, sofern er nicht älter als MAX_AGE ist.
 */
const PREFIX = 'fp.ui.';
const MAX_AGE = 2 * 3600_000;

export function loadUi<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const { at, v } = JSON.parse(raw) as { at: number; v: T };
    return Date.now() - at < MAX_AGE ? v : fallback;
  } catch {
    return fallback;
  }
}

export function saveUi(key: string, v: unknown) {
  try {
    if (v === undefined || v === null || v === '') localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), v }));
  } catch {
    /* Speicher voll oder gesperrt */
  }
}

/** Wie useState, aber übersteht einen Neustart der App (z. B. nach App-Wechsel). */
export function useUiState<T>(key: string, init: T | (() => T), opts?: { clearOnUnmount?: boolean; accept?: (saved: T) => boolean }) {
  const [v, setV] = useState<T>(() => {
    const saved = loadUi<T | undefined>(key, undefined);
    if (saved !== undefined && saved !== null && (!opts?.accept || opts.accept(saved))) return saved;
    return typeof init === 'function' ? (init as () => T)() : init;
  });
  useEffect(() => saveUi(key, v), [v]);
  useEffect(() => (opts?.clearOnUnmount ? () => saveUi(key, null) : undefined), []);
  return [v, setV] as const;
}
