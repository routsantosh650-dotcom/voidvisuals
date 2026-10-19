import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Check, Coins } from 'lucide-react';
import { CURRENCIES, currencyMeta } from '../data/vvData';
import { usePrefs, useT, setPrefs } from '../lib/prefs';

/**
 * Header picker: display currency (prices are stored in INR and only reformatted). It owns the
 * shared popover — outside click, Escape, focus ring — which the removed language switcher also
 * used, so the currency control keeps all of that behaviour.
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
