import React from 'react';
import { ArrowRight, Eye, Lock, Users } from 'lucide-react';
import { SITE_FACTS, TEAM } from '../data/vvData';
import type { SiteConfigData } from '../data/vvData';
import { navigate } from '../router';

interface Props {
  config: SiteConfigData;
}

export const StudioSection: React.FC<Props> = ({ config }) => (
  <section className="section" id="studio">
    <div className="shell">
      <div className="brief-grid">
        <div>
          <span className="eyebrow">Inside the studio</span>
          <h2 className="display" style={{ marginTop: 16 }}>
            <span data-split>Four people, one standard:</span> <i>ship work we would use</i>
          </h2>
          <p className="lead" data-reveal="up" data-delay="0.1">
            VoidVisuals is a small creative web studio. We design and hand-code websites for
            businesses, creators and personal brands — the same team that sketches the layout writes
            the code and answers your message at 11 PM.
          </p>
          <p className="lead" data-reveal="up" data-delay="0.2">
            No account managers, no outsourced dev, no page builders. That is why a change you ask
            for today is usually live tomorrow.
          </p>

          <div className="grid grid-2" style={{ marginTop: 34 }}>
            <div className="card" data-reveal="up">
              <span className="ico">
                <Lock size={20} />
              </span>
              <h3>You own everything</h3>
              <p>
                Domain, code, content and hosting access are handed over at launch. The care plan is
                optional, never a condition.
              </p>
            </div>
            <div className="card" data-reveal="up" data-delay="0.08">
              <span className="ico">
                <Eye size={20} />
              </span>
              <h3>Fixed price, visible work</h3>
              <p>
                You see the real page design before a line of production code, and the price never
                moves after you approve it.
              </p>
            </div>
          </div>
        </div>

        <aside className="stack">
          <div className="glass-card" data-parallax="-5">
            <span className="eyebrow">Founder note</span>
            <p
              style={{
                margin: '18px 0 0',
                fontSize: 20,
                lineHeight: 1.5,
                letterSpacing: '-0.02em',
                fontWeight: 600,
              }}
            >
              “{config.founderQuote}”
            </p>
            <div className="by" style={{ marginTop: 20 }}>
              <span className="avatar">{(config.founderName || 'V').trim().charAt(0).toUpperCase()}</span>
              <span>
                <b>{config.founderName}</b>
                <span>{config.studioLine}</span>
              </span>
            </div>
          </div>

          <div className="card" data-reveal="right">
            <span className="ico">
              <Users size={20} />
            </span>
            <h3>Facts, not adjectives</h3>
            <ul className="bullets">
              {SITE_FACTS.map((fact) => (
                <li key={fact}>
                  <ArrowRight size={14} />
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <h3 className="sub-head" data-reveal="up">
        The team
      </h3>
      <div className="team-grid">
        {TEAM.map((member, i) => (
          <div className="card member" key={member.id} data-reveal="up" data-delay={`${0.06 * i}`}>
            <div className="pic">{member.initials}</div>
            <h3>{member.name}</h3>
            <span className="role">{member.role}</span>
            <p>{member.bio}</p>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 36 }}>
        <a
          className="btn btn-primary"
          href="/contact"
          onClick={(e) => {
            e.preventDefault();
            navigate('/contact');
          }}
        >
          Work with us
          <ArrowRight size={16} className="arrow" />
        </a>
        <a
          className="btn btn-ghost"
          href="/work"
          onClick={(e) => {
            e.preventDefault();
            navigate('/work');
          }}
        >
          See what we have built
        </a>
      </div>
    </div>
  </section>
);
