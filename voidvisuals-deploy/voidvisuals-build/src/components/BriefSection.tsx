import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  AtSign,
  Check,
  Clock3,
  Mail,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { SiteConfigData } from '../data/vvData';
import { BRIEF_BUDGETS, BRIEF_SERVICES, BriefDraft, submitBrief, validateBrief } from '../lib/briefs';
import { recordAudit } from '../lib/audit';
import { navigate } from '../router';
import { showToast } from '../lib/toast';

export interface BriefPreset {
  service?: string;
  budget?: string;
  details?: string;
  stamp?: number;
}

const EMPTY: BriefDraft = {
  name: '',
  email: '',
  phone: '',
  service: '',
  budget: '',
  details: '',
  link: '',
  coupon: '',
  company: '',
};

interface Props {
  config: SiteConfigData;
  preset?: BriefPreset;
}

const NEXT_STEPS = [
  'We read the brief and reply within 24 hours — usually the same day.',
  'You get a fixed price, a page list and a start date before any payment.',
  '50% advance to open the slot, the rest when the site is live.',
];

export const BriefSection: React.FC<Props> = ({ config, preset }) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<BriefDraft>(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (!preset) return;
    setDraft((prev) => ({
      ...prev,
      service: preset.service || prev.service,
      budget: preset.budget || prev.budget,
      details: preset.details ? (prev.details ? prev.details : preset.details) : prev.details,
    }));
    // "Choose plan" can be clicked while the form is far below the fold.
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [preset]);

  const set = <K extends keyof BriefDraft>(key: K) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setDraft((prev) => ({ ...prev, [key]: e.target.value }));
    if (error) setError('');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateBrief(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    const result = await submitBrief(draft);
    setBusy(false);

    if (!result.ok) {
      setError(result.error || 'Could not send the brief. Please try again.');
      return;
    }

    if (result.id) {
      setDone({ id: result.id });
      showToast('Brief sent — check your inbox for the reply.', 'good');
      void recordAudit({
        category: 'CUSTOMER',
        action: 'brief submitted',
        target: result.id,
        summary: `${draft.service || 'project'} brief from ${draft.name} (${draft.email})`,
      });
      setDraft({ ...EMPTY });
      return;
    }
    // Bot trap fired: pretend success without touching the database.
    setDone({ id: '' });
    showToast('Brief sent.', 'good');
  };

  return (
    <section className="section" id="contact">
      <div className="shell">
        <div className="section-head">
          <span className="eyebrow">Start here</span>
          <h2 className="display">
            <span data-split>Send a brief,</span> <i>get a real plan</i>
          </h2>
          <p className="lead" data-reveal="up" data-delay="0.15">
            Two minutes of your time gets you a page list, a fixed price and a delivery date. No
            forms that go nowhere — every brief lands in the studio inbox.
          </p>
        </div>

        <div className="brief-grid">
          {done ? (
            <div className="ok-card" data-reveal="scale">
              <span className="ico" style={{ marginBottom: 10 }}>
                <Check size={22} />
              </span>
              <h3>Brief received.</h3>
              <p style={{ margin: 0, color: '#dfffe9', lineHeight: 1.65 }}>
                We reply within 24 hours on{' '}
                <a className="hl" href={`mailto:${config.contactEmail}`}>
                  {config.contactEmail}
                </a>{' '}
                or WhatsApp. Keep the reference below if you message us.
              </p>
              {done.id ? (
                <p className="mono" style={{ marginTop: 16, fontSize: 13, color: '#b9ffe0' }}>
                  Ref {done.id}
                </p>
              ) : null}
              <div className="row" style={{ marginTop: 22 }}>
                <a
                  className="btn btn-primary btn-sm"
                  href="/portal"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/portal');
                  }}
                >
                  Track this brief
                  <ArrowRight size={15} className="arrow" />
                </a>
                <a className="btn btn-ghost btn-sm" href={config.whatsappUrl} target="_blank" rel="noreferrer noopener">
                  <MessageCircle size={15} />
                  WhatsApp now
                </a>
                <button type="button" className="linkish" onClick={() => setDone(null)}>
                  Send another brief
                </button>
              </div>
            </div>
          ) : (
            <form ref={formRef} className="glass-card" onSubmit={onSubmit} noValidate>
              <div className="field">
                <label htmlFor="bf-name">Your name *</label>
                <input
                  id="bf-name"
                  className="input"
                  value={draft.name}
                  onChange={set('name')}
                  placeholder="e.g. Rohit Mehta"
                  maxLength={60}
                  autoComplete="name"
                />
              </div>

              <div className="grid-form">
                <div className="field">
                  <label htmlFor="bf-email">Email *</label>
                  <input
                    id="bf-email"
                    className="input"
                    type="email"
                    value={draft.email}
                    onChange={set('email')}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                <div className="field">
                  <label htmlFor="bf-phone">Phone / WhatsApp</label>
                  <input
                    id="bf-phone"
                    className="input"
                    value={draft.phone}
                    onChange={set('phone')}
                    placeholder="+91 ..."
                    maxLength={24}
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="grid-form">
                <div className="field">
                  <label htmlFor="bf-service">What do you need? *</label>
                  <select id="bf-service" className="select" value={draft.service} onChange={set('service')}>
                    <option value="">Choose one…</option>
                    {BRIEF_SERVICES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="bf-budget">Budget</label>
                  <select id="bf-budget" className="select" value={draft.budget} onChange={set('budget')}>
                    <option value="">Not sure yet</option>
                    {BRIEF_BUDGETS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="bf-details">Project details *</label>
                <textarea
                  id="bf-details"
                  className="textarea"
                  value={draft.details}
                  onChange={set('details')}
                  maxLength={1200}
                  placeholder="Who it is for, the pages or features you want, and anything you already have (logo, old site, photos)."
                />
                <span className="tagline">
                  {draft.details.trim().length}/1200 · a sentence or two is enough to start
                </span>
              </div>

              <div className="grid-form">
                <div className="field">
                  <label htmlFor="bf-link">Existing website (if any)</label>
                  <input
                    id="bf-link"
                    className="input"
                    value={draft.link}
                    onChange={set('link')}
                    placeholder="https://"
                    maxLength={200}
                  />
                </div>
                <div className="field">
                  <label htmlFor="bf-coupon">Coupon code</label>
                  <input
                    id="bf-coupon"
                    className="input mono"
                    value={draft.coupon}
                    onChange={set('coupon')}
                    placeholder="VOID10"
                    maxLength={24}
                  />
                </div>
              </div>

              {/* bot trap — real people never see or fill this */}
              <div className="hp" aria-hidden="true">
                <label htmlFor="bf-company">Company</label>
                <input id="bf-company" tabIndex={-1} autoComplete="off" value={draft.company} onChange={set('company')} />
              </div>

              {error ? (
                <p className="err" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="form-foot">
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Sending…' : 'Send my brief'}
                  {!busy ? <Send size={16} /> : null}
                </button>
                <span className="form-note">
                  <ShieldCheck size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
                  Used only to answer your project. Never shared, never sold.
                </span>
              </div>
            </form>
          )}

          <aside className="stack" data-reveal="right">
            <div className="c-cards">
              <a className="c-card" href={`mailto:${config.contactEmail}`}>
                <span className="ci">
                  <Mail size={18} />
                </span>
                <span>
                  <b>Email the studio</b>
                  <span>{config.contactEmail}</span>
                </span>
              </a>
              <a className="c-card" href={config.whatsappUrl} target="_blank" rel="noreferrer noopener">
                <span className="ci">
                  <MessageCircle size={18} />
                </span>
                <span>
                  <b>WhatsApp</b>
                  <span>{config.contactPhone}</span>
                </span>
              </a>
              {config.instagramUrl ? (
                <a className="c-card" href={config.instagramUrl} target="_blank" rel="noreferrer noopener">
                  <span className="ci">
                    <AtSign size={18} />
                  </span>
                  <span>
                    <b>Instagram</b>
                    <span>work in progress, daily</span>
                  </span>
                </a>
              ) : null}
              <div className="c-card">
                <span className="ci">
                  <Phone size={18} />
                </span>
                <span>
                  <b>Call after 10 AM IST</b>
                  <span>{config.contactPhone}</span>
                </span>
              </div>
            </div>

            <div className="card">
              <span className="ico" style={{ marginBottom: 12 }}>
                <Clock3 size={20} />
              </span>
              <h3 style={{ marginTop: 0 }}>What happens next</h3>
              <ul className="bullets">
                {NEXT_STEPS.map((s) => (
                  <li key={s}>
                    <Check size={14} />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};
