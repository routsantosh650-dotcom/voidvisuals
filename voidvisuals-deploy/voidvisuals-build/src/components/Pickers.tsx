import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Check, Coins, Globe } from 'lucide-react';
import { CURRENCIES, currencyMeta } from '../data/vvData';
import { LANGUAGES } from '../data/i18n';
import { usePrefs, useT, setPrefs } from '../lib/prefs';

/**
 * Header pickers: display currency (prices are stored in INR and only reformatted) and site
 * language. Both share one popover, so the behaviour — outside click, Escape, focus ring — can
 * never drift between them.
 */

function usePopover() {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (open && popRef.current) {
      gsap.fromTo(
        popRef.current,
        { opacity: 0, y: -6, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.18, ease: 'power3.out' }
      );
    }
  }, [open]);

  return { open, setOpen, boxRef, popRef };
}

export const CurrencyPicker: React.FC = () => {
  const { currency } = usePrefs();
  const { open, setOpen, boxRef, popRef } = usePopover();
  const t = useT();
  const meta = currencyMeta(currency);

  return (
    <div className="pref" ref={boxRef}>
      <button
        type="button"
        className="pref-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('cur.title')} — ${meta.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Coins size={14} />
        <span className="mono">{meta.code}</span>
      </button>
      {open ? (
        <div className="pref-pop" role="listbox" ref={popRef}>
          <div className="pref-head">
            <span>{t('cur.title')}</span>
            <span className="mono">FX</span>
          </div>
          <div className="pref-list">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={c.code === currency}
                className={`pref-item ${c.code === currency ? 'is-on' : ''}`}
                onClick={() => {
                  setPrefs({ currency: c.code });
                  setOpen(false);
                }}
              >
                <span className="sym">{c.symbol}</span>
                <span className="mono">{c.code}</span>
                <span className="nm">{c.name}</span>
                {c.code === currency ? <Check size={14} className="tick" /> : null}
              </button>
            ))}
          </div>
          <p className="pref-note">{t('cur.note')}</p>
        </div>
      ) : null}
    </div>
  );
};

export const LanguagePicker: React.FC = () => {
  const { lang } = usePrefs();
  const { open, setOpen, boxRef, popRef } = usePopover();
  const t = useT();
  const active = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div className="pref" ref={boxRef}>
      <button
        type="button"
        className="pref-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('lang.title')} — ${active.english}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Globe size={14} />
        <span className="mono">{active.code.toUpperCase()}</span>
      </button>
      {open ? (
        <div className="pref-pop" role="listbox" ref={popRef}>
          <div className="pref-head">
            <span>{t('lang.title')}</span>
            <span className="mono">{LANGUAGES.length}</span>
          </div>
          <div className="pref-list">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={l.code === lang}
                className={`pref-item ${l.code === lang ? 'is-on' : ''}`}
                onClick={() => {
                  setPrefs({ lang: l.code });
                  setOpen(false);
                }}
              >
                <span className="sym">{l.native.slice(0, 2)}</span>
                <span className="nm">{l.native}</span>
                <span className="mono">{l.code.toUpperCase()}</span>
                {l.code === lang ? <Check size={14} className="tick" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
