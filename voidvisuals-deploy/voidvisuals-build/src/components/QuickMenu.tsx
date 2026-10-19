import './QuickMenu.css';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  ArrowUp,
  Briefcase,
  Check,
  Copy,
  FolderOpen,
  LogIn,
  MessageCircle,
  MessageSquare,
  Rocket,
  ShoppingCart,
  Sparkles,
  Tag,
} from 'lucide-react';
import { isTouchUi, prefersReducedMotion } from '../lib/motion';

export interface QuickMenuProps {
  brandName: string;
  contactEmail: string;
  whatsappUrl: string;
  signedIn: boolean;
  cartCount: number;
  onNavigate: (path: string) => void;
  onOpenChat: () => void;
  onOpenCart: () => void;
  onSignIn: () => void;
}

const STORAGE_KEY = 'vv_qm_pill_dismissed';
const VIEWPORT_MARGIN = 12;
// The entrance + fade are pure CSS (QuickMenu.css) — this only has to outlast them before
// unmounting the pill so a dismissed teaching pill never stays in the tab order.
const PILL_FADE_MS = 500;

type CopyState = 'idle' | 'copied' | 'error';
type Point = { x: number; y: number };
type Size = { w: number; h: number };

function readDismissedPill(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The custom menu must never steal the browser menu where it is genuinely useful:
 * form fields, contenteditable regions, selects, and any box opted out with
 * [data-allow-native-menu]. In those cases we return true and leave the native menu alone.
 */
function shouldUseNativeMenu(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, [data-allow-native-menu]')) return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return false;
}

/**
 * QuickMenu — VoidVisuals' right-click command palette. It suppresses the native context menu
 * site-wide, opens a clamped glass panel at the pointer (flipping near edges), and keeps a small
 * teaching pill in the bottom-left corner until the visitor has used the gesture twice.
 */
export function QuickMenu({
  brandName,
  contactEmail,
  whatsappUrl,
  signedIn,
  cartCount,
  onNavigate,
  onOpenChat,
  onOpenCart,
  onSignIn,
}: QuickMenuProps) {
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<Point>({ x: 24, y: 24 });
  // Measured after first mount; the defaults are close enough that the pre-paint correction
  // (see useLayoutEffect) is what the visitor actually sees.
  const [size, setSize] = useState<Size>({ w: 272, h: 420 });
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [dismissed, setDismissed] = useState<boolean>(readDismissedPill);
  // On touch the right-click gesture does not exist (see the contextmenu guard), so the teaching
  // pill starts already-gone rather than sitting over the chat button promising nothing.
  const [pillGone, setPillGone] = useState<boolean>(() => readDismissedPill || isTouchUi());

  const panelRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const usageRef = useRef(0);
  const copyTimerRef = useRef<number | undefined>(undefined);
  const fadeTimerRef = useRef<number | undefined>(undefined);
  const dismissStartedRef = useRef<boolean>(dismissed);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setCopyState('idle');
    window.clearTimeout(copyTimerRef.current);
  }, []);

  // The pill fades permanently once the gesture has been used twice (survives reloads).
  const bumpUsage = useCallback(() => {
    usageRef.current += 1;
    if (usageRef.current < 2 || dismissStartedRef.current) return;
    dismissStartedRef.current = true;
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* storage may be blocked — non-fatal */
    }
    window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => setPillGone(true), PILL_FADE_MS);
  }, []);

  const openMenuAt = useCallback(
    (x: number, y: number) => {
      setPoint({ x, y });
      setOpen(true);
      bumpUsage();
    },
    [bumpUsage]
  );

  // Suppress the native menu site-wide, but never where it is needed.
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (shouldUseNativeMenu(e.target)) return;
      // On a phone the only way to fire contextmenu is a long press, and there the native menu is
      // exactly what people want (copy link, save image). The Quick Menu is a mouse gesture.
      if (isTouchUi()) return;
      // Right-clicking inside the open panel keeps it where it is (just block the native menu).
      if (panelRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      openMenuAt(e.clientX, e.clientY);
    };
    window.addEventListener('contextmenu', onContextMenu);
    return () => window.removeEventListener('contextmenu', onContextMenu);
  }, [openMenuAt]);

  // While open: dismiss on outside pointerdown, Escape, scroll or resize.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || pillRef.current?.contains(t)) return;
      closeMenu();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const dismiss = () => closeMenu();
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', dismiss, { capture: true, passive: true });
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', dismiss, { capture: true });
      window.removeEventListener('resize', dismiss);
    };
  }, [open, closeMenu]);

  // Measure the panel and move focus to the first row — synchronously, before paint.
  useLayoutEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setSize((prev) => (Math.abs(prev.w - w) > 1 || Math.abs(prev.h - h) > 1 ? { w, h } : prev));
    el.querySelector<HTMLElement>('.qm-item')?.focus();
  }, [open]);

  // Clear pending timers on unmount.
  useEffect(
    () => () => {
      window.clearTimeout(copyTimerRef.current);
      window.clearTimeout(fadeTimerRef.current);
    },
    []
  );

  // Clamp into the viewport and flip across the pointer near the right / bottom edges.
  const { w, h } = size;
  let left = point.x;
  let top = point.y;
  if (left + w > window.innerWidth - VIEWPORT_MARGIN) left = point.x - w;
  if (top + h > window.innerHeight - VIEWPORT_MARGIN) top = point.y - h;
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - w - VIEWPORT_MARGIN));
  top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - h - VIEWPORT_MARGIN));
  const originX = Math.min(Math.max(point.x - left, 0), w);
  const originY = Math.min(Math.max(point.y - top, 0), h);

  const act = (fn: () => void) => {
    fn();
    closeMenu();
  };

  // Arrow / Home / End roving focus between menu rows.
  const onPanelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('.qm-item') ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next = current;
    if (e.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
    else if (e.key === 'ArrowUp') next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else next = items.length - 1;
    items[next]?.focus();
  };

  const handleCopyEmail = () => {
    window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopyState('idle'), 1500);
    try {
      navigator.clipboard.writeText(contactEmail).then(
        () => setCopyState('copied'),
        () => setCopyState('error')
      );
    } catch {
      // Insecure context or clipboard blocked entirely.
      setCopyState('error');
    }
    // Deliberately keep the panel open so the inline "Copied" / "Press Ctrl+C" state is visible.
  };

  const openWhatsApp = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    closeMenu();
  };

  const backToTop = () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <>
      {!pillGone && (
        <div
          ref={pillRef}
          className={dismissed ? 'qm-pill is-dismissed' : 'qm-pill'}
          aria-hidden={dismissed || undefined}
        >
          <button
            type="button"
            className="qm-pill-btn"
            tabIndex={dismissed ? -1 : 0}
            aria-label="Open quick menu — or right-click anywhere"
            onClick={() => {
              const rect = pillRef.current?.getBoundingClientRect();
              openMenuAt(rect ? rect.left : 24, rect ? rect.top : 24);
            }}
          >
            <Sparkles className="qm-ico" aria-hidden="true" />
            <span>Quick Menu (Right-Click)</span>
          </button>
        </div>
      )}

      {open && (
        <div
          ref={panelRef}
          className="qm-panel"
          role="menu"
          aria-label={`${brandName} quick menu`}
          onKeyDown={onPanelKeyDown}
          style={{
            left: `${left}px`,
            top: `${top}px`,
            transformOrigin: `${originX}px ${originY}px`,
          }}
        >
          <button type="button" role="menuitem" className="qm-item" onClick={() => act(() => onNavigate('/contact'))}>
            <Rocket className="qm-ico" aria-hidden="true" />
            <span className="qm-label">Start a project</span>
          </button>

          <button type="button" role="menuitem" className="qm-item" onClick={() => act(() => onNavigate('/plans'))}>
            <Tag className="qm-ico" aria-hidden="true" />
            <span className="qm-label">See plans &amp; prices</span>
          </button>

          <button type="button" role="menuitem" className="qm-item" onClick={() => act(() => onNavigate('/work'))}>
            <Briefcase className="qm-ico" aria-hidden="true" />
            <span className="qm-label">View recent work</span>
          </button>

          <button type="button" role="menuitem" className="qm-item" onClick={() => act(onOpenCart)}>
            <ShoppingCart className="qm-ico" aria-hidden="true" />
            <span className="qm-label">Open cart</span>
            {cartCount > 0 && (
              <span className="qm-badge" aria-label={`${cartCount} in cart`}>
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>

          <button type="button" role="menuitem" className="qm-item" onClick={() => act(onOpenChat)}>
            <MessageSquare className="qm-ico" aria-hidden="true" />
            <span className="qm-label">Chat with us</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className={`qm-item${copyState === 'copied' ? ' is-copied' : ''}`}
            onClick={handleCopyEmail}
          >
            {copyState === 'copied' ? (
              <Check className="qm-ico" aria-hidden="true" />
            ) : (
              <Copy className="qm-ico" aria-hidden="true" />
            )}
            <span className="qm-label">Copy email</span>
            {copyState === 'copied' && <span className="qm-hint">Copied</span>}
            {copyState === 'error' && <span className="qm-hint">Press Ctrl+C</span>}
          </button>

          <a
            role="menuitem"
            className="qm-item"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={openWhatsApp}
          >
            <MessageCircle className="qm-ico" aria-hidden="true" />
            <span className="qm-label">WhatsApp</span>
          </a>

          <button
            type="button"
            role="menuitem"
            className="qm-item"
            onClick={() => act(signedIn ? () => onNavigate('/portal') : onSignIn)}
          >
            {signedIn ? (
              <FolderOpen className="qm-ico" aria-hidden="true" />
            ) : (
              <LogIn className="qm-ico" aria-hidden="true" />
            )}
            <span className="qm-label">{signedIn ? 'My projects' : 'Sign in'}</span>
          </button>

          <button type="button" role="menuitem" className="qm-item" onClick={() => act(backToTop)}>
            <ArrowUp className="qm-ico" aria-hidden="true" />
            <span className="qm-label">Back to top</span>
          </button>

          <div className="qm-foot">
            <span className="qm-brand">{brandName}</span>
            <span className="qm-esc">Esc to close</span>
          </div>
        </div>
      )}
    </>
  );
}

export default QuickMenu;
