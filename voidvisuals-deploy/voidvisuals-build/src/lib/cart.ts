/**
 * The studio cart — a tiny external store (same shape as src/lib/prefs.ts) that holds the
 * items a visitor wants to buy. Nothing here trusts a price: lines carry the plan name and the
 * price the browser can see, but /api/order recomputes every rupee from Firestore before an
 * order is written, and firestore.rules re-checks it again.
 *
 * Payment is a UPI intent: the checkout builds `upi://pay?...` for the exact total, the visitor
 * scans it with any UPI app, and the order waits for the studio to confirm the payment. No
 * gateway, no card data, nothing stored that could leak.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { UPI, type PlanDoc } from '../data/vvData';

const STORAGE_KEY = 'vv.cart.v1';

export interface CartLine {
  planId: string;
  name: string;
  priceInr: number;
  periodLabel: string;
  category: 'website' | 'addon' | 'care';
  qty: number;
}

export interface CartState {
  lines: CartLine[];
  coupon: string;
}

const EMPTY: CartState = { lines: [], coupon: '' };

/** Care plans are bought per month, extra pages per page; a website tier is always one. */
const maxQty = (category: CartLine['category']) => (category === 'website' ? 1 : category === 'care' ? 12 : 10);

/**
 * Six lines maximum. /api/order re-reads each plan from Firestore to price the cart, and
 * firestore.rules is allowed only 10 document reads for the resulting write — so the cart ceiling
 * has to stay below that. Anything bigger belongs in a brief, not a checkout.
 */
const MAX_LINES = 6;

const isCategory = (v: unknown): v is CartLine['category'] =>
  v === 'website' || v === 'addon' || v === 'care';

function read(): CartState {
  const base = EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<CartState>;
    const lines = Array.isArray(parsed.lines)
      ? parsed.lines
          .map((item) => {
            const x = (item || {}) as Record<string, unknown>;
            const price = typeof x.priceInr === 'number' ? Math.round(x.priceInr) : 0;
            const cat = isCategory(x.category) ? x.category : 'addon';
            return {
              planId: typeof x.planId === 'string' ? x.planId.slice(0, 64) : '',
              name: typeof x.name === 'string' ? x.name.slice(0, 60) : '',
              priceInr: price > 0 && price <= 200000 ? price : 0,
              periodLabel: typeof x.periodLabel === 'string' ? x.periodLabel.slice(0, 40) : '',
              category: cat,
              qty: Math.min(maxQty(cat), Math.max(1, Math.round(typeof x.qty === 'number' ? x.qty : 1))),
            } satisfies CartLine;
          })
          .filter((l) => l.planId && l.name && l.priceInr > 0)
          .slice(0, MAX_LINES)
      : [];
    const coupon = typeof parsed.coupon === 'string' ? parsed.coupon.toUpperCase().slice(0, 24) : '';
    return { lines, coupon };
  } catch {
    /* first visit, or storage is blocked — an empty cart is fine */
  }
  return base;
}

let current: CartState = typeof window === 'undefined' ? EMPTY : read();
const listeners = new Set<() => void>();

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

const getSnapshot = () => current;

function commit(next: CartState) {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* still applied in memory for this visit */
  }
  listeners.forEach((fn) => fn());
}

export function clearCart() {
  if (!current.lines.length && !current.coupon) return;
  commit(EMPTY);
}

export function setCoupon(code: string) {
  const next = { ...current, coupon: code.toUpperCase().slice(0, 24) };
  if (next.coupon === current.coupon) return;
  commit(next);
}

export function addPlan(plan: PlanDoc) {
  if (!plan.id || plan.priceInr < 1) return false;
  const existing = current.lines.find((l) => l.planId === plan.id);
  if (existing && existing.qty >= maxQty(existing.category)) return false;
  if (!existing && current.lines.length >= MAX_LINES) return false;
  const lines: CartLine[] = existing
    ? current.lines.map((l) =>
        l.planId === plan.id ? { ...l, qty: Math.min(maxQty(l.category), l.qty + 1) } : l
      )
    : [
        ...current.lines,
        {
          planId: plan.id,
          name: plan.name.slice(0, 60),
          priceInr: Math.round(plan.priceInr),
          periodLabel: plan.periodLabel.slice(0, 40),
          category: plan.category,
          qty: 1,
        },
      ];
  commit({ ...current, lines: lines.slice(0, MAX_LINES) });
  return true;
}

export function setLineQty(planId: string, qty: number) {
  const lines = current.lines
    .map((l) => (l.planId === planId ? { ...l, qty: Math.max(0, Math.min(maxQty(l.category), Math.round(qty))) } : l))
    .filter((l) => l.qty > 0);
  commit({ ...current, lines });
}

export function removeLine(planId: string) {
  commit({ ...current, lines: current.lines.filter((l) => l.planId !== planId) });
}

export function useCart(): CartState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export interface CartTotals {
  count: number;
  subtotalInr: number;
  discountInr: number;
  totalInr: number;
}

/** The single money calculation on the client, and it mirrors /api/order exactly. */
export function totalsOf(state: CartState, couponPercent: number): CartTotals {
  const subtotalInr = state.lines.reduce((sum, l) => sum + l.priceInr * l.qty, 0);
  const pct = Math.min(90, Math.max(0, Math.round(couponPercent)));
  // Floor, not round: Firestore rules can only do integer division, and the Worker has to agree
  // with the rules to the paisa, so all three sides truncate the same way.
  const discountInr = Math.floor((subtotalInr * pct) / 100);
  return {
    count: state.lines.reduce((sum, l) => sum + l.qty, 0),
    subtotalInr,
    discountInr,
    totalInr: Math.max(0, subtotalInr - discountInr),
  };
}

export function useCartTotals(couponPercent: number): CartTotals {
  const state = useCart();
  return useMemo(() => totalsOf(state, couponPercent), [state, couponPercent]);
}

/**
 * upi://pay deep link. Every value is encoded — the payee name carries a space, and an order
 * reference must not be able to smuggle extra query keys.
 */
export function upiIntent(amountInr: number, orderRef: string): string {
  const params = new URLSearchParams({
    pa: UPI.vpa,
    pn: UPI.payee,
    tn: `VoidVisuals ${orderRef}`.slice(0, 60),
    am: String(Math.max(1, Math.round(amountInr))),
    cu: 'INR',
  });
  return `upi://pay?${params.toString()}`;
}

export function useCartActions() {
  return useMemo(
    () => ({
      add: (plan: PlanDoc) => addPlan(plan),
      setQty: (planId: string, qty: number) => setLineQty(planId, qty),
      remove: (planId: string) => removeLine(planId),
      clear: () => clearCart(),
      setCoupon: (code: string) => setCoupon(code),
    }),
    []
  );
}

export function useSetCoupon() {
  return useCallback((code: string) => setCoupon(code), []);
}
