/**
 * Orders — the billing half of the studio.
 *
 * A customer builds a cart, pays through the UPI QR, and the Worker writes an order row whose
 * prices were recomputed from Firestore (never from the browser). firestore.rules then checks the
 * same numbers again and refuses a status change from anyone but the studio. Payment itself stays
 * off our servers on purpose: money moves inside the payer's own UPI app, so nothing card- or
 * bank-related is ever handled or stored here.
 */

import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { CartLine } from './cart';

export type OrderStatus = 'awaiting-payment' | 'paid' | 'building' | 'delivered' | 'cancelled';

export const ORDER_STATUSES: OrderStatus[] = [
  'awaiting-payment',
  'paid',
  'building',
  'delivered',
  'cancelled',
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  'awaiting-payment': 'Awaiting payment',
  paid: 'Payment received',
  building: 'Building',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export interface OrderItem {
  planId: string;
  name: string;
  priceInr: number;
  qty: number;
  lineTotalInr: number;
  periodLabel: string;
}

export interface OrderEvent {
  at: number;
  label: string;
  by: string;
}

export interface OrderDoc {
  id: string;
  ref: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  items: OrderItem[];
  coupon: string;
  subtotalInr: number;
  discountInr: number;
  totalInr: number;
  status: OrderStatus;
  txnRef: string;
  note: string;
  ownerEmail: string;
  timeline: OrderEvent[];
  createdAt: number;
}

export interface OrderDraft {
  name: string;
  email: string;
  phone: string;
  company: string;
  coupon: string;
  lines: CartLine[];
  /** Bot trap — a real person never fills it in. */
  website: string;
}

export interface OrderResult {
  ok: boolean;
  error?: string;
  order?: { id: string; ref: string; totalInr: number };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export function validateOrder(draft: OrderDraft): string | null {
  if (draft.website.trim()) return null; // silently drop bots
  if (draft.name.trim().length < 2) return 'Please tell us who the invoice is for.';
  if (draft.name.trim().length > 60) return 'Name is too long (60 characters max).';
  if (!EMAIL_RE.test(draft.email.trim())) return 'A working email address is needed for the invoice.';
  if (draft.phone.trim().length < 8 || draft.phone.trim().length > 24)
    return 'Please enter a reachable phone number.';
  if (!draft.lines.length) return 'Your cart is empty.';
  if (draft.lines.length > 6) return 'Six items is the most the checkout can hold — send a brief for a bigger project.';
  return null;
}

/** Ask the Worker to price the cart and open the order. Returns the UPI amount to pay. */
export async function createOrder(draft: OrderDraft): Promise<OrderResult> {
  const problem = validateOrder(draft);
  if (problem) return { ok: false, error: problem };

  const idToken = await auth.currentUser?.getIdToken().catch(() => '');

  try {
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        name: draft.name,
        email: draft.email,
        phone: draft.phone,
        company: draft.company,
        website: draft.website,
        coupon: draft.coupon,
        items: draft.lines.map((l) => ({ planId: l.planId, qty: l.qty })),
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; error?: string; id?: string; ref?: string; totalInr?: number; retryAfter?: number }
      | null;

    if (res.ok && data?.ok && data.id && data.ref) {
      return { ok: true, order: { id: data.id, ref: data.ref, totalInr: data.totalInr || 0 } };
    }
    if (res.status === 429) {
      const mins = Math.max(1, Math.round((data?.retryAfter || 900) / 60));
      return { ok: false, error: `Too many orders from this device. Try again in ${mins} minutes.` };
    }
    if (data?.error === 'spam-trap') return { ok: true }; // pretend success to bots
    return { ok: false, error: data?.error || 'Could not open the order. Please WhatsApp or email us.' };
  } catch {
    return { ok: false, error: 'Network problem — the order was not created. Please try again.' };
  }
}

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const money = (v: unknown) => Math.max(0, Math.min(200000 * 20, Math.round(num(v))));

function readOrderItem(raw: unknown): OrderItem | null {
  const x = (raw || {}) as Record<string, unknown>;
  const name = typeof x.name === 'string' ? x.name.slice(0, 60) : '';
  if (!name) return null;
  return {
    planId: typeof x.planId === 'string' ? x.planId.slice(0, 64) : '',
    name,
    priceInr: money(x.priceInr),
    qty: Math.max(1, Math.min(20, Math.round(num(x.qty, 1)))),
    lineTotalInr: money(x.lineTotalInr),
    periodLabel: typeof x.periodLabel === 'string' ? x.periodLabel.slice(0, 40) : '',
  };
}

function readOrder(id: string, x: Record<string, unknown>): OrderDoc {
  const rawStatus = typeof x.status === 'string' ? x.status : 'awaiting-payment';
  const ts = x.createdAt as { seconds?: number } | undefined;
  const items = Array.isArray(x.items)
    ? (x.items as unknown[]).map(readOrderItem).filter((v): v is OrderItem => v !== null).slice(0, 6)
    : [];
  const totalInr = money(x.totalInr);
  return {
    id,
    ref: typeof x.ref === 'string' ? x.ref.slice(0, 24) : id.toUpperCase(),
    name: typeof x.name === 'string' ? x.name : '',
    email: typeof x.email === 'string' ? x.email : '',
    phone: typeof x.phone === 'string' ? x.phone : '',
    company: typeof x.company === 'string' ? x.company : '',
    items,
    coupon: typeof x.coupon === 'string' ? x.coupon : '',
    subtotalInr: money(x.subtotalInr),
    discountInr: money(x.discountInr),
    // A row with no readable total is priced off its own lines rather than showing ₹0.
    totalInr: totalInr || items.reduce((sum, it) => sum + it.lineTotalInr, 0),
    status: (ORDER_STATUSES.includes(rawStatus as OrderStatus) ? rawStatus : 'awaiting-payment') as OrderStatus,
    txnRef: typeof x.txnRef === 'string' ? x.txnRef.slice(0, 40) : '',
    note: typeof x.note === 'string' ? x.note : '',
    ownerEmail: typeof x.ownerEmail === 'string' ? x.ownerEmail : '',
    timeline: Array.isArray(x.timeline)
      ? (x.timeline as unknown[])
          .map((t) => {
            const item = (t || {}) as Record<string, unknown>;
            return {
              at: num(item.at),
              label: typeof item.label === 'string' ? item.label.slice(0, 160) : '',
              by: typeof item.by === 'string' ? item.by.slice(0, 120) : '',
            };
          })
          .filter((e) => e.label)
          .slice(-20)
      : [],
    createdAt: ts?.seconds ? ts.seconds * 1000 : num(x.createdAtMs),
  };
}

/** Orders this signed-in account placed, newest first. */
export async function fetchMyOrders(email: string): Promise<{ orders: OrderDoc[]; error?: string }> {
  if (!email) return { orders: [] };
  try {
    // where() without orderBy(): a composite index may not exist yet, and a missing index would
    // silently return nothing. Sorting happens in memory instead.
    const snap = await getDocs(
      query(collection(db, 'orders'), where('ownerEmail', '==', email.toLowerCase()), limit(30))
    );
    const orders = snap.docs
      .map((d) => readOrder(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.createdAt - a.createdAt);
    return { orders };
  } catch {
    return {
      orders: [],
      error: 'Sign in with the same account you used for the order to see its payment status.',
    };
  }
}

/** Admin billing desk. Only the allowlisted admins can read this collection. */
export async function fetchAllOrders(max = 120): Promise<{ orders: OrderDoc[]; error?: string }> {
  try {
    const snap = await getDocs(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(Math.min(max, 300)))
    );
    return { orders: snap.docs.map((d) => readOrder(d.id, d.data() as Record<string, unknown>)) };
  } catch (err) {
    return {
      orders: [],
      error:
        err instanceof Error && err.message.includes('offline')
          ? 'Firestore is offline — check the database name in firebase-applet-config.json.'
          : 'Read blocked. Publish firestore.rules for the "(default)" database.',
    };
  }
}
