import { useCallback, useSyncExternalStore } from 'react';
import type { CurrencyCode } from '../data/vvData';
import { LANG_FALLBACK, UI_TEXT, type LangCode } from '../data/i18n';

/**
 * Visitor preferences (display currency + site language) in one tiny external store, so the header,
 * the plan cards and the footer all read the same value without prop-drilling through every page.
 * Persisted in localStorage; a private-mode or blocked storage never breaks the site.
 */

const STORAGE_KEY = 'vv.prefs.v1';

export interface Prefs {
  currency: CurrencyCode;
  lang: LangCode;
}

const isCurrency = (value: string): value is CurrencyCode => /^[A-Z]{3}$/.test(value);
const isLang = (value: string): value is LangCode =>
  (Object.keys(UI_TEXT) as string[]).includes(value);

function read(): Prefs {
  const base: Prefs = { currency: 'INR', lang: 'en' };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    if (typeof parsed.currency === 'string' && isCurrency(parsed.currency)) base.currency = parsed.currency;
    if (typeof parsed.lang === 'string' && isLang(parsed.lang)) base.lang = parsed.lang;
  } catch {
    /* first visit, or storage is blocked — defaults are fine */
  }
  return base;
}

let current: Prefs = typeof window === 'undefined' ? { currency: 'INR', lang: 'en' } : read();
const listeners = new Set<() => void>();

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

const getSnapshot = () => current;

export function setPrefs(patch: Partial<Prefs>) {
  const next: Prefs = { ...current, ...patch };
  if (next.currency === current.currency && next.lang === current.lang) return;
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* still applied in memory for this visit */
  }
  listeners.forEach((fn) => fn());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** t('nav.plans') → the string in the visitor's language, English when a key is missing. */
export function useT(): (key: string) => string {
  const { lang } = usePrefs();
  return useCallback(
    (key: string) => UI_TEXT[lang]?.[key] ?? UI_TEXT[LANG_FALLBACK]?.[key] ?? key,
    [lang]
  );
}

export function useSetCurrency() {
  return useCallback((currency: CurrencyCode) => setPrefs({ currency }), []);
}

export function useSetLang() {
  return useCallback((lang: LangCode) => setPrefs({ lang }), []);
}
