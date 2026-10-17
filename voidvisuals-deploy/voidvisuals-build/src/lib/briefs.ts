/**
 * Project briefs — the studio's enquiry pipeline.
 *
 * Submissions always go through the Worker (/api/briefs), which rate-limits per IP, checks the
 * honeypot, and writes Firestore with the visitor's own Firebase ID token when they happen to be
 * signed in. firestore.rules then re-validates every field, so the Worker is convenience and
 * abuse-control, not the only line of defence.
 */

import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const BRIEF_SERVICES = [
  'New website',
  'Website upgrade / redesign',
  'Landing page',
  'Online store',
  'Portfolio / personal site',
  'SEO & speed tune-up',
  'Something else',
] as const;

export const BRIEF_BUDGETS = [
  'Under ₹2,500',
  '₹2,500 – ₹5,000',
  '₹5,000 – ₹8,000',
  '₹8,000 – ₹15,000',
  'Above ₹15,000',
  'Not sure yet',
] as const;

export type BriefStatus = 'new' | 'reviewing' | 'quoted' | 'in-progress' | 'delivered' | 'archived';

export const BRIEF_STATUSES: BriefStatus[] = [
  'new',
  'reviewing',
  'quoted',
  'in-progress',
  'delivered',
  'archived',
];

export const STATUS_LABEL: Record<BriefStatus, string> = {
  new: 'Received',
  reviewing: 'Under review',
  quoted: 'Quote sent',
  'in-progress': 'Building',
  delivered: 'Delivered',
  archived: 'Closed',
};

export interface BriefEvent {
  at: number;
  label: string;
  by: string;
}

export interface BriefDoc {
  id: string;
  name: string;
  email: string;
  phone: string;
  service: string;
  budget: string;
  details: string;
  link: string;
  coupon: string;
  ownerEmail: string;
  status: BriefStatus;
  note: string;
  timeline: BriefEvent[];
  createdAt: number;
}

export interface BriefDraft {
  name: string;
  email: string;
  phone: string;
  service: string;
  budget: string;
  details: string;
  link: string;
  coupon: string;
  /** Bot trap: real people never fill this in. */
  company: string;
}

export interface BriefResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/** Client-side mirror of the Worker/rules validation, so users get feedback instantly. */
export function validateBrief(draft: BriefDraft): string | null {
  if (draft.company.trim()) return null; // silently drop bots
  if (draft.name.trim().length < 2) return 'Please tell us your name.';
  if (draft.name.trim().length > 60) return 'Name is too long (60 characters max).';
  if (!EMAIL_RE.test(draft.email.trim())) return 'Please enter a working email address.';
  if (draft.phone.trim().length > 24) return 'Phone number is too long.';
  if (!draft.service) return 'Pick the kind of project you need.';
  if (draft.details.trim().length < 12) return 'A sentence or two about the project helps a lot.';
  if (draft.details.trim().length > 1200) return 'Keep the details under 1200 characters.';
  return null;
}

export async function submitBrief(draft: BriefDraft): Promise<BriefResult> {
  const problem = validateBrief(draft);
  if (problem) return { ok: false, error: problem };

  const idToken = await auth.currentUser?.getIdToken().catch(() => '');
  try {
    const res = await fetch('/api/briefs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        name: draft.name,
        email: draft.email,
        phone: draft.phone,
        service: draft.service,
        budget: draft.budget,
        details: draft.details,
        link: draft.link,
        coupon: draft.coupon,
        company: draft.company,
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; error?: string; id?: string; retryAfter?: number }
      | null;

    if (res.ok && data?.ok && data.id) return { ok: true, id: data.id };
    if (res.status === 429) {
      const mins = Math.max(1, Math.round((data?.retryAfter || 900) / 60));
      return { ok: false, error: `Too many briefs from this device. Try again in ${mins} minutes.` };
    }
    if (data?.error === 'spam-trap') return { ok: true }; // pretend success to bots
    return { ok: false, error: data?.error || 'Could not send the brief. Please WhatsApp or email us.' };
  } catch {
    return { ok: false, error: 'Network problem — the brief was not sent. Please try again.' };
  }
}

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function readBrief(id: string, x: Record<string, unknown>): BriefDoc {
  const rawStatus = typeof x.status === 'string' ? x.status : 'new';
  const ts = x.createdAt as { seconds?: number } | undefined;
  return {
    id,
    name: typeof x.name === 'string' ? x.name : '',
    email: typeof x.email === 'string' ? x.email : '',
    phone: typeof x.phone === 'string' ? x.phone : '',
    service: typeof x.service === 'string' ? x.service : '',
    budget: typeof x.budget === 'string' ? x.budget : '',
    details: typeof x.details === 'string' ? x.details : '',
    link: typeof x.link === 'string' ? x.link : '',
    coupon: typeof x.coupon === 'string' ? x.coupon : '',
    ownerEmail: typeof x.ownerEmail === 'string' ? x.ownerEmail : '',
    status: (BRIEF_STATUSES.includes(rawStatus as BriefStatus) ? rawStatus : 'new') as BriefStatus,
    note: typeof x.note === 'string' ? x.note : '',
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

/** Every brief the signed-in customer owns, newest first. */
export async function fetchMyBriefs(email: string): Promise<{ briefs: BriefDoc[]; error?: string }> {
  if (!email) return { briefs: [] };
  try {
    // No orderBy here on purpose: where + orderBy on another field needs a composite index, and an
    // index that does not exist yet would silently empty the portal. Sorting happens below instead.
    const snap = await getDocs(
      query(collection(db, 'briefs'), where('ownerEmail', '==', email.toLowerCase()), limit(30))
    );
    const briefs = snap.docs
      .map((d) => readBrief(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.createdAt - a.createdAt);
    return { briefs };
  } catch (err) {
    return {
      briefs: [],
      error:
        err instanceof Error
          ? 'Sign in with the same account you used for the brief to see its status.'
          : 'Unknown error',
    };
  }
}

/** Admin inbox. Only the allowlisted admins can read this collection. */
export async function fetchAllBriefs(max = 120): Promise<{ briefs: BriefDoc[]; error?: string }> {
  try {
    const snap = await getDocs(
      query(collection(db, 'briefs'), orderBy('createdAt', 'desc'), limit(Math.min(max, 300)))
    );
    return { briefs: snap.docs.map((d) => readBrief(d.id, d.data() as Record<string, unknown>)) };
  } catch (err) {
    return {
      briefs: [],
      error:
        err instanceof Error && err.message.includes('offline')
          ? 'Firestore is offline — check the database name in firebase-applet-config.json.'
          : 'Read blocked. Publish firestore.rules for the voidvisualsdb database.',
    };
  }
}
