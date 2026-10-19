/**
 * Minimal toast bus so any component can notify the user without prop drilling.
 * App.tsx renders the queue.
 */

export type ToastKind = 'good' | 'bad' | 'info';

export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

type Listener = (toast: Toast) => void;
const listeners = new Set<Listener>();
let seq = 0;

export function onToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function showToast(text: string, kind: ToastKind = 'info') {
  const toast: Toast = { id: ++seq, text: text.slice(0, 220), kind };
  listeners.forEach((fn) => fn(toast));
}
