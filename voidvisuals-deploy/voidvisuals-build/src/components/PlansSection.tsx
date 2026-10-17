import React from 'react';
import { Check, Copy, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { Coupon, PlanDoc, SiteConfigData, inr } from '../data/vvData';
import { addonsOf, careOf, websitesOf } from '../lib/content';
import { showToast } from '../lib/toast';
import { navigate } from '../router';
import { OfferCountdown, isOfferExpired } from './OfferCountdown';
import { Tilt } from './Tilt';

interface Props {
  config: SiteConfigData;
  plans: PlanDoc[];
  coupons: Coupon[];
  onChoose: (plan: PlanDoc) => void;
  eyebrow?: string;
  titlePlain?: string;
  titleAccent?: string;
}

const isHighlight = (feature: string) => /^(free|everything|priority)/i.test(feature.trim());

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    showToast(`Code ${code} copied — paste it in your brief.`, 'good');
  } catch {
    showToast(`Use code ${code} in your brief.`, 'info');
  }
}

export const PlansSection: React.FC<Props> = ({
  config,
  plans,
  coupons,
  onChoose,
  eyebrow = 'Transparent pricing',
  titlePlain = 'Fixed price, no surprises,',
  titleAccent = 'no monthly trap',
}) => {
  const websites = websitesOf(plans);
  const addons = addonsOf(plans);
  const care = careOf(plans);
  const offer = config.discountOffer.trim();
  const live = Boolean(offer) && !isOfferExpired(config.discountEndsAt);

  return (
    <section className="section" id="plans">
      <div className="shell">
        <div className="section-head">
          <span className="eyebrow">{eyebrow}</span>
          <h2 className="display">
            <span data-split>{titlePlain}</span> <i>{titleAccent}</i>
          </h2>
          <p className="lead" data-reveal="up" data-delay="0.15">
            Pick a tier, send the brief, and we quote against it. Add-ons and the care plan are listed
            openly because hidden charges are not how this studio works.
          </p>
        </div>

        {live ? (
          <div className="board" data-reveal="up">
            <div>
              <div className="sub">
                <Sparkles size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
                Limited-time offer
              </div>
              <div className="txt">{offer}</div>
              {coupons.length ? (
                <div className="codes">
                  {coupons.slice(0, 6).map((c) => (
                    <span
                      key={c.code}
                      title={`Copy ${c.code} — ${c.discountPercent}% off`}
                      onClick={() => copyCode(c.code)}
                    >
                      <Copy size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 6 }} />
                      {c.code} · {c.discountPercent}%
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <OfferCountdown endsAt={config.discountEndsAt} />
          </div>
        ) : null}

        <div className="plan-grid">
          {websites.map((plan, i) => (
            <Tilt key={plan.id} className={`card plan-card ${plan.popular ? 'is-popular' : ''}`} max={4}>
              <div data-reveal="up" data-delay={`${0.08 * i}`}>
                <div className="plan-top">
                  <span className="tagline">{`Tier ${String(i + 1).padStart(2, '0')}`}</span>
                  {plan.badge ? <span className="plan-badge">{plan.badge}</span> : null}
                </div>
                <h3>{plan.name}</h3>
                <p className="plan-tag">{plan.tagline}</p>
                <div className="price-row">
                  <span className="now">{inr(plan.priceInr)}</span>
                  {plan.oldPriceInr > plan.priceInr ? (
                    <span className="old">{inr(plan.oldPriceInr)}</span>
                  ) : null}
                  <span className="per">{plan.periodLabel}</span>
                </div>
                <div className="cta-row">
                  <button type="button" className="btn btn-primary" onClick={() => onChoose(plan)}>
                    Choose {plan.name}
                  </button>
                </div>
                <ul className="feat">
                  {plan.features.map((f) => (
                    <li key={f} className={isHighlight(f) ? 'star' : ''}>
                      {isHighlight(f) ? <Star size={14} fill="currentColor" /> : <Check size={15} />}
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </Tilt>
          ))}
        </div>

        {addons.length ? (
          <>
            <h3 className="sub-head" data-reveal="up">
              Add-ons — any time, on top of any tier
            </h3>
            <div className="grid grid-4">
              {addons.map((item, i) => (
                <div className="card" key={item.id} data-reveal="up" data-delay={`${0.05 * i}`}>
                  <h3 style={{ marginTop: 0 }}>{item.name}</h3>
                  <p>{item.tagline}</p>
                  <div className="price-row" style={{ marginTop: 14 }}>
                    <span className="now" style={{ fontSize: 26 }}>
                      {inr(item.priceInr)}
                    </span>
                    <span className="per">{item.periodLabel}</span>
                  </div>
                  <ul className="bullets">
                    {item.features.map((f) => (
                      <li key={f}>
                        <Check size={14} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {care.length ? (
          <>
            <h3 className="sub-head" data-reveal="up">
              Care plan
            </h3>
            <div className="grid grid-2">
              {care.map((item) => (
                <div className="card" key={item.id} data-reveal="up">
                  <div className="spread">
                    <h3 style={{ margin: 0 }}>{item.name}</h3>
                    <span className="chip">
                      <ShieldCheck size={13} style={{ color: 'var(--mint)' }} />
                      optional
                    </span>
                  </div>
                  <p style={{ marginTop: 12 }}>{item.tagline}</p>
                  <div className="price-row" style={{ marginTop: 14 }}>
                    <span className="now" style={{ fontSize: 28 }}>
                      {inr(item.priceInr)}
                    </span>
                    <span className="per">{item.periodLabel}</span>
                  </div>
                  <ul className="bullets">
                    {item.features.map((f) => (
                      <li key={f}>
                        <Check size={14} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="row" style={{ marginTop: 18 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChoose(item)}>
                      Ask about the care plan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div className="row" style={{ marginTop: 34 }} data-reveal="up">
          <a
            className="btn btn-ghost"
            href="/contact"
            onClick={(e) => {
              e.preventDefault();
              navigate('/contact');
            }}
          >
            Not sure which tier? Send a brief anyway
          </a>
          <span className="tagline">
            prices in INR · 50% advance, rest on delivery · no hidden charges
          </span>
        </div>
      </div>
    </section>
  );
};
