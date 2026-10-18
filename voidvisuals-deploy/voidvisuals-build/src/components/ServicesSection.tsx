import React from 'react';
import { Code, Headphones, PenTool, RefreshCw, Sparkles, TrendingUp, Check } from 'lucide-react';
import { SERVICES } from '../data/vvData';
import { navigate } from '../router';
import { Tilt } from './Tilt';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  design: PenTool,
  development: Code,
  motion: Sparkles,
  growth: TrendingUp,
  upgrade: RefreshCw,
  support: Headphones,
};

export const ServicesSection: React.FC = () => (
  <section className="section" id="services">
    <div className="shell">
      <div className="section-head">
        <span className="eyebrow">What the studio does</span>
        <h2 className="display">
          <span data-split>Everything your website needs,</span> <i>in one place</i>
        </h2>
        <p className="lead" data-reveal="up" data-delay="0.15">
          Design, code, motion, speed and the after-care — the same four people handle all of it, so
          nothing gets lost between a designer and a developer.
        </p>
      </div>

      <div className="grid grid-3">
        {SERVICES.map((item, i) => {
          const Icon = ICONS[item.id] || Sparkles;
          return (
            <Tilt key={item.id} className="card" max={5}>
              <div data-reveal="up" data-delay={`${0.05 * i}`}>
                <span className="ico">
                  <Icon size={21} />
                </span>
                <span className="num">
                  {String(i + 1).padStart(2, '0')} / {String(SERVICES.length).padStart(2, '0')}
                </span>
                <h3>{item.title}</h3>
                <p>{item.blurb}</p>
                <ul className="bullets">
                  {item.bullets.map((b) => (
                    <li key={b}>
                      <Check size={14} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </Tilt>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 38 }} data-reveal="up">
        <a
          className="btn btn-ghost"
          href="/contact"
          onClick={(e) => {
            e.preventDefault();
            navigate('/contact');
          }}
        >
          Tell us what you need
        </a>
        <span className="tagline">most clients start with a free 15 minute call</span>
      </div>
    </div>
  </section>
);
