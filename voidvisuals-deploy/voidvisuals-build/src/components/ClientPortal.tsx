import React, { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { ExternalLink, Inbox, Loader2, LogOut, RefreshCw, Send, MessageCircle } from 'lucide-react';
import { STATUS_LABEL, fetchMyBriefs, type BriefDoc } from '../lib/briefs';
import { WHATSAPP_URL } from '../config';
import { navigate } from '../router';

interface Props {
  user: User | null;
  ready: boolean;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

const DATE = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

export const ClientPortal: React.FC<Props> = ({ user, ready, onOpenAuth, onSignOut }) => {
  const [briefs, setBriefs] = useState<BriefDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const email = (user?.email || '').toLowerCase();

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    const res = await fetchMyBriefs(email);
    setBriefs(res.briefs);
    setError(res.error || '');
    setLoading(false);
  }, [email]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) {
    return (
      <section className="section">
        <div className="shell row" style={{ justifyContent: 'center', minHeight: '40vh' }}>
          <Loader2 size={20} className="spin-slow" />
          <span className="tagline">checking your session…</span>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="section">
        <div className="shell">
          <div className="glass-card center-wrap" style={{ textAlign: 'center' }}>
            <span className="ico" style={{ margin: '0 auto 14px' }}>
              <Inbox size={20} />
            </span>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Track your project</h3>
            <p className="lead" style={{ margin: '12px auto 0', maxWidth: '48ch' }}>
              Sign in with the email you used on your brief to see its live status, the studio reply
              and every update we logged. You can also send a brief without an account.
            </p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 24 }}>
              <button type="button" className="btn btn-primary" onClick={onOpenAuth}>
                Sign in
              </button>
              <a
                className="btn btn-ghost"
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/contact');
                }}
              >
                Send a brief
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="shell">
        <div className="section-head spread">
          <div>
            <span className="eyebrow">Client portal</span>
            <h2 className="display" style={{ fontSize: 'clamp(28px,3.6vw,42px)' }}>
              Your briefs, <i>live status</i>
            </h2>
          </div>
          <div className="row">
            <span className="chip">{user.email}</span>
            <button type="button" className="mini" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="spin-slow" /> : <RefreshCw size={13} />}
              Refresh
            </button>
            <button
              type="button"
              className="mini"
              onClick={onSignOut}
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>

        {error ? <div className="err" style={{ marginBottom: 18 }}>{error}</div> : null}

        {!briefs.length && !loading ? (
          <div className="empty">
            No brief on this account yet.{' '}
            <a
              href="/contact"
              className="hl"
              style={{ fontWeight: 700 }}
              onClick={(e) => {
                e.preventDefault();
                navigate('/contact');
              }}
            >
              Send the first one
            </a>{' '}
            — it takes two minutes.
          </div>
        ) : (
          <div className="stack">
            {briefs.map((b) => (
              <article className="pane" key={b.id}>
                <div className="spread">
                  <div>
                    <h3 style={{ margin: 0 }}>{b.service || 'Project brief'}</h3>
                    <span className="tagline">
                      ref {b.id} · sent {b.createdAt ? DATE.format(new Date(b.createdAt)) : '—'} IST
                      {b.budget ? ` · budget ${b.budget}` : ''}
                    </span>
                  </div>
                  <span className={`status-pill st-${b.status}`}>{STATUS_LABEL[b.status]}</span>
                </div>

                <p style={{ margin: '16px 0 0', color: '#ffffffc9', whiteSpace: 'pre-wrap' }}>{b.details}</p>

                {b.link ? (
                  <p className="tagline" style={{ marginTop: 10 }}>
                    existing site: {b.link}
                  </p>
                ) : null}
                {b.coupon ? (
                  <p className="tagline" style={{ marginTop: 6 }}>
                    coupon applied at brief stage: {b.coupon}
                  </p>
                ) : null}

                {b.note ? (
                  <div className="ok-card" style={{ padding: 18, marginTop: 18 }}>
                    <span className="tagline">Studio reply</span>
                    <p style={{ margin: '8px 0 0', color: '#eafff3' }}>{b.note}</p>
                  </div>
                ) : null}

                {b.timeline.length ? (
                  <div className="timeline">
                    {b.timeline
                      .slice()
                      .reverse()
                      .map((ev, i) => (
                        <div className="tl" key={`${ev.at}-${i}`}>
                          <span>{ev.at ? DATE.format(new Date(ev.at)) : '—'}</span>
                          <div>
                            {ev.label}
                            {ev.by ? <span className="muted"> · {ev.by}</span> : null}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : null}

                <div className="row" style={{ marginTop: 18 }}>
                  <a className="btn btn-ghost btn-sm" href={WHATSAPP_URL} target="_blank" rel="noreferrer noopener">
                    <MessageCircle size={15} />
                    Ask about this brief
                  </a>
                  <a
                    className="btn btn-ghost btn-sm"
                    href="/contact"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/contact');
                    }}
                  >
                    <Send size={15} />
                    Add more detail
                  </a>
                  <span className="tagline">
                    <ExternalLink size={12} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 6 }} />
                    status updates come from the studio, never from a bot
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
