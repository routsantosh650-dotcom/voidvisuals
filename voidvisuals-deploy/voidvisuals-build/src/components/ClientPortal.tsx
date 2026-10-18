import React, { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { ExternalLink, Inbox, Loader2, LogOut, Receipt, RefreshCw, Send, MessageCircle } from 'lucide-react';
import { STATUS_LABEL, fetchMyBriefs, type BriefDoc } from '../lib/briefs';
import { ORDER_STATUS_LABEL, fetchMyOrders, type OrderDoc } from '../lib/orders';
import { price } from '../data/vvData';
import { usePrefs } from '../lib/prefs';
import './Billing.css';
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
  const { currency } = usePrefs();
  const [briefs, setBriefs] = useState<BriefDoc[]>([]);
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const email = (user?.email || '').toLowerCase();
  const shown = (amount: number) => price(amount, currency);
  const waLink = (text: string) => `${WHATSAPP_URL.split('?')[0]}?text=${encodeURIComponent(text)}`;

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    const [b, o] = await Promise.all([fetchMyBriefs(email), fetchMyOrders(email)]);
    setBriefs(b.briefs);
    setOrders(o.orders);
    setError(b.error || o.error || '');
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

        {orders.length ? (
          <>
            <h3 className="sub-head" style={{ marginTop: 0 }} data-reveal="up">
              Payments &amp; orders
            </h3>
            <div className="stack" style={{ marginBottom: 44 }}>
              {orders.map((o) => (
                <article className="pane" key={o.id} data-reveal="up">
                  <div className="spread">
                    <div>
                      <h3 style={{ margin: 0 }}>{o.company || o.name || 'Studio order'}</h3>
                      <span className="tagline">
                        invoice {o.ref} · placed {o.createdAt ? DATE.format(new Date(o.createdAt)) : '—'} IST
                      </span>
                    </div>
                    <span className={`status-pill st-${o.status}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                  </div>

                  <ul className="bill-lines" style={{ marginTop: 14 }}>
                    {o.items.map((it) => (
                      <li key={`${it.planId}·${it.qty}`} style={{ gridTemplateColumns: '1fr auto' }}>
                        <div>
                          <b>{it.name}</b>
                          <span>
                            {it.periodLabel ? `${it.periodLabel} · ` : ''}
                            {it.qty} × {shown(it.priceInr)}
                          </span>
                        </div>
                        <span className="amt">{shown(it.lineTotalInr)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="bill-sum">
                    <div>
                      <span>Subtotal</span>
                      <b>{shown(o.subtotalInr)}</b>
                    </div>
                    {o.discountInr > 0 ? (
                      <div className="off">
                        <span>Coupon {o.coupon}</span>
                        <b>−{shown(o.discountInr)}</b>
                      </div>
                    ) : null}
                    <div className="total">
                      <span>{o.status === 'awaiting-payment' ? 'To pay' : 'Invoice total'}</span>
                      <b>{shown(o.totalInr)}</b>
                    </div>
                  </div>

                  {o.status === 'awaiting-payment' ? (
                    <p className="fine">
                      Still awaiting the UPI transfer. Scan the QR from the checkout sheet, or open{' '}
                      <a
                        className="linkish"
                        href={waLink(`Hi VoidVisuals, I need the UPI QR for invoice ${o.ref} (₹${o.totalInr}).`)}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        WhatsApp
                      </a>{' '}
                      and we will resend it.
                    </p>
                  ) : null}

                  {o.txnRef ? (
                    <p className="tagline" style={{ marginTop: 12 }}>
                      UPI reference on record: {o.txnRef}
                    </p>
                  ) : null}

                  {o.note ? (
                    <div className="ok-card" style={{ padding: 18, marginTop: 18 }}>
                      <span className="tagline">Studio note</span>
                      <p style={{ margin: '8px 0 0', color: '#eafff3' }}>{o.note}</p>
                    </div>
                  ) : null}

                  {o.timeline.length ? (
                    <div className="timeline">
                      {o.timeline
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
                    <a
                      className="btn btn-ghost btn-sm"
                      href={waLink(`Hi VoidVisuals, I have a question about invoice ${o.ref}.`)}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <MessageCircle size={15} />
                      Ask about this order
                    </a>
                    {o.status === 'delivered' ? (
                      <span className="chip">
                        <Receipt size={13} />
                        Delivered — thank you.
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}

        {!briefs.length && !orders.length && !loading ? (
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
            {briefs.length && orders.length ? (
              <h3 className="sub-head" style={{ margin: 0 }}>
                Brief requests
              </h3>
            ) : null}
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
