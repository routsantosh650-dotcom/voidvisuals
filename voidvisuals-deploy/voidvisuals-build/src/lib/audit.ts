/**
 * Append-only audit trail stored in Firestore /auditLog.
 *
 * Time comes from serverTimestamp() so the log cannot be skewed by the writer's device clock;
 * clientTime is kept only to break ties while a write is still in flight.
 */

import { auth, db } from '../firebase';
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';

export type AuditCategory = 'ADMIN' | 'CUSTOMER' | 'AUTH';

export interface AuditEntry {
  id: string;
  createdAt: number;
  clientTime: string;
  actor: string;
  actorUid: string;
  category: AuditCategory;
  action: string;
  target: string;
  summary: string;
  changes: string[];
  page: string;
  agent: string;
  ip: string;
}

export interface AuditInput {
  category: AuditCategory;
  action: string;
  target: string;
  summary: string;
  changes?: string[];
  actorOverride?: string;
}

export interface AuditResult {
  ok: boolean;
  error?: string;
}

const MAX_TEXT = 300;
const MAX_CHANGES = 25;

const clip = (value: string, max = MAX_TEXT) => value.replace(/\s+/g, ' ').trim().slice(0, max);

// Firestore rejects writes whose pending server timestamp never resolves on a disconnected
// client, so reads tolerate a missing createdAt by falling back to clientTime.
const toMillis = (raw: unknown, clientTime: string) => {
  const ts = raw as { seconds?: number; toMillis?: () => number } | undefined;
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts && typeof ts.seconds === 'number') return ts.seconds * 1000;
  const parsed = Date.parse(clientTime || '');
  return Number.isNaN(parsed) ? 0 : parsed;
};

let clientInfo: Promise<string> | null = null;

// The Worker echoes Cloudflare's view of the visitor; used only for the "Device / IP" column,
// and a failure here must never block the event being recorded.
function resolveClientIp(): Promise<string> {
  if (!clientInfo) {
    clientInfo = (async () => {
      try {
        const res = await fetch('/api/whoami');
        if (!res.ok) return '';
        const data = (await res.json().catch(() => null)) as { ip?: string; country?: string } | null;
        const ip = (data?.ip || '').trim();
        if (!ip) return '';
        const country = (data?.country || '').trim();
        return clip(country ? `${ip} · ${country}` : ip, 60);
      } catch {
        return '';
      }
    })();
  }
  return clientInfo;
}

function shortAgent(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const edge = /Edg\/([\d.]+)/.exec(ua);
  const chrome = /Chrome\/([\d.]+)/.exec(ua);
  const firefox = /Firefox\/([\d.]+)/.exec(ua);
  const browser = edge
    ? `Edge ${edge[1].split('.')[0]}`
    : chrome
      ? `Chrome ${chrome[1].split('.')[0]}`
      : firefox
        ? `Firefox ${firefox[1].split('.')[0]}`
        : ua.includes('Safari')
          ? 'Safari'
          : 'Unknown browser';
  const os =
    ua.includes('Windows NT 10') ? 'Windows' :
    ua.includes('Android') ? 'Android' :
    ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' :
    ua.includes('Mac OS X') ? 'macOS' : ua.includes('Linux') ? 'Linux' : 'Unknown OS';
  return clip(`${browser} · ${os}`, 80);
}

