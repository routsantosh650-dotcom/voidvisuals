import React, { useEffect, useRef } from 'react';
import { attachMagnetic, attachTilt } from '../lib/motion';

/** Pointer tilt + glow for cards. Returns a ref to spread onto the element. */
export function useTilt<T extends HTMLElement>(max = 6) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) return attachTilt(el, max);
  }, [max]);
  return ref;
}

/** Button that leans toward the cursor. */
export function useMagnetic<T extends HTMLElement>(strength = 10) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) return attachMagnetic(el, strength);
  }, [strength]);
  return ref;
}

export const Tilt: React.FC<{
  className?: string;
  children: React.ReactNode;
  max?: number;
  style?: React.CSSProperties;
}> = ({ className = '', children, max = 6, style }) => {
  const ref = useTilt<HTMLDivElement>(max);
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
};
