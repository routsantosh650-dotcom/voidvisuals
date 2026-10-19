import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  arrayUnion,
  collection,
  deleteDoc,
  getDoc,
  doc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  BadgePercent,
  Download,
  Image as ImageIcon,
  Inbox,
  LayoutGrid,
  Loader2,
  LogOut,
  MessageSquare,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { consoleProfileForEmail } from '../lib/adminGate';
import { BRIEF_STATUSES, STATUS_LABEL, fetchAllBriefs, type BriefDoc, type BriefStatus } from '../lib/briefs';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  fetchAllOrders,
  type OrderDoc,
  type OrderStatus,
} from '../lib/orders';
import { DEFAULT_PLANS, DEFAULT_SITE_CONFIG, DEFAULT_WORK, siteConfigFields, inr, type SiteConfigData } from '../data/vvData';
import { diffFields, downloadAuditCsv, fetchAuditLog, formatAuditTime, recordAudit, type AuditCategory, type AuditEntry } from '../lib/audit';
import { showToast } from '../lib/toast';
import { navigate } from '../router';
import { LiveClock } from './LiveClock';
import './Billing.css';

interface Props {
  email: string;
  ready: boolean;
  onOpenAuth: () => void;
}

type Tab = 'briefs' | 'orders' | 'work' | 'testimonials' | 'plans' | 'config' | 'audit';

const TABS: Array<{ id: Tab; label: string; hint: string; icon: React.ReactNode }> = [
  { id: 'briefs', label: 'Brief inbox', hint: 'Every enquiry the studio has received', icon: <Inbox size={16} /> },
  { id: 'orders', label: 'Billing desk', hint: 'Invoices, UPI payments and delivery state', icon: <Receipt size={16} /> },
  { id: 'work', label: 'Work', hint: 'The projects shown on the work board', icon: <ImageIcon size={16} /> },
  { id: 'testimonials', label: 'Reviews', hint: 'Client quotes, only approved ones go public', icon: <Star size={16} /> },
  { id: 'plans', label: 'Plans & pricing', hint: 'Website tiers, add-ons and the care plan', icon: <Wallet size={16} /> },
  { id: 'config', label: 'Site content', hint: 'Headlines, contacts, discount board and coupons', icon: <Settings size={16} /> },
  { id: 'audit', label: 'Audit log', hint: 'Who changed what, and exactly when', icon: <ScrollText size={16} /> },
];

const SESSION_KEY = 'vv-console-2fa';
const SESSION_MS = 30 * 60 * 1000;

const IST_SHORT = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

/* ------------------------------------------------------------------ */
/* tiny form primitives                                                */
/* ------------------------------------------------------------------ */

const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  area?: boolean;
  wide?: boolean;
  placeholder?: string;
}> = ({ label, value, onChange, max = 200, area, wide, placeholder }) => (
  <div className="field" style={wide ? { gridColumn: '1 / -1' } : undefined}>
    <label>{label}</label>
    {area ? (
      <textarea className="textarea" value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    ) : (
      <input className="input" value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    )}
  </div>
);

const NumberField: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}> = ({ label, value, onChange, min = 0, max = 999999 }) => (
  <div className="field">
    <label>{label}</label>
    <input
      className="input"
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min);
      }}
    />
  </div>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="field">
    <label>{label}</label>
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

const SwitchField: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div className="field">
    <label className="sw">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  </div>
);

const linesToList = (raw: string) =>
  raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 24);

/* ------------------------------------------------------------------ */
/* 2FA gate                                                            */
/* ------------------------------------------------------------------ */

const VerifyGate: React.FC<{
  email: string;
  profile: { name: string; role: string };
  onPass: () => void;
  onExit: () => void;
}> = ({ email, profile, onPass, onExit }) => {
  const [stage, setStage] = useState<'idle' | 'sent'>('idle');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const idToken = await (await auth.currentUser?.getIdTokenResult(true))?.token || '';
      if (!idToken) {
        setError('No active studio sign-in. Sign in with an allowlisted account first.');
        return;
      }
      const res = await fetch('/api/admin/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        setStage('sent');
        showToast('6-digit code sent to your studio inbox.', 'good');
        void recordAudit({
          category: 'AUTH',
          action: 'otp requested',
          target: 'studio-console',
          actorOverride: email,
          summary: `Login code sent to ${email}`,
        });
      } else {
        setError(
          data?.error === 'not-admin'
            ? 'This account is not on the studio allowlist.'
            : data?.error === 'no-session'
              ? 'Your sign-in did not reach Firebase, so there is no session to verify. Sign in again — if this keeps happening the studio must re-copy its Firebase API key.'
              : `Could not send the code (${data?.error || res.status}).`
        );
      }
    } catch {
      setError('Network problem — the code request did not reach the Worker.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const idToken = (await auth.currentUser?.getIdTokenResult(true))?.token || '';
      const res = await fetch('/api/admin/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, code: code.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email, at: Date.now() }));
        void recordAudit({
          category: 'AUTH',
          action: 'otp verified',
          target: 'studio-console',
          actorOverride: email,
          summary: `Second factor passed for ${email}`,
        });
        onPass();
        return;
      }
      setError(
        data?.error === 'locked'
          ? 'Too many wrong attempts — request a new code.'
          : data?.error === 'no-session'
            ? 'Your sign-in session expired — request a new code.'
            : 'That code is not right. Request a new one if it expired.'
      );
      void recordAudit({
        category: 'AUTH',
        action: 'otp failed',
        target: 'studio-console',
        actorOverride: email,
        summary: `Wrong or expired code for ${email}`,
      });
    } catch {
      setError('Network problem — verification did not reach the Worker.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="boot">
      <div className="glass-card" style={{ width: 'min(430px, 92vw)' }}>
        <div className="modal-head">
          <h3>Studio console</h3>
          <span className="chip">
            <ShieldCheck size={13} style={{ color: 'var(--mint)' }} />
            2FA
          </span>
        </div>
        <p className="muted" style={{ marginTop: -6, fontSize: 14 }}>
          Signed in as <b>{profile.name}</b> · {email}
          <br />
          {profile.role}
        </p>

        {stage === 'idle' ? (
          <>
            <p className="lead" style={{ fontSize: 15.5 }}>
              A 6-digit code is emailed to this address every time. Codes expire in 5 minutes and the
              console closes after 3 wrong attempts.
            </p>
            <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={() => void send()} disabled={busy}>
              {busy ? <Loader2 size={16} className="spin-slow" /> : <ShieldCheck size={16} />}
              Send my login code
            </button>
          </>
        ) : (
          <form onSubmit={verify} noValidate>
            <div className="field" style={{ marginTop: 14 }}>
              <label>6-digit code</label>
              <input
                className="input mono"
                value={code}
                inputMode="numeric"
                maxLength={6}
                autoFocus
                placeholder="••••••"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? <Loader2 size={16} className="spin-slow" /> : <MessageSquare size={16} />}
              Unlock console
            </button>
            <button type="button" className="linkish" style={{ marginTop: 12 }} onClick={() => { setStage('idle'); setCode(''); setError(''); }}>
              Send a new code
            </button>
          </form>
        )}

        {error ? <p className="err" role="alert">{error}</p> : null}

        <div className="row" style={{ marginTop: 18, justifyContent: 'space-between' }}>
          <button type="button" className="linkish" onClick={onExit}>
            Back to the website
          </button>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              void signOut(auth).catch(() => undefined);
              onExit();
            }}
          >
            Use a different account
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Briefs tab                                                          */
/* ------------------------------------------------------------------ */

