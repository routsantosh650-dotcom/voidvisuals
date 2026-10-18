import React, { useEffect, useRef, useState } from 'react';

const INTERACTIVE = 'button, a, input, select, textarea, .plan-card, .btn, .nav-link';

const CURSOR_CSS = `
.vv-cursor-layer{pointer-events:none;position:fixed;inset:0;z-index:9999;contain:layout style paint}
.vv-cursor-dot,.vv-cursor-ring{position:fixed;left:0;top:0;border-radius:9999px;opacity:0;pointer-events:none;will-change:transform;transition:opacity .15s ease}
.vv-cursor-dot{width:10px;height:10px;margin:-5px 0 0 -5px;background:var(--gold,#ffb43d);box-shadow:0 0 16px rgba(255,122,24,.9)}
.vv-cursor-ring{width:42px;height:42px;margin:-21px 0 0 -21px;border:1px solid rgba(255,180,61,.65)}
.vv-cursor-dot::after,.vv-cursor-ring::after{content:'';position:absolute;inset:-1px;border-radius:inherit;transition:transform .18s ease,background-color .18s ease,box-shadow .18s ease,border-color .18s ease}
.vv-cursor-dot.is-hover::after{background:#fff;transform:scale(1.3)}
.vv-cursor-ring.is-hover::after{transform:scale(1.45);background:linear-gradient(96deg,rgba(255,122,24,.22),rgba(255,180,61,.18) 50%,rgba(255,90,46,.18));box-shadow:0 0 26px rgba(255,122,24,.5);border:1px solid rgba(255,180,61,.8)}
html.has-custom-cursor,html.has-custom-cursor *{cursor:none !important}
`;

/**
 * Dot + trailing ring cursor, driven by one requestAnimationFrame loop that only writes
 * transforms. Disabled on touch devices, where there is no pointer to follow.
 */
export const CustomCursor: React.FC = () => {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    setEnabled(finePointer && navigator.webdriver !== true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    document.documentElement.classList.add('has-custom-cursor');

    let targetX = -100;
    let targetY = -100;
    let ringX = -100;
    let ringY = -100;
    let hovered = false;
    let visible = false;
    let raf = 0;

    const render = () => {
      ringX += (targetX - ringX) * 0.22;
      ringY += (targetY - ringY) * 0.22;
      dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      const settled = Math.abs(targetX - ringX) < 0.1 && Math.abs(targetY - ringY) < 0.1;
      raf = settled ? 0 : requestAnimationFrame(render);
    };

    const setVisible = (v: boolean) => {
      if (v === visible) return;
      visible = v;
      dot.style.opacity = v ? '1' : '0';
      ring.style.opacity = v ? '1' : '0';
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (!visible) {
        ringX = e.clientX;
        ringY = e.clientY;
        setVisible(true);
      }
      targetX = e.clientX;
      targetY = e.clientY;
      if (!raf) raf = requestAnimationFrame(render);
    };

    const onOver = (e: MouseEvent) => {
      const isInteractive = Boolean((e.target as HTMLElement | null)?.closest?.(INTERACTIVE));
      if (isInteractive === hovered) return;
      hovered = isInteractive;
      dot.classList.toggle('is-hover', hovered);
      ring.classList.toggle('is-hover', hovered);
    };

    const onLeave = () => setVisible(false);

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove('has-custom-cursor');
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="vv-cursor-layer">
      <style>{CURSOR_CSS}</style>
      <div ref={ringRef} className="vv-cursor-ring" />
      <div ref={dotRef} className="vv-cursor-dot" />
    </div>
  );
};
