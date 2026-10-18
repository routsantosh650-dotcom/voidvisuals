import React, { useEffect, useRef, useState } from 'react';

const INTERACTIVE = 'button, a, input, select, textarea, .plan-card, .btn, .nav-link';

const CURSOR_CSS = `
.vv-cursor-layer{pointer-events:none;position:fixed;inset:0;z-index:9999}
.vv-cursor-dot,.vv-cursor-ring{position:fixed;left:0;top:0;border-radius:9999px;opacity:0;pointer-events:none;will-change:transform;transition:opacity .15s ease}
.vv-cursor-dot{width:10px;height:10px;margin:-5px 0 0 -5px;background:#ffb43d;background-image:radial-gradient(closest-side,rgba(255,122,24,.55),transparent)}
.vv-cursor-ring{width:42px;height:42px;margin:-21px 0 0 -21px;border:1px solid rgba(255,180,61,.65)}
.vv-cursor-dot::after,.vv-cursor-ring::after{content:'';position:absolute;inset:-1px;border-radius:inherit;transition:transform .18s ease,background-color .18s ease,opacity .18s ease}
.vv-cursor-dot::after{inset:-9px;background:radial-gradient(closest-side,rgba(255,122,24,.35),transparent 72%)}
.vv-cursor-ring::after{inset:-12px;background:radial-gradient(closest-side,rgba(255,122,24,.3),transparent 70%);opacity:.55}
.vv-cursor-dot.is-hover{background:#fff}
.vv-cursor-ring.is-hover::after{opacity:1;background:radial-gradient(closest-side,rgba(255,180,61,.4),transparent 68%)}
.vv-cursor-ring.is-hover{border-color:rgba(255,180,61,.9)}
html.has-custom-cursor,html.has-custom-cursor *{cursor:none !important}
`;

/**
 * Dot + trailing ring cursor, driven by one rAF loop that writes both transforms exactly once per
 * frame. Its smoothing is normalised to elapsed time, so a 144Hz screen does not trail twice as
 * fast (or a stuttering one twice as slow) as a 60Hz screen. The glow is a radial gradient rather
 * than a blurred box-shadow: a shadow re-rasterises on every pixel of movement, a gradient just
 * rides along on the composited layer. Disabled on touch devices, where there is no pointer.
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

    // Reduced motion: no trail at all, the ring rides exactly under the pointer.
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let targetX = -100;
    let targetY = -100;
    let ringX = -100;
    let ringY = -100;
    let last = 0;
    let hovered = false;
    let visible = false;
    let raf = 0;

    const render = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16.7;
      last = now;
      // Same catch-up distance per second regardless of how many frames that second had.
      const k = still ? 1 : 1 - Math.pow(1 - 0.3, dt / 16.7);
      ringX += (targetX - ringX) * k;
      ringY += (targetY - ringY) * k;
      // Both writes happen once per frame: a gaming mouse fires pointermove up to 1000 times a
      // second, and writing styles that often is what actually makes the cursor stutter.
      dot.style.transform = `translate3d(${targetX}px,${targetY}px,0)`;
      ring.style.transform = `translate3d(${ringX}px,${ringY}px,0)`;
      const settled = Math.abs(targetX - ringX) < 0.1 && Math.abs(targetY - ringY) < 0.1;
      if (settled) {
        raf = 0;
        last = 0;
        return;
      }
      raf = requestAnimationFrame(render);
    };

    const setVisible = (v: boolean) => {
      if (v === visible) return;
      visible = v;
      dot.style.opacity = v ? '1' : '0';
      ring.style.opacity = v ? '1' : '0';
      if (v) {
        ringX = targetX;
        ringY = targetY;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (!visible) setVisible(true);
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