const BriefsTab: React.FC<{ email: string }> = ({ email }) => {
  const [briefs, setBriefs] = useState<BriefDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needle, setNeedle] = useState('');
  const [status, setStatus] = useState<'ALL' | BriefStatus>('ALL');
  const [openId, setOpenId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchAllBriefs(200);
    setBriefs(res.briefs);
    setError(res.error || '');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const n = needle.trim().toLowerCase();
    return briefs.filter(
      (b) =>
        (status === 'ALL' || b.status === status) &&
        (!n || `${b.name} ${b.email} ${b.service} ${b.details} ${b.budget} ${b.coupon}`.toLowerCase().includes(n))
    );
  }, [briefs, needle, status]);

  const apply = async (b: BriefDoc, next: BriefStatus, noteText: string) => {
    setSaving(b.id);
    try {
      const at = Date.now();
      const label =
        noteText.trim() && noteText.trim() !== b.note
          ? `${STATUS_LABEL[next]} — ${noteText.trim().slice(0, 120)}`
          : `Status → ${STATUS_LABEL[next]}`;
      await updateDoc(doc(db, 'briefs', b.id), {
        status: next,
        note: noteText,
        timeline: arrayUnion({ at, label, by: email }),
      });
      void recordAudit({
        category: 'ADMIN',
        action: 'brief updated',
        target: b.id,
        summary: `${b.name} (${b.email}) — ${STATUS_LABEL[b.status]} → ${STATUS_LABEL[next]}`,
        changes: diffFields({ status: b.status, note: b.note }, { status: next, note: noteText }),
      });
      setBriefs((prev) => prev.map((x) => (x.id === b.id ? { ...x, status: next, note: noteText } : x)));
      showToast('Brief updated and the customer can see it in their portal.', 'good');
    } catch (err) {
      showToast(
        err instanceof Error && err.message.includes('permission')
          ? 'Firestore blocked the write — publish firestore.rules for the "(default)" database.'
          : 'Could not save the brief update.',
        'bad'
      );
    } finally {
      setSaving('');
    }
  };

  const remove = async (b: BriefDoc) => {
    if (!window.confirm(`Delete the brief from ${b.name}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'briefs', b.id));
      void recordAudit({
        category: 'ADMIN',
        action: 'brief deleted',
        target: b.id,
        summary: `Deleted brief from ${b.name} (${b.email})`,
      });
      setBriefs((prev) => prev.filter((x) => x.id !== b.id));
      showToast('Brief deleted.', 'info');
    } catch {
      showToast('Delete blocked by Firestore rules.', 'bad');
    }
  };

  const counts = {
    all: briefs.length,
    new: briefs.filter((b) => b.status === 'new').length,
    live: briefs.filter((b) => b.status === 'in-progress' || b.status === 'quoted' || b.status === 'reviewing').length,
    done: briefs.filter((b) => b.status === 'delivered').length,
  };

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <b>{counts.all}</b>
          <span>total briefs</span>
        </div>
        <div className="kpi">
          <b>{counts.new}</b>
          <span>waiting for a reply</span>
        </div>
        <div className="kpi">
          <b>{counts.live}</b>
          <span>in the pipeline</span>
        </div>
        <div className="kpi">
          <b>{counts.done}</b>
          <span>delivered</span>
        </div>
      </div>

      <div className="pane">
        <div className="spread">
          <div className="field" style={{ minWidth: 260, marginBottom: 0 }}>
            <label>Search</label>
            <span style={{ position: 'relative', display: 'block' }}>
              <Search size={14} style={{ position: 'absolute', left: 14, top: 17, color: '#B8A28F' }} />
              <input
                className="input"
                style={{ paddingLeft: 40 }}
                value={needle}
                placeholder="name, email, service, detail…"
                onChange={(e) => setNeedle(e.target.value)}
              />
            </span>
          </div>
          <div className="row">
            <SelectField
              label=""
              value={status}
              onChange={(v) => setStatus(v as 'ALL' | BriefStatus)}
              options={[
                { value: 'ALL', label: 'All statuses' },
                ...BRIEF_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
              ]}
            />
            <button type="button" className="mini" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="spin-slow" /> : <RefreshCw size={13} />}
              Reload
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="err">{error}</p> : null}

      {!shown.length ? (
        <div className="empty">{loading ? 'Loading the inbox…' : 'No briefs match this filter yet.'}</div>
      ) : (
        <div className="pane" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Client</th>
                <th>Project</th>
                <th>Status</th>
                <th>Received</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => {
                const isOpen = openId === b.id;
                return (
                  <React.Fragment key={b.id}>
                    <tr>
                      <td>
                        <b style={{ display: 'block' }}>{b.name}</b>
                        <span className="tagline">{b.email}</span>
                        {b.phone ? <span className="tagline"> · {b.phone}</span> : null}
                      </td>
                      <td>
                        {b.service}
                        <span className="tagline" style={{ display: 'block' }}>
                          {b.budget || 'budget not given'}
                          {b.coupon ? ` · coupon ${b.coupon}` : ''}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill st-${b.status}`}>{STATUS_LABEL[b.status]}</span>
                      </td>
                      <td className="tagline">{b.createdAt ? IST_SHORT.format(new Date(b.createdAt)) : '—'}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="mini"
                            onClick={() => {
                              setOpenId(isOpen ? '' : b.id);
                              setNote(b.note);
                            }}
                          >
                            {isOpen ? 'Hide' : 'Open'}
                          </button>
                          <button type="button" className="mini danger" onClick={() => void remove(b)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={5} style={{ background: '#ffffff08' }}>
                          <div style={{ padding: '6px 4px 14px' }}>
                            <p style={{ margin: '0 0 14px', whiteSpace: 'pre-wrap', color: '#ffffffd0' }}>{b.details}</p>
                            {b.link ? <p className="tagline">existing site: {b.link}</p> : null}

                            <div className="grid-form" style={{ marginTop: 10 }}>
                              <SelectField
                                label="Move to status"
                                value={b.status}
                                onChange={() => undefined}
                                options={BRIEF_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                              />
                              <TextField label="Reply note the client sees" value={note} onChange={setNote} max={400} wide />
                            </div>

                            <div className="row" style={{ marginTop: 6 }}>
                              {BRIEF_STATUSES.filter((s) => s !== b.status).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  className="mini go"
                                  disabled={saving === b.id}
                                  onClick={() => void apply(b, s, note)}
                                >
                                  {STATUS_LABEL[s]}
                                </button>
                              ))}
                              <span className="tagline">saving writes an audit entry · {b.timeline.length} events logged</span>
                            </div>

                            {b.timeline.length ? (
                              <div className="timeline">
                                {b.timeline
                                  .slice()
                                  .reverse()
                                  .map((ev, i) => (
                                    <div className="tl" key={`${ev.at}-${i}`}>
                                      <span>{ev.at ? IST_SHORT.format(new Date(ev.at)) : '—'}</span>
                                      <div>
                                        {ev.label}
                                        {ev.by ? <span className="muted"> · {ev.by}</span> : null}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Orders tab — the billing desk                                       */
/* ------------------------------------------------------------------ */

/** UPI gives us no callback, so the studio confirms the money by hand and records the reference. */
const OrdersTab: React.FC<{ email: string }> = ({ email }) => {
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needle, setNeedle] = useState('');
  const [status, setStatus] = useState<'ALL' | OrderStatus>('ALL');
  const [openId, setOpenId] = useState('');
  const [txn, setTxn] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchAllOrders(200);
    setOrders(res.orders);
    setError(res.error || '');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const n = needle.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (status === 'ALL' || o.status === status) &&
        (!n ||
          `${o.ref} ${o.name} ${o.email} ${o.company} ${o.phone} ${o.txnRef} ${o.items
            .map((i) => i.name)
            .join(' ')}`
            .toLowerCase()
            .includes(n))
    );
  }, [orders, needle, status]);

  const sum = (list: OrderDoc[]) => list.reduce((total, o) => total + o.totalInr, 0);
  const received = orders.filter((o) => o.status === 'paid' || o.status === 'building' || o.status === 'delivered');
  const waiting = orders.filter((o) => o.status === 'awaiting-payment');

  const waHref = (o: OrderDoc) => {
    const digits = o.phone.replace(/\D/g, '');
    const intl = digits.length === 10 ? `91${digits}` : digits.slice(-12);
    const body = encodeURIComponent(
      `Hi ${o.name}, this is VoidVisuals about invoice ${o.ref} (${inr(o.totalInr)}). `
    );
    return intl.length >= 11 ? `https://wa.me/${intl}?text=${body}` : '';
  };

  const apply = async (o: OrderDoc, next: OrderStatus) => {
    const txnText = next === 'awaiting-payment' ? '' : txn.trim().slice(0, 40);
    if (next === 'paid' && !txnText) {
      showToast('Record the UPI reference first — that is the only proof the money arrived.', 'bad');
      return;
    }
    const noteText = note.trim().slice(0, 600);
    setSaving(o.id);
    try {
      const at = Date.now();
      const label =
        noteText && noteText !== o.note
          ? `${ORDER_STATUS_LABEL[next]} — ${noteText.slice(0, 120)}`
          : `Status → ${ORDER_STATUS_LABEL[next]}`;
      // The rules cap an invoice at 30 logged events, so a full timeline stops growing instead of
      // rejecting the whole write.
      const patch: Record<string, unknown> = { status: next, txnRef: txnText, note: noteText };
      if (o.timeline.length < 30) patch.timeline = arrayUnion({ at, label, by: email });
      await updateDoc(doc(db, 'orders', o.id), patch);
      void recordAudit({
        category: 'ADMIN',
        action: 'order updated',
        target: o.id,
        summary: `${o.ref} — ${ORDER_STATUS_LABEL[o.status]} → ${ORDER_STATUS_LABEL[next]} (${inr(o.totalInr)})`,
        changes: diffFields(
          { status: o.status, txnRef: o.txnRef, note: o.note },
          { status: next, txnRef: txnText, note: noteText }
        ),
      });
      setOrders((prev) =>
        prev.map((x) =>
          x.id === o.id
            ? {
                ...x,
                status: next,
                txnRef: txnText,
                note: noteText,
                timeline: x.timeline.length < 30 ? [...x.timeline, { at, label, by: email }] : x.timeline,
              }
            : x
        )
      );
      showToast(`${o.ref} is now “${ORDER_STATUS_LABEL[next]}” — the client sees it instantly.`, 'good');
    } catch (err) {
      showToast(
        err instanceof Error && err.message.includes('permission')
          ? 'Firestore blocked the write — publish firestore.rules for the "(default)" database.'
          : 'Could not update this invoice.',
        'bad'
      );
    } finally {
      setSaving('');
    }
  };

  const remove = async (o: OrderDoc) => {
    if (!window.confirm(`Delete invoice ${o.ref} for ${o.name}? The client loses it permanently.`)) return;
    try {
      await deleteDoc(doc(db, 'orders', o.id));
      void recordAudit({
        category: 'ADMIN',
        action: 'order deleted',
        target: o.id,
        summary: `Deleted ${o.ref} — ${o.name} (${o.email}), ${inr(o.totalInr)}`,
      });
      setOrders((prev) => prev.filter((x) => x.id !== o.id));
      showToast('Invoice deleted.', 'info');
    } catch {
      showToast('Delete blocked by Firestore rules.', 'bad');
    }
  };

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <b>{orders.length}</b>
          <span>invoices raised</span>
        </div>
        <div className="kpi">
          <b>{inr(sum(waiting))}</b>
          <span>awaiting UPI ({waiting.length})</span>
        </div>
        <div className="kpi">
          <b>{inr(sum(received))}</b>
          <span>money confirmed ({received.length})</span>
        </div>
        <div className="kpi">
          <b>{inr(sum(orders.filter((o) => o.status === 'delivered')))}</b>
          <span>delivered</span>
        </div>
      </div>

      <div className="pane">
        <div className="spread">
          <div className="field" style={{ minWidth: 260, marginBottom: 0 }}>
            <label>Search</label>
            <span style={{ position: 'relative', display: 'block' }}>
              <Search size={14} style={{ position: 'absolute', left: 14, top: 17, color: '#B8A28F' }} />
              <input
                className="input"
                style={{ paddingLeft: 40 }}
                value={needle}
                placeholder="invoice ref, client, plan, UPI reference…"
                onChange={(e) => setNeedle(e.target.value)}
              />
            </span>
          </div>
          <div className="row">
            <SelectField
              label=""
              value={status}
              onChange={(v) => setStatus(v as 'ALL' | OrderStatus)}
              options={[
                { value: 'ALL', label: 'All invoices' },
                ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] })),
              ]}
            />
            <button type="button" className="mini" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="spin-slow" /> : <RefreshCw size={13} />}
              Reload
            </button>
          </div>
        </div>
      </div>

      <p className="fine" style={{ margin: '0 0 14px' }}>
        Prices on an invoice are frozen the moment it is created and the customer cannot touch them. Marking a
        payment <b>received</b> is your call alone — check the amount in your UPI history, then paste the
        transaction reference here.
      </p>

      {error ? <p className="err">{error}</p> : null}

      {!shown.length ? (
        <div className="empty">{loading ? 'Reading the billing desk…' : 'No invoice matches this filter yet.'}</div>
      ) : (
        <div className="pane" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Client</th>
                <th>Invoice</th>
                <th>Total</th>
                <th>Status</th>
                <th>Placed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => {
                const isOpen = openId === o.id;
                const chat = waHref(o);
                return (
                  <React.Fragment key={o.id}>
                    <tr>
                      <td>
                        <b style={{ display: 'block' }}>{o.name}</b>
                        <span className="tagline">{o.email}</span>
                        {o.company ? <span className="tagline"> · {o.company}</span> : null}
                      </td>
                      <td className="mono">
                        {o.ref}
                        <span className="tagline" style={{ display: 'block' }}>
                          {o.items.length} line{o.items.length === 1 ? '' : 's'}
                          {o.coupon ? ` · ${o.coupon}` : ''}
                        </span>
                      </td>
                      <td>
                        <b>{inr(o.totalInr)}</b>
                        {o.discountInr > 0 ? (
                          <span className="tagline" style={{ display: 'block' }}>
                            {inr(o.subtotalInr)} − {inr(o.discountInr)}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span className={`status-pill st-${o.status}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                        {o.txnRef ? (
                          <span className="tagline" style={{ display: 'block' }}>
                            {o.txnRef}
                          </span>
                        ) : null}
                      </td>
                      <td className="tagline">{o.createdAt ? IST_SHORT.format(new Date(o.createdAt)) : '—'}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="mini"
                            onClick={() => {
                              setOpenId(isOpen ? '' : o.id);
                              setTxn(o.txnRef);
                              setNote(o.note);
                            }}
                          >
                            {isOpen ? 'Hide' : 'Open'}
                          </button>
                          <button type="button" className="mini danger" onClick={() => void remove(o)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={6} style={{ background: '#ffffff08' }}>
                          <div style={{ padding: '6px 4px 14px' }}>
                            <ul className="bill-lines">
                              {o.items.map((it) => (
                                <li key={`${it.planId}·${it.qty}`} style={{ gridTemplateColumns: '1fr auto' }}>
                                  <div>
                                    <b>{it.name}</b>
                                    <span>
                                      {it.periodLabel ? `${it.periodLabel} · ` : ''}
                                      {it.qty} × {inr(it.priceInr)} · plan {it.planId}
                                    </span>
                                  </div>
                                  <span className="amt">{inr(it.lineTotalInr)}</span>
                                </li>
                              ))}
                            </ul>

                            <div className="bill-sum" style={{ maxWidth: 360 }}>
                              <div>
                                <span>Subtotal</span>
                                <b>{inr(o.subtotalInr)}</b>
                              </div>
                              {o.discountInr > 0 ? (
                                <div className="off">
                                  <span>Coupon {o.coupon}</span>
                                  <b>−{inr(o.discountInr)}</b>
                                </div>
                              ) : null}
                              <div className="total">
                                <span>Client paid</span>
                                <b>{inr(o.totalInr)}</b>
                              </div>
                            </div>

                            <p className="tagline" style={{ marginTop: 14 }}>
                              phone {o.phone || '—'} · owner {o.ownerEmail || '—'} · doc {o.id}
                            </p>

                            <div className="grid-form" style={{ marginTop: 10 }}>
                              <TextField
                                label="UPI reference from your payment history"
                                value={txn}
                                onChange={(v) => setTxn(v.slice(0, 40))}
                                max={40}
                                placeholder="e.g. 4192 8837 1122"
                              />
                              <TextField label="Note the client sees" value={note} onChange={setNote} max={600} area wide />
                            </div>

                            <div className="row" style={{ marginTop: 6 }}>
                              {ORDER_STATUSES.filter((s) => s !== o.status).map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  className="mini go"
                                  disabled={saving === o.id}
                                  onClick={() => void apply(o, s)}
                                >
                                  {ORDER_STATUS_LABEL[s]}
                                </button>
                              ))}
                              {chat ? (
                                <a className="mini" href={chat} target="_blank" rel="noreferrer noopener">
                                  <MessageSquare size={13} />
                                  Message client
                                </a>
                              ) : null}
                              <span className="tagline">saving writes an audit entry · {o.timeline.length} events</span>
                            </div>

                            {o.timeline.length ? (
                              <div className="timeline">
                                {o.timeline
                                  .slice()
                                  .reverse()
                                  .map((ev, i) => (
                                    <div className="tl" key={`${ev.at}-${i}`}>
                                      <span>{ev.at ? IST_SHORT.format(new Date(ev.at)) : '—'}</span>
                                      <div>
                                        {ev.label}
                                        {ev.by ? <span className="muted"> · {ev.by}</span> : null}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Generic collection editor                                           */
/* ------------------------------------------------------------------ */

type Doc = Record<string, unknown> & { id: string };

interface CrudProps<T extends Doc> {
  name: string;
  collectionName: string;
  items: T[];
  loading: boolean;
  error: string;
  blank: () => T;
  columns: Array<{ label: string; render: (item: T) => React.ReactNode }>;
  fields: (item: T, set: (patch: Partial<T>) => void) => React.ReactNode;
  /** Everything the rules require, in Firestore wire shape. */
  toWire: (item: T, email: string) => Record<string, unknown>;
  onReload: () => void;
  auditAction: string;
}

function CrudTab<T extends Doc>({
  name,
  collectionName,
  items,
  loading,
  error,
  blank,
  columns,
  fields,
  toWire,
  onReload,
  auditAction,
}: CrudProps<T>) {
  const [draft, setDraft] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);

  const start = () => setDraft(blank());
  const edit = (item: T) => setDraft({ ...item });
  const set = (patch: Partial<T>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const save = async () => {
    if (!draft) return;
    const email = (auth.currentUser?.email || '').trim();
    if (!email) return;
    setSaving(true);
    try {
      const before = items.find((i) => i.id === draft.id);
      await setDoc(doc(db, collectionName, draft.id), toWire(draft, email));
      void recordAudit({
        category: 'ADMIN',
        action: auditAction,
        target: `${collectionName}/${draft.id}`,
        summary: `${name} “${String(draft.title ?? draft.name ?? draft.author ?? draft.id)}” ${before ? 'updated' : 'created'}`,
        changes: before ? diffFields(before, toWire(draft, email)) : [],
      });
      showToast(`${name} saved — the live site updates instantly.`, 'good');
      setDraft(null);
      onReload();
    } catch (err) {
      showToast(
        err instanceof Error && err.message.toLowerCase().includes('permission')
          ? `Firestore blocked this write. Publish firestore.rules for the "(default)" database first.`
          : `Could not save this ${name.toLowerCase()}.`,
        'bad'
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: T) => {
    if (!window.confirm(`Delete this ${name.toLowerCase()}?`)) return;
    try {
      await deleteDoc(doc(db, collectionName, item.id));
      void recordAudit({
        category: 'ADMIN',
        action: `${auditAction} deleted`,
        target: `${collectionName}/${item.id}`,
        summary: `Deleted ${name.toLowerCase()} “${String(item.title ?? item.name ?? item.author ?? item.id)}”`,
      });
      setDraft(null);
      onReload();
      showToast('Deleted.', 'info');
    } catch {
      showToast('Delete blocked by Firestore rules.', 'bad');
    }
  };

  return (
    <>
      <div className="pane spread">
        <div>
          <h3 style={{ margin: 0 }}>{name}</h3>
          <span className="tagline">{items.length} on the live site · /{collectionName}</span>
        </div>
        <div className="row">
          <button type="button" className="mini" onClick={onReload} disabled={loading}>
            {loading ? <Loader2 size={13} className="spin-slow" /> : <RefreshCw size={13} />}
            Reload
          </button>
          <button type="button" className="mini go" onClick={start}>
            <Plus size={13} />
            Add new
          </button>
        </div>
      </div>

      {error ? <p className="err">{error}</p> : null}

      {draft ? (
        <div className="pane">
          <div className="spread" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>{items.some((i) => i.id === draft.id) ? `Edit — ${draft.id}` : `New ${name.toLowerCase()}`}</h3>
            <span className="tagline">id {draft.id}</span>
          </div>
          <div className="grid-form">{fields(draft, set)}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 size={15} className="spin-slow" /> : <Save size={15} />}
              Save and publish
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>
              Cancel
            </button>
            {items.some((i) => i.id === draft.id) ? (
              <button type="button" className="mini danger" onClick={() => void remove(draft)}>
                <Trash2 size={13} />
                Delete this one
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="pane" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.label}>{c.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                {columns.map((c) => (
                  <td key={c.label}>{c.render(item)}</td>
                ))}
                <td>
                  <div className="row-actions">
                    <button type="button" className="mini" onClick={() => edit(item)}>
                      Edit
                    </button>
                    <button type="button" className="mini danger" onClick={() => void remove(item)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && !loading ? <div className="empty">Nothing here yet — add the first one.</div> : null}
      </div>
    </>
  );
}

/** Loads one collection for the editors above. */
function useCollection(
  collectionName: string,
  map: (id: string, data: Record<string, unknown>, index: number) => Doc
) {
  const [items, setItems] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const snap = await getDocs(query(collection(db, collectionName), orderBy('sortOrder', 'asc'), fsLimit(200)));
        if (!alive) return;
        setItems(snap.docs.map((d, i) => map(d.id, d.data() as Record<string, unknown>, i)));
        setError('');
      } catch (err) {
        if (!alive) return;
        setError(
          err instanceof Error && err.message.includes('offline')
            ? 'Firestore is offline — check that the "(default)" database exists in project voidvisualsdb.'
            : 'Read blocked. Publish firestore.rules for the "(default)" database.'
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [collectionName, map, tick]);

  return { items, loading, error, reload: () => setTick((t) => t + 1) };
}

/* ------------------------------------------------------------------ */
/* Row shapes for the editors                                          */
/* ------------------------------------------------------------------ */

type WorkRow = Doc & {
  title: string;
  client: string;
  category: string;
  summary: string;
  detail: string;
  tags: string[];
  year: number;
  url: string;
  accent: string;
  cover: string;
  featured: boolean;
  status: string;
  sortOrder: number;
};

type PlanRow = Doc & {
  name: string;
  tagline: string;
  category: string;
  priceInr: number;
  oldPriceInr: number;
  periodLabel: string;
  features: string[];
  badge: string;
  popular: boolean;
  active: boolean;
  sortOrder: number;
};

type QuoteRow = Doc & {
  author: string;
  role: string;
  text: string;
  rating: number;
  approved: boolean;
  sortOrder: number;
};

const text = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const digit = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const flag = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);
const listOfText = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 24) : [];
const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Epoch ms -> the value a <input type="datetime-local"> expects, in the studio's own clock. */
const toLocalInput = (ms: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** The reverse trip — a wall-clock string from that input becomes an absolute instant. */
const fromLocalInput = (value: string) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapWorkRow = (id: string, d: Record<string, unknown>): WorkRow => ({
  id,
  title: text(d.title),
  client: text(d.client),
  category: text(d.category, 'business'),
  summary: text(d.summary),
  detail: text(d.detail),
  tags: listOfText(d.tags),
  year: digit(d.year, new Date().getFullYear()),
  url: text(d.url),
  accent: text(d.accent, '#ff7a18'),
  cover: text(d.cover),
  featured: flag(d.featured),
  status: text(d.status, 'sample'),
  sortOrder: digit(d.sortOrder, 1),
});

const mapPlanRow = (id: string, d: Record<string, unknown>): PlanRow => ({
  id,
  name: text(d.name),
  tagline: text(d.tagline),
  category: text(d.category, 'website'),
  priceInr: digit(d.priceInr, 1),
  oldPriceInr: digit(d.oldPriceInr),
  periodLabel: text(d.periodLabel, 'one-time build'),
  features: listOfText(d.features),
  badge: text(d.badge),
  popular: flag(d.popular),
  active: flag(d.active, true),
  sortOrder: digit(d.sortOrder, 1),
});

const mapQuoteRow = (id: string, d: Record<string, unknown>): QuoteRow => ({
  id,
  author: text(d.author),
  role: text(d.role),
  text: text(d.text),
  rating: digit(d.rating, 5),
  approved: flag(d.approved, true),
  sortOrder: digit(d.sortOrder, 1),
});

const WORK_CATEGORIES = [
  { value: 'business', label: 'Business site' },
  { value: 'creator', label: 'Creator / portfolio' },
  { value: 'ecommerce', label: 'Online store' },
  { value: 'upgrade', label: 'Upgrade / redesign' },
  { value: 'landing', label: 'Landing page' },
];

const PLAN_CATEGORIES = [
  { value: 'website', label: 'Website tier' },
  { value: 'addon', label: 'Add-on' },
  { value: 'care', label: 'Care plan' },
];

/* ------------------------------------------------------------------ */
/* Work tab                                                            */
/* ------------------------------------------------------------------ */

const WorkTab: React.FC = () => {
  const { items, loading, error, reload } = useCollection('work', mapWorkRow);
  const rows = items as WorkRow[];
  return (
    <CrudTab<WorkRow>
      name="Project"
      collectionName="work"
      items={rows}
      loading={loading}
      error={error}
      onReload={reload}
      auditAction="work updated"
      blank={() => ({
        id: newId('w'),
        title: '',
        client: '',
        category: 'business',
        summary: '',
        detail: '',
        tags: [],
        year: new Date().getFullYear(),
        url: '',
        accent: '#ff7a18',
        cover: '',
        featured: false,
        status: 'sample',
        sortOrder: (rows.length + 1) * 2,
      })}
      columns={[
        {
          label: 'Project',
          render: (w) => (
            <>
              <b>{w.title}</b>
              <span className="tagline" style={{ display: 'block' }}>
                {w.client}
              </span>
            </>
          ),
        },
        { label: 'Kind', render: (w) => <span className="tagline">{w.category}</span> },
        {
          label: 'Board',
          render: (w) => <span className="work-tags"><span>{w.status === 'live' ? 'live' : 'sample'}</span></span>,
        },
        { label: 'Tags', render: (w) => <span className="tagline">{w.tags.join(', ')}</span> },
      ]}
      fields={(w, set) => (
        <>
          <TextField label="Title" value={w.title} onChange={(v) => set({ title: v })} max={80} />
          <TextField label="Client" value={w.client} onChange={(v) => set({ client: v })} max={80} />
          <SelectField label="Kind" value={w.category} options={WORK_CATEGORIES} onChange={(v) => set({ category: v })} />
          <SelectField
            label="Board label"
            value={w.status}
            options={[
              { value: 'live', label: 'Live client site' },
              { value: 'sample', label: 'Sample board (shows a badge)' },
            ]}
            onChange={(v) => set({ status: v })}
          />
          <TextField label="One-line summary" value={w.summary} onChange={(v) => set({ summary: v })} max={200} wide />
          <TextField label="Detail shown in the lightbox" value={w.detail} onChange={(v) => set({ detail: v })} max={600} area wide />
          <TextField
            label="Tags — one per line, max 8"
            value={w.tags.join('\n')}
            onChange={(v) => set({ tags: linesToList(v).slice(0, 8) })}
            area
          />
          <TextField label="Live URL — optional" value={w.url} onChange={(v) => set({ url: v })} max={200} placeholder="https://" />
          <TextField
            label="Cover image — /img/work-name.jpg or a full https URL, blank for the painted wash"
            value={w.cover}
            onChange={(v) => set({ cover: v.trim().slice(0, 200) })}
            max={200}
            placeholder="/img/work-areex.jpg"
          />
          <NumberField label="Year" value={w.year} min={2000} max={2100} onChange={(v) => set({ year: v })} />
          <NumberField label="Sort order" value={w.sortOrder} max={999} onChange={(v) => set({ sortOrder: v })} />
          <TextField
            label="Accent colour — #rrggbb"
            value={w.accent}
            onChange={(v) => set({ accent: v.slice(0, 7) })}
            max={7}
            placeholder="#ff7a18"
          />
          <SwitchField label="Featured project" value={w.featured} onChange={(v) => set({ featured: v })} />
        </>
      )}
      toWire={(w) => ({
        title: w.title.slice(0, 80),
        client: w.client.slice(0, 80),
        category: w.category,
        summary: w.summary.slice(0, 200),
        detail: w.detail.slice(0, 600),
        tags: w.tags.slice(0, 8),
        year: Math.min(2100, Math.max(2000, Math.round(w.year))),
        url: w.url.slice(0, 200),
        accent: /^#[0-9a-fA-F]{6}$/.test(w.accent) ? w.accent : '#ff7a18',
        cover: /^(\/|https:\/\/)/.test(w.cover.trim()) ? w.cover.trim().slice(0, 200) : '',
        featured: w.featured,
        status: w.status === 'live' ? 'live' : 'sample',
        sortOrder: Math.round(w.sortOrder),
        updatedBy: auth.currentUser?.email || '',
        updatedAt: serverTimestamp(),
      })}
    />
  );
};

/* ------------------------------------------------------------------ */
/* Reviews tab                                                         */
/* ------------------------------------------------------------------ */

const TestimonialsTab: React.FC = () => {
  const { items, loading, error, reload } = useCollection('testimonials', mapQuoteRow);
  const rows = items as QuoteRow[];
  return (
    <CrudTab<QuoteRow>
      name="Review"
      collectionName="testimonials"
      items={rows}
      loading={loading}
      error={error}
      onReload={reload}
      auditAction="testimonial updated"
      blank={() => ({
        id: newId('t'),
        author: '',
        role: '',
        text: '',
        rating: 5,
        approved: false,
        sortOrder: (rows.length + 1) * 2,
      })}
      columns={[
        {
          label: 'Client',
          render: (t) => (
            <>
              <b>{t.author}</b>
              <span className="tagline" style={{ display: 'block' }}>
                {t.role}
              </span>
            </>
          ),
        },
        { label: 'Quote', render: (t) => <span style={{ color: '#ffffffbf' }}>{`${t.text.slice(0, 80)}…`}</span> },
        { label: 'Stars', render: (t) => <span className="tagline">{`${t.rating}/5`}</span> },
        {
          label: 'Visibility',
          render: (t) => (
            <span className={`status-pill st-${t.approved ? 'delivered' : 'archived'}`}>
              {t.approved ? 'public' : 'held back'}
            </span>
          ),
        },
      ]}
      fields={(t, set) => (
        <>
          <TextField label="Author" value={t.author} onChange={(v) => set({ author: v })} max={60} />
          <TextField label="Role or company" value={t.role} onChange={(v) => set({ role: v })} max={70} />
          <TextField label="Quote — 8 to 400 characters" value={t.text} onChange={(v) => set({ text: v })} max={400} area wide />
          <NumberField label="Rating 1 to 5" value={t.rating} min={1} max={5} onChange={(v) => set({ rating: v })} />
          <NumberField label="Sort order" value={t.sortOrder} max={999} onChange={(v) => set({ sortOrder: v })} />
          <SwitchField label="Approved for the public site" value={t.approved} onChange={(v) => set({ approved: v })} />
        </>
      )}
      toWire={(t) => ({
        author: t.author.slice(0, 60),
        role: t.role.slice(0, 70),
        text: t.text.slice(0, 400),
        rating: Math.min(5, Math.max(1, Math.round(t.rating))),
        approved: t.approved,
        sortOrder: Math.round(t.sortOrder),
      })}
    />
  );
};

/* ------------------------------------------------------------------ */
/* Plans tab                                                           */
/* ------------------------------------------------------------------ */

const PlansTab: React.FC = () => {
  const { items, loading, error, reload } = useCollection('plans', mapPlanRow);
  const rows = items as PlanRow[];
  return (
    <CrudTab<PlanRow>
      name="Plan"
      collectionName="plans"
      items={rows}
      loading={loading}
      error={error}
      onReload={reload}
      auditAction="plan updated"
      blank={() => ({
        id: newId('p'),
        name: '',
        tagline: '',
        category: 'website',
        priceInr: 2500,
        oldPriceInr: 0,
        periodLabel: 'one-time build',
        features: [],
        badge: '',
        popular: false,
        active: true,
        sortOrder: (rows.length + 1) * 2,
      })}
      columns={[
        {
          label: 'Plan',
          render: (p) => (
            <>
              <b>{p.name}</b>
              {p.badge ? <span className="plan-badge" style={{ marginLeft: 8 }}>{p.badge}</span> : null}
              <span className="tagline" style={{ display: 'block' }}>
                {p.tagline}
              </span>
            </>
          ),
        },
        { label: 'Kind', render: (p) => <span className="tagline">{p.category}</span> },
        { label: 'Price', render: (p) => <b>{inr(p.priceInr)}</b> },
        {
          label: 'Listing',
          render: (p) => (
            <span className={`status-pill st-${p.active ? 'delivered' : 'archived'}`}>
              {p.active ? 'listed' : 'hidden'}
            </span>
          ),
        },
      ]}
      fields={(p, set) => (
        <>
          <TextField label="Name" value={p.name} onChange={(v) => set({ name: v })} max={60} />
          <TextField label="Badge — optional" value={p.badge} onChange={(v) => set({ badge: v })} max={28} placeholder="MOST POPULAR" />
          <TextField label="Tagline" value={p.tagline} onChange={(v) => set({ tagline: v })} max={160} wide />
          <SelectField label="Kind" value={p.category} options={PLAN_CATEGORIES} onChange={(v) => set({ category: v })} />
          <TextField
            label="Period label"
            value={p.periodLabel}
            onChange={(v) => set({ periodLabel: v })}
            max={40}
            placeholder="one-time build / per month"
          />
          <NumberField label="Price in rupees" value={p.priceInr} min={1} max={200000} onChange={(v) => set({ priceInr: v })} />
          <NumberField label="Crossed-out price, 0 for none" value={p.oldPriceInr} max={200000} onChange={(v) => set({ oldPriceInr: v })} />
          <NumberField label="Sort order" value={p.sortOrder} max={999} onChange={(v) => set({ sortOrder: v })} />
          <SwitchField label="Listed on the site" value={p.active} onChange={(v) => set({ active: v })} />
          <SwitchField label="Highlight as popular" value={p.popular} onChange={(v) => set({ popular: v })} />
          <TextField
            label="Features — one per line, max 24"
            value={p.features.join('\n')}
            onChange={(v) => set({ features: linesToList(v) })}
            area
            wide
          />
        </>
      )}
      toWire={(p) => ({
        name: p.name.slice(0, 60),
        tagline: p.tagline.slice(0, 160),
        category: p.category,
        priceInr: Math.min(200000, Math.max(1, Math.round(p.priceInr))),
        oldPriceInr: Math.min(200000, Math.max(0, Math.round(p.oldPriceInr))),
        periodLabel: p.periodLabel.slice(0, 40),
        features: p.features.slice(0, 24),
        badge: p.badge.slice(0, 28),
        popular: p.popular,
        sortOrder: Math.round(p.sortOrder),
        active: p.active,
        updatedBy: auth.currentUser?.email || '',
        updatedAt: serverTimestamp(),
      })}
    />
  );
};

/* ------------------------------------------------------------------ */
/* Site content + discount board + coupons                             */
/* ------------------------------------------------------------------ */

type CouponRow = { code: string; discountPercent: number; label: string; active: boolean };

const ConfigTab: React.FC<{ email: string }> = ({ email }) => {
  const [cfg, setCfg] = useState<SiteConfigData>(DEFAULT_SITE_CONFIG);
  const [exists, setExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [fresh, setFresh] = useState({ code: '', discountPercent: 10, label: '', active: true });

  const load = useCallback(async () => {
    setLoading(true);
    const snap = await getDoc(doc(db, 'siteConfig', 'main'));
    if (snap.exists()) {
      const d = snap.data() as Record<string, unknown>;
      setExists(true);
      setCfg({
        brandName: text(d.brandName, DEFAULT_SITE_CONFIG.brandName),
        heroTitle: text(d.heroTitle, DEFAULT_SITE_CONFIG.heroTitle),
        heroSubtitle: text(d.heroSubtitle, DEFAULT_SITE_CONFIG.heroSubtitle),
        studioLine: text(d.studioLine, DEFAULT_SITE_CONFIG.studioLine),
        contactEmail: text(d.contactEmail, DEFAULT_SITE_CONFIG.contactEmail),
        contactPhone: text(d.contactPhone, DEFAULT_SITE_CONFIG.contactPhone),
        whatsappUrl: text(d.whatsappUrl, DEFAULT_SITE_CONFIG.whatsappUrl),
        instagramUrl: text(d.instagramUrl, DEFAULT_SITE_CONFIG.instagramUrl),
        behanceUrl: text(d.behanceUrl, ''),
        founderName: text(d.founderName, DEFAULT_SITE_CONFIG.founderName),
        founderQuote: text(d.founderQuote, DEFAULT_SITE_CONFIG.founderQuote),
        statusNote: text(d.statusNote, DEFAULT_SITE_CONFIG.statusNote),
        discountOffer: text(d.discountOffer, ''),
        discountEndsAt: digit(d.discountEndsAt, 0),
      });
    } else {
      setExists(false);
      setCfg(DEFAULT_SITE_CONFIG);
    }

    try {
      const list = await getDocs(query(collection(db, 'coupons'), fsLimit(40)));
      setCoupons(
        list.docs.map((d) => {
          const x = d.data() as Record<string, unknown>;
          return {
            code: d.id,
            discountPercent: digit(x.discountPercent, 0),
            label: text(x.label),
            active: flag(x.active, true),
          };
        })
      );
    } catch {
      setCoupons([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof SiteConfigData>(key: K) => (value: SiteConfigData[K]) =>
    setCfg((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!cfg.brandName.trim()) {
      showToast('The brand name cannot be empty.', 'bad');
      return;
    }
    setSaving(true);
    try {
      const before = { ...cfg };
      const fields = {
        ...siteConfigFields(cfg),
        updatedBy: email,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'siteConfig', 'main'), fields);
      void recordAudit({
        category: 'ADMIN',
        action: 'site content saved',
        target: 'siteConfig/main',
        summary: exists ? 'Updated the live site content' : 'Created the site content document',
        changes: exists ? diffFields(before as object, siteConfigFields(cfg) as object) : [],
      });
      setExists(true);
      showToast('Published. Every visitor sees it within seconds.', 'good');
    } catch (err) {
      showToast(
        err instanceof Error && err.message.toLowerCase().includes('permission')
          ? 'Firestore blocked the save. Publish firestore.rules for the "(default)" database, then retry.'
          : 'Could not save the site content.',
        'bad'
      );
    } finally {
      setSaving(false);
    }
  };

  const setDeadline = (ms: number) => setCfg((prev) => ({ ...prev, discountEndsAt: ms }));

  const saveCoupon = async () => {
    const code = fresh.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
    if (!code) {
      showToast('Give the code a name first.', 'bad');
      return;
    }
    try {
      await setDoc(doc(db, 'coupons', code), {
        discountPercent: Math.min(90, Math.max(1, Math.round(fresh.discountPercent))),
        label: fresh.label.slice(0, 60),
        active: fresh.active,
        updatedBy: email,
        updatedAt: serverTimestamp(),
      });
      void recordAudit({
        category: 'ADMIN',
        action: 'coupon saved',
        target: `coupons/${code}`,
        summary: `${code} — ${fresh.discountPercent}% off`,
      });
      setCoupons((prev) => {
        const rest = prev.filter((c) => c.code !== code);
        return [...rest, { code, discountPercent: fresh.discountPercent, label: fresh.label, active: fresh.active }].sort(
          (a, b) => a.code.localeCompare(b.code)
        );
      });
      setFresh({ code: '', discountPercent: 10, label: '', active: true });
      showToast('Coupon is live on the discount board.', 'good');
    } catch {
      showToast('Could not save that coupon.', 'bad');
    }
  };

  const dropCoupon = async (code: string) => {
    if (!window.confirm(`Delete coupon ${code}?`)) return;
    try {
      await deleteDoc(doc(db, 'coupons', code));
      setCoupons((prev) => prev.filter((c) => c.code !== code));
      void recordAudit({ category: 'ADMIN', action: 'coupon deleted', target: `coupons/${code}`, summary: code });
    } catch {
      showToast('Delete blocked by Firestore rules.', 'bad');
    }
  };

  const seed = async (kind: 'plans' | 'work') => {
    try {
      if (kind === 'plans') {
        for (const p of DEFAULT_PLANS) {
          await setDoc(doc(db, 'plans', p.id), {
            name: p.name,
            tagline: p.tagline,
            category: p.category,
            priceInr: Math.max(1, Math.round(p.priceInr)),
            oldPriceInr: Math.max(0, Math.round(p.oldPriceInr)),
            periodLabel: p.periodLabel,
            features: p.features,
            badge: p.badge,
            popular: p.popular,
            sortOrder: p.sortOrder,
            active: p.active,
            updatedBy: email,
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        for (const w of DEFAULT_WORK) {
          await setDoc(doc(db, 'work', w.id), {
            title: w.title,
            client: w.client,
            category: w.category,
            summary: w.summary,
            detail: w.detail,
            tags: w.tags,
            year: w.year,
            url: w.url,
            accent: w.accent,
            cover: w.cover || '',
            featured: w.featured,
            status: w.status,
            sortOrder: w.sortOrder,
            updatedBy: email,
            updatedAt: serverTimestamp(),
          });
        }
      }
      void recordAudit({
        category: 'ADMIN',
        action: 'defaults published',
        target: kind,
        summary: `Published the starter ${kind} collection`,
      });
      showToast(`${kind === 'plans' ? 'Plans' : 'Work'} published to the live site.`, 'good');
    } catch {
      showToast('Could not publish those defaults — check that firestore.rules is published.', 'bad');
    }
  };

  if (loading) {
    return (
      <div className="empty">
        <Loader2 size={18} className="spin-slow" /> reading the live content document…
      </div>
    );
  }

  const deadlineLocal = toLocalInput(cfg.discountEndsAt);

  return (
    <>
      {!exists ? (
        <div className="pane">
          <b>No content document yet.</b>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>
            Saving this page creates <span className="mono">siteConfig/main</span> in the
            (default) Firestore database. Until then the site runs on the defaults shipped in the app.
          </p>
        </div>
      ) : null}

      <div className="pane">
        <div className="spread" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>
            <LayoutGrid size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 8 }} />
            Headline and copy
          </h3>
          <span className="tagline">hero, studio line and contact details</span>
        </div>
        <div className="grid-form">
          <TextField label="Brand name" value={cfg.brandName} onChange={set('brandName')} max={60} />
          <TextField label="Status chip" value={cfg.statusNote} onChange={set('statusNote')} max={120} />
          <TextField label="Hero title" value={cfg.heroTitle} onChange={set('heroTitle')} max={120} wide />
          <TextField label="Hero subtitle" value={cfg.heroSubtitle} onChange={set('heroSubtitle')} max={300} area wide />
          <TextField label="Studio line" value={cfg.studioLine} onChange={set('studioLine')} max={120} />
          <TextField label="Founder name" value={cfg.founderName} onChange={set('founderName')} max={80} />
          <TextField label="Founder quote" value={cfg.founderQuote} onChange={set('founderQuote')} max={400} area wide />
          <TextField label="Contact email" value={cfg.contactEmail} onChange={set('contactEmail')} max={120} />
          <TextField label="Contact phone" value={cfg.contactPhone} onChange={set('contactPhone')} max={40} />
          <TextField label="WhatsApp link" value={cfg.whatsappUrl} onChange={set('whatsappUrl')} max={200} />
          <TextField label="Instagram link" value={cfg.instagramUrl} onChange={set('instagramUrl')} max={200} />
          <TextField label="Behance link — optional" value={cfg.behanceUrl} onChange={set('behanceUrl')} max={200} />
        </div>
      </div>

      <div className="pane">
        <div className="spread" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>
            <BadgePercent size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 8 }} />
            Discount board and countdown
          </h3>
          <span className="tagline">appears above the plans, live only while a deadline is set</span>
        </div>
        <div className="grid-form">
          <TextField label="Offer text shown on the board" value={cfg.discountOffer} onChange={set('discountOffer')} max={240} area wide />
          <div className="field">
            <label>Offer ends at (your local clock, stored as an exact moment)</label>
            <input
              className="input"
              type="datetime-local"
              value={deadlineLocal}
              onChange={(e) => setDeadline(fromLocalInput(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Quick timers</label>
            <div className="row">
              <button type="button" className="mini" onClick={() => setDeadline(Date.now() + 24 * 3600 * 1000)}>
                24 hours
              </button>
              <button type="button" className="mini" onClick={() => setDeadline(Date.now() + 3 * 86400 * 1000)}>
                3 days
              </button>
              <button type="button" className="mini" onClick={() => setDeadline(Date.now() + 7 * 86400 * 1000)}>
                7 days
              </button>
              <button
                type="button"
                className="mini"
                onClick={() => {
                  const end = new Date();
                  end.setDate(end.getDate() + (31 - end.getDate()));
                  end.setHours(23, 59, 0, 0);
                  setDeadline(end.getTime());
                }}
              >
                End of month
              </button>
              <button type="button" className="mini danger" onClick={() => setDeadline(0)}>
                Clear deadline
              </button>
            </div>
          </div>
        </div>
        <p className="tagline" style={{ marginTop: 0 }}>
          {cfg.discountEndsAt > 0
            ? `board goes dark at ${IST_SHORT.format(new Date(cfg.discountEndsAt))} IST`
            : 'no deadline set — the board shows the offer without a countdown'}
        </p>
      </div>

      <div className="pane">
        <h3>
          <Users size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 8 }} />
          Coupon codes on the board
        </h3>
        {coupons.length ? (
          <table className="tbl">
            <thead>
              <tr>
                <th>Code</th>
                <th>Off</th>
                <th>Label</th>
                <th>Live</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.code}>
                  <td className="mono">{c.code}</td>
                  <td>{c.discountPercent}%</td>
                  <td className="tagline">{c.label || '—'}</td>
                  <td>
                    <span className={`status-pill st-${c.active ? 'delivered' : 'archived'}`}>
                      {c.active ? 'active' : 'paused'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="mini"
                        onClick={() => {
                          setFresh({ code: c.code, discountPercent: c.discountPercent, label: c.label, active: c.active });
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" className="mini danger" onClick={() => void dropCoupon(c.code)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">No coupon codes yet — the board simply shows the offer text.</div>
        )}

        <div className="grid-form" style={{ marginTop: 14 }}>
          <TextField
            label="Code"
            value={fresh.code}
            onChange={(v) => setFresh((p) => ({ ...p, code: v.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))}
            max={24}
            placeholder="VOID10"
          />
          <NumberField label="Percent off" value={fresh.discountPercent} min={1} max={90} onChange={(v) => setFresh((p) => ({ ...p, discountPercent: v }))} />
          <TextField label="Label — optional" value={fresh.label} onChange={(v) => setFresh((p) => ({ ...p, label: v }))} max={60} />
          <SwitchField label="Active" value={fresh.active} onChange={(v) => setFresh((p) => ({ ...p, active: v }))} />
        </div>
        <button type="button" className="mini go" onClick={() => void saveCoupon()}>
          <Plus size={13} />
          Save coupon
        </button>
      </div>

      <div className="pane">
        <h3>
          <Save size={15} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 8 }} />
          Publish
        </h3>
        <div className="row">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 size={15} className="spin-slow" /> : <Save size={15} />}
            Save and publish content
          </button>
          <button type="button" className="mini" onClick={() => void seed('plans')}>
            Publish starter plans
          </button>
          <button type="button" className="mini" onClick={() => void seed('work')}>
            Publish sample work
          </button>
          <span className="tagline">seeding overwrites those collections with the app defaults</span>
        </div>
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Audit tab                                                           */
/* ------------------------------------------------------------------ */

const CATEGORIES: Array<AuditCategory | 'ALL'> = ['ALL', 'ADMIN', 'CUSTOMER', 'AUTH'];

const AuditTab: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<AuditCategory | 'ALL'>('ALL');
  const [needle, setNeedle] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async () => {
      setLoading(true);
      const res = await fetchAuditLog({ max: 300, category, search: needle });
      setEntries(res.entries);
      setError(res.error || '');
      setLoading(false);
    },
    [category, needle]
  );

  useEffect(() => {
    const id = setTimeout(() => void load(), needle ? 350 : 0);
    return () => clearTimeout(id);
  }, [load, needle]);

  return (
    <>
      <div className="pane spread">
        <div className="row">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`mini ${category === c ? 'go' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="row">
          <span style={{ position: 'relative', display: 'block' }}>
            <Search size={14} style={{ position: 'absolute', left: 14, top: 15, color: '#B8A28F' }} />
            <input
              className="input"
              style={{ paddingLeft: 40, width: 240 }}
              value={needle}
              placeholder="actor, action, target…"
              onChange={(e) => setNeedle(e.target.value)}
            />
          </span>
          <button type="button" className="mini" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={13} className="spin-slow" /> : <RefreshCw size={13} />}
            Reload
          </button>
          <button type="button" className="mini" onClick={() => downloadAuditCsv(entries)} disabled={!entries.length}>
            <Download size={13} />
            CSV
          </button>
        </div>
      </div>

      {error ? <p className="err">{error}</p> : null}

      {!entries.length ? (
        <div className="empty">{loading ? 'Reading the trail…' : 'Nothing logged for this filter.'}</div>
      ) : (
        <div className="pane" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>When</th>
                <th>Kind</th>
                <th>Actor</th>
                <th>Action</th>
                <th>What happened</th>
                <th>Device · IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="tagline" style={{ whiteSpace: 'nowrap' }}>
                    {formatAuditTime(e.createdAt)}
                  </td>
                  <td>
                    <span className={`status-pill st-${e.category === 'ADMIN' ? 'quoted' : e.category === 'AUTH' ? 'reviewing' : 'delivered'}`}>
                      {e.category}
                    </span>
                  </td>
                  <td>
                    {e.actor}
                    <span className="tagline" style={{ display: 'block' }}>
                      {e.target}
                    </span>
                  </td>
                  <td>{e.action}</td>
                  <td>
                    <span style={{ color: '#ffffffcf' }}>{e.summary}</span>
                    {e.changes.length ? (
                      <span className="tagline" style={{ display: 'block' }}>
                        {e.changes.join(' | ')}
                      </span>
                    ) : null}
                  </td>
                  <td className="tagline">
                    {e.agent}
                    <span style={{ display: 'block' }}>{e.ip || 'ip not resolved'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="tagline">
        append-only — nobody, including the studio, can edit or delete these rows. {entries.length} shown.
      </p>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Console shell                                                       */
/* ------------------------------------------------------------------ */

export const AdminConsole: React.FC<Props> = ({ email, ready, onOpenAuth }) => {
  const [profile, setProfile] = useState<{ name: string; role: string } | null | undefined>(undefined);
  const [verified, setVerified] = useState(false);
  const [tab, setTab] = useState<Tab>('briefs');
  const deniedRef = React.useRef('');

  useEffect(() => {
    let alive = true;
    setProfile(undefined);
    if (!email) {
      setProfile(null);
      return () => {
        alive = false;
      };
    }
    void consoleProfileForEmail(email).then((match) => {
      if (alive) setProfile(match);
    });
    return () => {
      alive = false;
    };
  }, [email]);

  useEffect(() => {
    if (!email) {
      setVerified(false);
      return;
    }
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      const saved = raw ? (JSON.parse(raw) as { email?: string; at?: number }) : null;
      setVerified(Boolean(saved && saved.email === email && Date.now() - (saved.at || 0) < SESSION_MS));
    } catch {
      setVerified(false);
    }
  }, [email]);

  useEffect(() => {
    if (profile !== null || !email || deniedRef.current === email) return;
    deniedRef.current = email;
    void recordAudit({
      category: 'AUTH',
      action: 'access denied',
      target: 'studio-console',
      actorOverride: email,
      summary: `${email} is not on the studio allowlist`,
    });
  }, [profile, email]);

  const leave = () => navigate('/');

  const lock = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setVerified(false);
  };

  if (!ready || profile === undefined) {
    return (
      <div className="boot">
        <div className="inner">
          <span className="eyebrow">checking access</span>
          <div className="bar">
            <i />
          </div>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="boot">
        <div className="glass-card" style={{ width: 'min(420px, 92vw)' }}>
          <h3 style={{ margin: 0 }}>Studio sign-in required</h3>
          <p className="muted" style={{ fontSize: 14.5 }}>
            This console only opens for the two studio accounts, and then only after the emailed code.
          </p>
          <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={onOpenAuth}>
            Sign in
          </button>
          <button type="button" className="linkish" style={{ marginTop: 14 }} onClick={leave}>
            Back to the website
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="boot">
        <div className="glass-card" style={{ width: 'min(420px, 92vw)' }}>
          <h3 style={{ margin: 0 }}>Not a studio account</h3>
          <p className="muted" style={{ fontSize: 14.5 }}>
            <span className="mono">{email}</span> is not on the console allowlist. Sign in with the
            studio address, or go back to the website.
          </p>
          <div className="row">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                lock();
                void signOut(auth).catch(() => undefined);
              }}
            >
              <LogOut size={15} />
              Sign out
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={leave}>
              Back to the website
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!verified) {
    return <VerifyGate email={email} profile={profile} onPass={() => setVerified(true)} onExit={leave} />;
  }

  const active = TABS.find((t) => t.id === tab) || TABS[0];

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="who">
          <b>{profile.name}</b>
          <span>{email}</span>
          <span className="tagline" style={{ display: 'block', marginTop: 6 }}>
            session locks after 30 minutes
          </span>
        </div>

        {TABS.map((t) => (
          <button key={t.id} type="button" className={`adm-tab ${tab === t.id ? 'is-on' : ''}`} onClick={() => setTab(t.id)}>
            {t.icon}
            {t.label}
          </button>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: 18 }} className="stack sm">
          <LiveClock />
          <button type="button" className="adm-tab" onClick={leave}>
            <LayoutGrid size={16} />
            View the live site
          </button>
          <button
            type="button"
            className="adm-tab"
            onClick={() => {
              lock();
              showToast('Console locked.', 'info');
            }}
          >
            <ShieldCheck size={16} />
            Lock console
          </button>
          <button
            type="button"
            className="adm-tab"
            onClick={() => {
              lock();
              void signOut(auth).catch(() => undefined);
              leave();
            }}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="adm-main">
        <div className="adm-head">
          <div>
            <span className="eyebrow">{active.hint}</span>
            <h2>{active.label}</h2>
          </div>
          <div className="row">
            <MessageSquare size={15} style={{ color: '#FFBF7A' }} />
            <span className="tagline">every change you make here is written to the audit trail</span>
          </div>
        </div>

        {tab === 'briefs' ? <BriefsTab email={email} /> : null}
        {tab === 'orders' ? <OrdersTab email={email} /> : null}
        {tab === 'work' ? <WorkTab /> : null}
        {tab === 'testimonials' ? <TestimonialsTab /> : null}
        {tab === 'plans' ? <PlansTab /> : null}
        {tab === 'config' ? <ConfigTab email={email} /> : null}
        {tab === 'audit' ? <AuditTab /> : null}
      </main>
    </div>
  );
};
