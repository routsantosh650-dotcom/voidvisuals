import React, { useEffect, useState } from 'react';
import { ArrowRight, Menu, ShoppingBag, Sparkles, X } from 'lucide-react';
import { navigate, usePath } from '../router';
import { useT } from '../lib/prefs';
import { useCart } from '../lib/cart';
import { CurrencyPicker } from './Pickers';
import { LiveClock } from './LiveClock';
import { VVLogo } from './VVLogo';

const NAV = [
  { href: '/studio', key: 'nav.studio', label: 'Studio' },
  { href: '/work', key: 'nav.work', label: 'Work' },
  { href: '/plans', key: 'nav.plans', label: 'Plans' },
  { href: '/contact', key: 'nav.contact', label: 'Contact' },
];

interface Props {
  brandName: string;
  signedIn: boolean;
  onOpenCart: () => void;
}

export const SiteHeader: React.FC<Props> = ({ brandName, signedIn, onOpenCart }) => {
  const t = useT();
  const cart = useCart();
  const cartCount = cart.lines.reduce((sum, l) => sum + l.qty, 0);
  const path = usePath();
  const [stuck, setStuck] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const top = window.scrollY || 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setStuck(top > 10);
      setProgress(max > 0 ? Math.min(100, (top / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => setOpen(false), [path]);

  const go = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    navigate(href);
  };

  const name = (brandName || 'VoidVisuals').trim();
  const cut = name.search(/\s/);
  const head = cut > 0 ? name.slice(0, cut) : 'Void';
  const tail = cut > 0 ? name.slice(cut + 1) : name.slice(4);

  return (
    <>
      <header className={`hdr ${stuck ? 'is-stuck' : ''}`}>
        <div className="hdr-inner">
          <a className="brand" href="/" onClick={(e) => go(e, '/')}>
            <span className="mark">
              <VVLogo />
            </span>
            <span>
              {head}<em>{tail}</em>
            </span>
          </a>

          <nav className="nav" aria-label="Main">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`nav-link ${path === item.href ? 'is-active' : ''}`}
                onClick={(e) => go(e, item.href)}
              >
                {t(item.key)}
              </a>
            ))}
          </nav>

          <div className="hdr-actions">
            <span className="hdr-clock">
              <LiveClock />
            </span>
            <CurrencyPicker />
            <button
              type="button"
              className={`hdr-cart ${cartCount ? 'is-on' : ''}`}
              onClick={onOpenCart}
              aria-label={cartCount ? `Cart — ${cartCount} item${cartCount > 1 ? 's' : ''}` : 'Cart is empty'}
            >
              <ShoppingBag size={15} />
              {cartCount ? <b>{cartCount}</b> : null}
            </button>
            <a
              className="btn btn-ghost btn-sm"
              href="/portal"
              onClick={(e) => go(e, '/portal')}
            >
              {signedIn ? t('nav.projects') : t('nav.signin')}
            </a>
            <a className="btn btn-primary btn-sm" href="/contact" onClick={(e) => go(e, '/contact')}>
              <Sparkles size={15} />
              {t('nav.start')}
            </a>
            <button
              type="button"
              className="menu-btn"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        <span className="hdr-progress" style={{ '--scroll': `${progress}%` } as React.CSSProperties} />
      </header>

      <div className={`drawer ${open ? 'is-open' : ''}`}>
        {NAV.map((item) => (
          <a key={item.href} href={item.href} onClick={(e) => go(e, item.href)}>
            {t(item.key)}
          </a>
        ))}
        <a href="/portal" onClick={(e) => go(e, '/portal')}>
          {signedIn ? t('nav.projects') : t('nav.clientSignin')}
        </a>
        <div className="drawer-prefs">
          <CurrencyPicker />
        </div>
        <a className="btn btn-primary" href="/contact" onClick={(e) => go(e, '/contact')} style={{ marginTop: 10 }}>
          {t('nav.start')} <ArrowRight size={16} className="arrow" />
        </a>
      </div>
    </>
  );
};
