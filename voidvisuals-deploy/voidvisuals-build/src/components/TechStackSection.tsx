import React from 'react';
import { TECH_GROUPS, TECH_MARQUEE } from '../data/vvData';
import { useT } from '../lib/prefs';
import { Marquee } from './Marquee';

/**
 * What the studio builds with. Grouped chips plus the same scrolling strip used elsewhere on the
 * site, so the section inherits the reveal motion instead of needing its own animation code.
 */
export const TechStackSection: React.FC = () => {
  const t = useT();

  return (
    <section className="section" id="tech">
      <div className="shell">
        <div className="section-head">
          <span className="eyebrow">{t('tech.eyebrow')}</span>
          <h2 className="display">
            <span data-split>{t('tech.t1')}</span> <i>{t('tech.t2')}</i>
          </h2>
          <p className="lead" data-reveal="up" data-delay="0.15">
            {t('tech.lead')}
          </p>
        </div>

        <div className="tech-groups">
          {TECH_GROUPS.map((group, gi) => (
            <div className="tech-group" key={group.label} data-reveal="up" data-delay={`${0.08 * gi}`}>
              <div className="tech-label mono">{group.label}</div>
              <div className="tech-chips">
                {group.items.map((item) => (
                  <span className="tech-chip" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Marquee words={TECH_MARQUEE} />
    </section>
  );
};
