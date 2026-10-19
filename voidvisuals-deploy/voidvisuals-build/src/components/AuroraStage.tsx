import React, { useEffect } from 'react';
import { isTouchUi, prefersReducedMotion } from '../lib/motion';

/**
 * The fixed aurora layer behind the whole site: three drifting colour blobs, a grid veil,
 * film grain and a pointer-tracked spotlight (--px/--py on <html>, read by .stage .spot).
 */
export const AuroraStage: React.FC = () => {
  useEffect(() => {
    // The spotlight is a mouse effect, and on touch the layer it feeds is display:none anyway.
    if (prefersReducedMotion() || isTouchUi()) return;
    const root = document.documentElement;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        root.style.setProperty('--px', `${(e.clientX / window.innerWidth) * 100}%`);
        root.style.setProperty('--py', `${(e.clientY / window.innerHeight) * 100}%`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="stage" aria-hidden="true">
      <span className="blob blob-b1" />
      <span className="blob blob-b2" />
      <span className="blob blob-b3" />
      <span className="veil" />
      <span className="spot" />
      <span className="grain" />
    </div>
  );
};
