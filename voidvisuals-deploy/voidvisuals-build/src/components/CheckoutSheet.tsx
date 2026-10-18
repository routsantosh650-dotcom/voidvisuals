import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import {
  BadgeIndianRupee,
  Check,
  Copy,
  Loader2,
  Minus,
  Plus,
  Printer,
  QrCode,
  ShoppingBag,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { Coupon, PlanDoc, UPI, price } from '../data/vvData';
import { totalsOf, upiIntent, useCart, useCartActions } from '../lib/cart';
import { createOrder, type OrderDraft } from '../lib/orders';
import { WHATSAPP_URL } from '../config';
import { recordAudit } from '../lib/audit';
import { showToast } from '../lib/toast';
import { usePrefs } from '../lib/prefs';
import './Billing.css';

interface Props {
  open: boolean;
  onClose: () => void;
  coupons: Coupon[];
  plans: PlanDoc[];
  user: User | null;
  onOpenAuth: () => void;
}

type Stage = 'cart' | 'pay';

const EMPTY_DRAFT: OrderDraft = {
  name: '',
  email: '',
  phone: '',
  company: '',
  coupon: '',
  lines: [],
  website: '',
};

/**
 * The whole checkout in one sheet: cart, invoice details, then the UPI QR for the exact amount.
 * No card form and no gateway — the money moves inside the payer's own UPI app, and the studio
 * confirms it by hand, which is why an order is created as "awaiting-payment" and never self-marked.
 */
export const CheckoutSheet: React.FC<Props> = ({ open, onClose, coupons, plans, user, onOpenAuth }) => {
  const cart = useCart();
  const actions = useCartActions();
  const { currency } = usePrefs();

  const [stage, setStage] = useState<Stage>('cart');
  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState<{ id: string; ref: string; totalInr: number } | null>(null);
  const [copied, setCopied] = useState('');
  const sheetRef = useRef<HTMLDivElement>(null);

  const percent = useMemo(() => {
    const code = cart.coupon.trim().toUpperCase();
    if (!code) return 0;
    return coupons.find((c) => c.code.toUpperCase() === code)?.discountPercent ?? 0;
  }, [cart.coupon, coupons]);

  const totals = useMemo(() => totalsOf(cart, percent), [cart, percent]);
  const unknownCoupon = cart.coupon.trim().length > 0 && percent === 0;

  // A cart can outlive a price change or a retired plan (it lives in localStorage). The Worker
  // always re-prices from Firestore, so the sheet warns instead of letting someone pay a stale
  // amount that no longer matches the order.
  const stale = useMemo(() => {
    const out: string[] = [];
    for (const line of cart.lines) {
      const live = plans.find((p) => p.id === line.planId);
      if (!live || !live.active) out.push(`${line.name} is no longer on the menu.`);
      else if (live.priceInr !== line.priceInr) out.push(`${line.name} is now ${price(live.priceInr)}.`);
    }
    return out;
  }, [cart.lines, plans]);

  // Prefill from the session — the invoice has to match the account that owns the order.
  useEffect(() => {
    if (!open) return;
    setDraft((prev) =>
      prev.email || !user?.email
        ? prev
        : { ...prev, email: user.email, name: prev.name || (user.displayName || '').slice(0, 60) }
    );
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const copy = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      showToast(`${label}: ${value}`, 'info');
    }
  }, []);

  const submit = useCallback(async () => {
    if (!user) {
      setError('Sign in first — the invoice and the payment have to belong to one account.');
      return;
    }
    setError('');
    setBusy(true);
    const res = await createOrder({ ...draft, lines: cart.lines, coupon: cart.coupon });
    setBusy(false);
    if (!res.ok || !res.order) {
      setError(res.error || 'The order could not be created.');
      return;
    }
    setPlaced(res.order);
    setStage('pay');
    void recordAudit({
      category: 'CUSTOMER',
      action: 'order placed',
      target: res.order.ref,
      summary: `${res.order.ref} created for ${draft.email} — ${price(res.order.totalInr)}`,
    });
  }, [cart.coupon, cart.lines, draft, user]);

  const startOver = useCallback(() => {
    actions.clear();
    setPlaced(null);
    setStage('cart');
    setError('');
    onClose();
  }, [actions, onClose]);

  if (!open) return null;

  const intent = placed ? upiIntent(placed.totalInr, placed.ref) : '';
  const payUrl = intent;

  return (
    <div className="veil sheet-veil" role="dialog" aria-modal="true" aria-label="Checkout">
      <div className="sheet glass-card" ref={sheetRef}>
        <header className="sheet-head">
          <div>
            <span className="eyebrow">{stage === 'cart' ? 'Your build' : 'Payment'}</span>
            <h3>{stage === 'cart' ? 'Cart & invoice' : `Pay ${price(placed?.totalInr || 0)}`}</h3>
          </div>
          <button type="button" className="x" onClick={onClose} aria-label="Close checkout">
            <X size={16} />
          </button>
        </header>

        {stage === 'cart' ? (
          <>
            {!cart.lines.length ? (
              <div className="empty">
                <ShoppingBag size={22} style={{ marginBottom: 10 }} />
                <div>Nothing in the cart yet. Pick a plan or an add-on and it lands here.</div>
              </div>
            ) : (
              <div className="bill" id="bill-print">
                <div className="bill-top">
                  <div>
                    <b>VoidVisuals</b>
                    <span className="tagline">creative web studio · India</span>
                  </div>
                  <span className="tagline">
                    {UPI.vpa} · {UPI.payee}
                  </span>
                </div>

                <ul className="bill-lines">
                  {cart.lines.map((line, i) => (
                    <li key={line.planId} style={{ animationDelay: `${0.04 * i}s` }}>
                      <div>
                        <b>{line.name}</b>
                        <span>
                          {price(line.priceInr)} {line.periodLabel ? `· ${line.periodLabel}` : ''}
                        </span>
                      </div>
                      <div className="qty">
                        <button
                          type="button"
                          aria-label={`Fewer ${line.name}`}
                          onClick={() => actions.setQty(line.planId, line.qty - 1)}
                        >
                          <Minus size={12} />
                        </button>
                        <b>{line.qty}</b>
                        <button
                          type="button"
                          aria-label={`More ${line.name}`}
                          onClick={() => actions.setQty(line.planId, line.qty + 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="amt">{price(line.priceInr * line.qty)}</div>
                      <button type="button" className="del" aria-label={`Remove ${line.name}`} onClick={() => actions.remove(line.planId)}>
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="bill-sum">
                  <div>
                    <span>Subtotal</span>
                    <b>{price(totals.subtotalInr)}</b>
                  </div>
                  {totals.discountInr > 0 ? (
                    <div className="off">
                      <span>Coupon {cart.coupon}</span>
                      <b>− {price(totals.discountInr)}</b>
                    </div>
                  ) : null}
                  <div className="total">
                    <span>To pay now</span>
                    <b>{price(totals.totalInr)}</b>
                  </div>
                  {currency !== 'INR' ? (
                    <div className="approx">
                      <span>Indicative</span>
                      <b>{price(totals.totalInr, currency)}</b>
                    </div>
                  ) : null}
                  <p className="fine">
                    UPI collects the exact ₹ amount above. Taxes and the first year of hosting are
                    already inside these prices — nothing is added later.
                  </p>
                </div>
              </div>
            )}

            <div className="sheet-form">
              <div className="row" style={{ gap: 10 }}>
                <input
                  className="input"
                  placeholder="Coupon code"
                  value={cart.coupon}
                  maxLength={24}
                  onChange={(e) => actions.setCoupon(e.target.value.toUpperCase())}
                  style={{ maxWidth: 190 }}
                />
                {unknownCoupon ? <span className="err" style={{ marginTop: 0 }}>That code is not live.</span> : null}
              </div>

              <div className="field">
                <label htmlFor="co-name">Name on the invoice</label>
                <input
                  id="co-name"
                  className="input"
                  value={draft.name}
                  maxLength={60}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Your full name"
                />
              </div>
              <div className="grid-form">
                <div className="field">
                  <label htmlFor="co-email">Email</label>
                  <input
                    id="co-email"
                    className="input"
                    type="email"
                    value={draft.email}
                    maxLength={120}
                    onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                    placeholder={user?.email || 'you@example.com'}
                    disabled={Boolean(user)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="co-phone">Phone / WhatsApp</label>
                  <input
                    id="co-phone"
                    className="input"
                    value={draft.phone}
                    maxLength={24}
                    onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+91 …"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="co-company">Brand or company (optional)</label>
                <input
                  id="co-company"
                  className="input"
                  value={draft.company}
                  maxLength={80}
                  onChange={(e) => setDraft((p) => ({ ...p, company: e.target.value }))}
                  placeholder="What should we call the project?"
                />
              </div>
              {/* Honeypot: a real person never sees or fills this. */}
              <div className="hp">
                <label htmlFor="co-web">Website</label>
                <input
                  id="co-web"
                  tabIndex={-1}
                  autoComplete="off"
                  value={draft.website}
                  onChange={(e) => setDraft((p) => ({ ...p, website: e.target.value }))}
                />
              </div>

              {stale.length ? (
                <div className="err">
                  Prices moved while you were browsing — {stale.join(' ')} Refresh the page to
                  update the cart.
                </div>
              ) : null}
              {error ? <div className="err">{error}</div> : null}

              <div className="row" style={{ marginTop: 4 }}>
                {user ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || !cart.lines.length || totals.totalInr < 1 || stale.length > 0 || Boolean(draft.website)}
                    onClick={() => void submit()}
                  >
                    {busy ? <Loader2 size={15} className="spin-slow" /> : <BadgeIndianRupee size={15} />}
                    {busy ? 'Creating your order…' : `Get the UPI QR · ${price(totals.totalInr)}`}
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={onOpenAuth}>
                    Sign in to checkout
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                  Keep browsing
                </button>
                {!user ? <span className="tagline">one account, every order in My projects</span> : null}
              </div>
            </div>
          </>
        ) : (
          <div className="pay">
            <div className="qr-box">
              <QRCodeSVG
                value={intent}
                size={188}
                level="M"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#1a0d05"
              />
              <span className="qr-glow" />
            </div>

            <div className="pay-side">
              <div className="pay-amount">
                <span>Amount</span>
                <b>{price(placed?.totalInr || 0)}</b>
                <small>{placed?.ref} · awaiting payment</small>
              </div>

              {/* The printable bill: same line items, stamped with the order reference. */}
              <div className="bill recap" id="bill-print">
                <div className="bill-top">
                  <div>
                    <b>VoidVisuals</b>
                    <span className="tagline">invoice {placed?.ref || ''}</span>
                  </div>
                  <span className="tagline">{UPI.vpa}</span>
                </div>
                <ul className="bill-lines">
                  {cart.lines.map((line) => (
                    <li key={line.planId}>
                      <div>
                        <b>{line.name}</b>
                        <span>{price(line.priceInr)} each</span>
                      </div>
                      <div className="qty">
                        <b>{line.qty}</b>
                      </div>
                      <div className="amt">{price(line.priceInr * line.qty)}</div>
                    </li>
                  ))}
                </ul>
                <div className="bill-sum">
                  <div>
                    <span>Subtotal</span>
                    <b>{price(totalsOf(cart, percent).subtotalInr)}</b>
                  </div>
                  {totals.discountInr > 0 ? (
                    <div className="off">
                      <span>Coupon {cart.coupon}</span>
                      <b>− {price(totals.discountInr)}</b>
                    </div>
                  ) : null}
                  <div className="total">
                    <span>Total paid by UPI</span>
                    <b>{price(placed?.totalInr || 0)}</b>
                  </div>
                </div>
                <p className="fine">
                  {draft.name || user?.email} · {draft.phone} · raised{' '}
                  {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}{' '}
                  IST. Prices include taxes and the first year of hosting.
                </p>
              </div>

              <p className="fine">
                Open any UPI app (GPay, PhonePe, Paytm, BHIM), scan the code, and the amount is
                already filled in. {UPI.verifyLine}
              </p>

              <div className="pay-rows">
                <button type="button" className="mini" onClick={() => void copy(UPI.vpa, 'UPI ID')}>
                  <Copy size={12} /> {copied === 'UPI ID' ? 'Copied' : UPI.vpa}
                </button>
                <button
                  type="button"
                  className="mini"
                  onClick={() => void copy(String(placed?.totalInr || 0), 'Amount')}
                >
                  <Copy size={12} /> {copied === 'Amount' ? 'Copied' : 'Copy amount'}
                </button>
                <a className="mini" href={payUrl} target="_blank" rel="noreferrer noopener">
                  <Smartphone size={12} /> Open UPI app
                </a>
                <button type="button" className="mini" onClick={() => window.print()}>
                  <Printer size={12} /> Print bill
                </button>
              </div>

              <a
                className="btn btn-ghost btn-sm"
                href={`${WHATSAPP_URL.split('?')[0]}?text=${encodeURIComponent(
                  `Hi VoidVisuals, I paid ${price(placed?.totalInr || 0)} for order ${placed?.ref || ''}. UPI reference: `
                )}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <QrCode size={14} /> Send the payment reference
              </a>

              <p className="fine">
                We confirm the payment inside an hour and the order moves to “Building” in
                My projects. Nothing is auto-marked paid — that stays a human decision.
              </p>

              <div className="row">
                <button type="button" className="btn btn-primary btn-sm" onClick={startOver}>
                  <Check size={14} /> Done — back to the site
                </button>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => {
                    setStage('cart');
                    setPlaced(null);
                  }}
                >
                  Edit the cart
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