export async function recordAudit(input: AuditInput): Promise<AuditResult> {
  const user = auth.currentUser;
  const ip = await resolveClientIp();
  try {
    await addDoc(collection(db, 'auditLog'), {
      createdAt: serverTimestamp(),
      clientTime: new Date().toISOString(),
      actor: clip(input.actorOverride || user?.email || 'anonymous', 200),
      actorUid: clip(user?.uid || 'anonymous', 128),
      category: input.category,
      action: clip(input.action, 40),
      target: clip(input.target, 200),
      summary: clip(input.summary, 300),
      changes: (input.changes || []).slice(0, MAX_CHANGES).map((c) => clip(c, 240)),
      page: clip(typeof location === 'undefined' ? '' : location.pathname + location.hash, 200),
      agent: shortAgent(),
      ip,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeAuditError(err) };
  }
}

export function describeAuditError(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === 'permission-denied' || err.code.includes('failed-precondition')) {
      return 'Firestore blocked this write. Publish firestore.rules for the "(default)" database of project voidvisualsdb in the Firebase console.';
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Unknown audit error';
}

export interface AuditQuery {
  max?: number;
  category?: AuditCategory | 'ALL';
  search?: string;
}

export async function fetchAuditLog(
  opts: AuditQuery = {}
): Promise<{ entries: AuditEntry[]; error?: string }> {
  const max = Math.min(Math.max(opts.max || 200, 1), 500);
  try {
    const snap = await getDocs(
      query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(max))
    );
    const needle = (opts.search || '').trim().toLowerCase();
    const entries = snap.docs
      .map((d) => {
        const x = d.data() as Record<string, unknown>;
        const clientTime = typeof x.clientTime === 'string' ? x.clientTime : '';
        return {
          id: d.id,
          createdAt: toMillis(x.createdAt, clientTime),
          clientTime,
          actor: typeof x.actor === 'string' ? x.actor : 'unknown',
          actorUid: typeof x.actorUid === 'string' ? x.actorUid : '',
          category: (['ADMIN', 'CUSTOMER', 'AUTH'].includes(x.category as string)
            ? x.category
            : 'ADMIN') as AuditCategory,
          action: typeof x.action === 'string' ? x.action : '',
          target: typeof x.target === 'string' ? x.target : '',
          summary: typeof x.summary === 'string' ? x.summary : '',
          changes: Array.isArray(x.changes) ? (x.changes as unknown[]).map((c) => String(c)) : [],
          page: typeof x.page === 'string' ? x.page : '',
          agent: typeof x.agent === 'string' ? x.agent : '',
          ip: typeof x.ip === 'string' ? x.ip : '',
        } satisfies AuditEntry;
      })
      .filter((e) => (opts.category && opts.category !== 'ALL' ? e.category === opts.category : true))
      .filter((e) =>
        needle
          ? [e.actor, e.action, e.target, e.summary, e.ip, ...e.changes].join(' ').toLowerCase().includes(needle)
          : true
      );
    return { entries };
  } catch (err) {
    return { entries: [], error: describeAuditError(err) };
  }
}

/** "heroTitle: A → B" style diff lines for the audit entry. */
export function diffFields(before: object, after: object): string[] {
  const prev = (before || {}) as Record<string, unknown>;
  const next = (after || {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const out: string[] = [];
  keys.forEach((key) => {
    const b = prev[key];
    const a = next[key];
    if (JSON.stringify(b) === JSON.stringify(a)) return;
    const render = (v: unknown) =>
      typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '—');
    if (Array.isArray(b) && Array.isArray(a)) {
      const added = a.filter((i) => !b.includes(i));
      const removed = b.filter((i) => !a.includes(i));
      const parts: string[] = [];
      if (added.length) parts.push(`+${added.length}`);
      if (removed.length) parts.push(`-${removed.length}`);
      out.push(`${key}: ${render(b)} → ${render(a)} (${parts.join('/') || 'reordered'})`);
      return;
    }
    out.push(`${key}: ${render(b)} → ${render(a)}`);
  });
  return out;
}

const TIME_FMT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'Asia/Kolkata',
});

export const formatAuditTime = (millis: number) =>
  millis ? `${TIME_FMT.format(new Date(millis))} IST` : 'pending…';

export function relativeAuditTime(millis: number, now = Date.now()): string {
  if (!millis) return 'just now';
  const secs = Math.max(0, Math.round((now - millis) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function auditCsv(entries: AuditEntry[]): string {
  const head = ['Time (IST)', 'Category', 'Action', 'Actor', 'Target', 'Summary', 'Changes', 'IP', 'Device', 'Page'];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = entries.map((e) =>
    [
      e.createdAt ? TIME_FMT.format(new Date(e.createdAt)) : e.clientTime,
      e.category,
      e.action,
      e.actor,
      e.target,
      e.summary,
      e.changes.join(' | '),
      e.ip,
      e.agent,
      e.page,
    ]
      .map(esc)
      .join(',')
  );
  return [head.map(esc).join(','), ...rows].join('\n');
}

export function downloadAuditCsv(entries: AuditEntry[]) {
  const blob = new Blob([auditCsv(entries)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `voidvisuals-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
