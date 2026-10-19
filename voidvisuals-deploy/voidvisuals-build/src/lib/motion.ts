/**
 * Motion layer (GSAP + ScrollTrigger).
 *
 * Every animation in the app is declarative: put data-reveal / data-split / data-count /
 * data-parallax on an element and call refreshReveals() after the DOM changes. Elements that
 * are never seen by ScrollTrigger are forced visible, and the whole layer is a no-op when the
 * visitor asked for reduced motion — so content can never be trapped at opacity 0.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const TRIGGER_CLASS = 'vv-reveal';

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Phones and tablets get the static layout: the mobile URL bar collapses and expands on every
 * scroll, which fires resize → ScrollTrigger.refresh() → reveal triggers re-armed, so sections
 * fade and scale in over and over ("zoom zoom out"). Same for tilt, whose pointerleave never
 * fires on touch, leaving cards stuck mid-pop.
 */
export function isTouchUi(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none), (pointer: coarse)').matches;
}

const OFFSET: Record<string, { y: number; x: number; scale: number; blur: number }> = {
  up: { y: 42, x: 0, scale: 1, blur: 0 },
  down: { y: -42, x: 0, scale: 1, blur: 0 },
  left: { y: 0, x: -56, scale: 1, blur: 0 },
  right: { y: 0, x: 56, scale: 1, blur: 0 },
  scale: { y: 0, x: 0, scale: 0.94, blur: 0 },
  blur: { y: 24, x: 0, scale: 1, blur: 10 },
};

function splitWords(el: HTMLElement) {
  // A translated headline arrives as plain text again (React replaces the word spans), so the
  // guard has to look for the markup, not just the flag — otherwise a re-split never happens.
  if (el.dataset.splitDone === '1' && el.querySelector('.wi')) return;
  const text = (el.textContent || '').trim();
  if (!text) return;
  el.dataset.splitDone = '1';
  el.innerHTML = text
    .split(/\s+/)
    .map(
      (word) =>
        `<span class="w" aria-hidden="false"><span class="wi">${word}</span></span>`
    )
    .join(' ');
  // Screen readers still get the original sentence.
  el.setAttribute('aria-label', text);
}

function revealOne(el: HTMLElement) {
  const kind = (el.dataset.reveal || 'up').toLowerCase();
  const o = OFFSET[kind] || OFFSET.up;
  const delay = Number(el.dataset.delay || 0);
  gsap.set(el, { opacity: 0, y: o.y, x: o.x, scale: o.scale, filter: o.blur ? `blur(${o.blur}px)` : 'none' });
  gsap.to(el, {
    opacity: 1,
    y: 0,
    x: 0,
    scale: 1,
    filter: 'blur(0px)',
    duration: 0.9,
    delay,
    ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 88%', once: true, classes: TRIGGER_CLASS },
  });
}

function revealSplit(el: HTMLElement) {
  splitWords(el);
  const parts = Array.from(el.querySelectorAll<HTMLElement>('.wi'));
  if (!parts.length) return;
  gsap.set(el, { opacity: 1 });
  gsap.set(parts, { yPercent: 118, opacity: 0, rotate: 3 });
  gsap.to(parts, {
    yPercent: 0,
    opacity: 1,
    rotate: 0,
    duration: 1,
    stagger: 0.055,
    ease: 'power4.out',
    delay: Number(el.dataset.delay || 0),
    scrollTrigger: { trigger: el, start: 'top 92%', once: true, classes: TRIGGER_CLASS },
  });
}

function runCounter(el: HTMLElement) {
  const target = Number(el.dataset.count || 0);
  if (!Number.isFinite(target)) return;
  const suffix = el.dataset.suffix || '';
  const obj = { v: 0 };
  gsap.to(obj, {
    v: target,
    duration: 1.6,
    ease: 'power2.out',
    onUpdate: () => {
      el.textContent = `${Math.round(obj.v).toLocaleString('en-IN')}${suffix}`;
    },
    scrollTrigger: { trigger: el, start: 'top 92%', once: true, classes: TRIGGER_CLASS },
  });
}

function runParallax(el: HTMLElement) {
  const shift = Number(el.dataset.parallax || 12);
  gsap.to(el, {
    yPercent: shift,
    ease: 'none',
    scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true, classes: TRIGGER_CLASS },
  });
}

/**
 * (Re)binds every motion hook in the document. Safe to call after each route change:
 * previously created triggers are killed first, so nothing animates twice or stacks up.
 */
export function refreshReveals() {
  ScrollTrigger.getAll()
    .filter((t) => t.classes && String(t.classes).includes(TRIGGER_CLASS))
    .forEach((t) => t.kill(true));

  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal],[data-split],[data-count],[data-parallax]'));

  if (prefersReducedMotion() || isTouchUi()) {
    nodes.forEach((el) => {
      if (el.dataset.split) {
        splitWords(el);
        gsap.set(Array.from(el.querySelectorAll('.wi')), { opacity: 1, yPercent: 0, rotate: 0 });
      }
      gsap.set(el, { opacity: 1, y: 0, x: 0, scale: 1, filter: 'none' });
      if (el.dataset.count) {
        el.textContent = `${Number(el.dataset.count).toLocaleString('en-IN')}${el.dataset.suffix || ''}`;
      }
    });
    ScrollTrigger.refresh();
    return;
  }

  nodes.forEach((el) => {
    if (el.dataset.split) revealSplit(el);
    else if (el.dataset.reveal) revealOne(el);
    if (el.dataset.count) runCounter(el);
    if (el.dataset.parallax) runParallax(el);
  });

  ScrollTrigger.refresh();
}

/** Card lift toward the pointer. Attach to the element you want to tilt. */
export function attachTilt(el: HTMLElement, max = 7) {
  if (prefersReducedMotion() || isTouchUi()) return () => {};
  const onMove = (e: PointerEvent) => {
    const b = el.getBoundingClientRect();
    const px = (e.clientX - b.left) / b.width - 0.5;
    const py = (e.clientY - b.top) / b.height - 0.5;
    gsap.to(el, { rotateY: px * max, rotateX: -py * max, z: 18, duration: 0.5, ease: 'power2.out', transformPerspective: 900 });
    el.style.setProperty('--mx', `${((e.clientX - b.left) / b.width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - b.top) / b.height) * 100}%`);
  };
  const onLeave = () => gsap.to(el, { rotateY: 0, rotateX: 0, z: 0, duration: 0.7, ease: 'power3.out' });
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  return () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
  };
}

/** Button that leans slightly toward the cursor. */
export function attachMagnetic(el: HTMLElement, strength = 12) {
  if (prefersReducedMotion() || isTouchUi()) return () => {};
  const onMove = (e: PointerEvent) => {
    const b = el.getBoundingClientRect();
    gsap.to(el, {
      x: (e.clientX - (b.left + b.width / 2)) * 0.18 * strength * 0.2,
      y: (e.clientY - (b.top + b.height / 2)) * 0.18 * strength * 0.2,
      duration: 0.5,
      ease: 'power3.out',
    });
  };
  const onLeave = () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1,0.5)' });
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  return () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
  };
}

/** Enters a freshly mounted page with a soft rise. */
export function pageEnter(el: HTMLElement | null) {
  if (!el || prefersReducedMotion() || isTouchUi()) return;
  gsap.fromTo(
    el,
    { opacity: 0, y: 26 },
    { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', clearProps: 'transform' }
  );
}
