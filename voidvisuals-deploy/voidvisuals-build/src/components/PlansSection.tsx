import React from 'react';
import { Check, Copy, ShieldCheck, ShoppingBag, Sparkles, Star } from 'lucide-react';
import { Coupon, PlanDoc, SiteConfigData, price } from '../data/vvData';
import { addonsOf, careOf, websitesOf } from '../lib/content';
import { usePrefs, useT } from '../lib/prefs';
import { showToast } from '../lib/toast';
import { navigate } from '../router';
import { OfferCountdown, isOfferExpired } from './OfferCountdown';
import { Tilt } from './Tilt';

interface Props {
  config: SiteConfigData;
  plans: PlanDoc[];
  coupons: Coupon[];
  onChoose: (plan: PlanDoc) => void;
  onBuy: (plan: PlanDoc) => void;
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

export const PlansSection: React.FC<Props> = ({ config, plans, coupons, onChoose, onBuy }) => {
  const { currency } = usePrefs();
  const t = useT();
  const websites = websitesOf(plans);
  const addons = addonsOf(plans);
  const care = careOf(plans);
  const offer = config.discountOffer.trim();
  const live = Boolean(offer) && !isOfferExpired(config.discountEndsAt);
  const shown = (amount: number) => price(amount, currency);

  return (
    <section className="section" id="plans">
      <div className="shell">
        <div className="section-head">
          <span className="eyebrow">{t('plans.eyebrow')}</span>
          <h2 className="display">
            <span data-split>{t('plans.t1')}</span> <i>{t('plans.t2')}</i>
          </h2>
          <p className="lead" data-reveal="up" data-delay="0.15">
            {t('plans.lead')}
          </p>
        </div>

        {live ? (
          <div className="board" data-reveal="up">
            <div>
              <div className="sub">
                <Sparkles size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
                {t('plans.offer')}
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
                  <span className="tagline">{`${t('plans.tier')} ${String(i + 1).padStart(2, '0')}`}</span>
                  {plan.badge ? <span className="plan-badge">{plan.badge}</span> : null}
                </div>
                <h3>{plan.name}</h3>
                <p className="plan-tag">{plan.tagline}</p>
                <div className="price-row">
                  <span className="now">{shown(plan.priceInr)}</span>
                  {plan.oldPriceInr > plan.priceInr ? (
                    <span className="old">{shown(plan.oldPriceInr)}</span>
                  ) : null}
                  <span className="per">{plan.periodLabel}</span>
                </div>
                <div className="cta-row">
                  <button type="button" className="btn btn-primary" onClick={() => onBuy(plan)}>
                    <ShoppingBag size={15} />
                    {t('plans.buy')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 10 }}
                    onClick={() => onChoose(plan)}
                  >
                    {t('plans.enquire')}
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
              {t('plans.addons')}
            </h3>
            <div className="grid grid-4">
              {addons.map((item, i) => (
                <div className="card" key={item.id} data-reveal="up" data-delay={`${0.05 * i}`}>
                  <h3 style={{ marginTop: 0 }}>{item.name}</h3>
                  <p>{item.tagline}</p>
                  <div className="price-row" style={{ marginTop: 14 }}>
                    <span className="now" style={{ fontSize: 26 }}>
                      {shown(item.priceInr)}
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
                    <button type="button" className="mini go" onClick={() => onBuy(item)}>
                      <ShoppingBag size={12} /> {t('plans.buy')}
                    </button>
                    <button type="button" className="mini" onClick={() => onChoose(item)}>
                      {t('plans.enquire')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {care.length ? (
          <>
            <h3 className="sub-head" data-reveal="up">
              {t('plans.care')}
            </h3>
            <div className="grid grid-2">
              {care.map((item) => (
                <div className="card" key={item.id} data-reveal="up">
                  <div className="spread">
                    <h3 style={{ margin: 0 }}>{item.name}</h3>
                    <span className="chip">
                      <ShieldCheck size={13} style={{ color: 'var(--mint)' }} />
                      {t('plans.optional')}
                    </span>
                  </div>
                  <p style={{ marginTop: 12 }}>{item.tagline}</p>
                  <div className="price-row" style={{ marginTop: 14 }}>
                    <span className="now" style={{ fontSize: 28 }}>
                      {shown(item.priceInr)}
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
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onBuy(item)}>
                      <ShoppingBag size={14} />
                      {t('plans.buy')} {item.name}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChoose(item)}>
                      {t('plans.ask')}
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
            {t('plans.notSure')}
          </a>
          <span className="tagline">{currency === 'INR' ? t('plans.note') : t('cur.note')}</span>
        </div>
      </div>
    </section>
  );
};
