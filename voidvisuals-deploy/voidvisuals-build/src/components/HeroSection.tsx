import React from 'react';
import { ArrowRight, Check, MessageCircle, Rocket, Zap } from 'lucide-react';
import { SiteConfigData } from '../data/vvData';
import { navigate } from '../router';
import { useMagnetic } from './Tilt';

interface Props {
  config: SiteConfigData;
}

const go = (e: React.MouseEvent, href: string) => {
  e.preventDefault();
  navigate(href);
};

export const HeroSection: React.FC<Props> = ({ config }) => {
  const ctaRef = useMagnetic<HTMLAnchorElement>(9);

  return (
    <section className="hero" id="top">
      <div className="shell">
        <div className="hero-grid">
          <div>
            <span className="chip" data-reveal="down">
              <span className="dot" />
              {config.statusNote || 'Taking new projects'}
            </span>

            <h1>
              <span data-split style={{ display: 'block' }}>
                {config.heroTitle}
              </span>
              <i data-reveal="blur" data-delay="0.45">
                Built to be remembered.
              </i>
            </h1>

            <p className="lead" data-reveal="up" data-delay="0.2">
              {config.heroSubtitle}
            </p>

            <div className="hero-cta" data-reveal="up" data-delay="0.32">
              <a ref={ctaRef} className="btn btn-primary" href="/contact" onClick={(e) => go(e, '/contact')}>
                Start a project
                <ArrowRight size={17} className="arrow" />
              </a>
              <a className="btn btn-ghost" href="/work" onClick={(e) => go(e, '/work')}>
                See the work
              </a>
              <a className="btn btn-ghost" href={config.whatsappUrl} target="_blank" rel="noreferrer noopener">
                <MessageCircle size={16} />
                WhatsApp us
              </a>
            </div>

            <div className="hero-mini" data-reveal="up" data-delay="0.44">
              <div>
                <b>
                  <span data-count="48" data-suffix="h">
                    48h
                  </span>
                </b>
                <span>landing page turnaround</span>
              </div>
              <div>
                <b>
                  <span data-count="5" data-suffix=" days">
                    5 days
                  </span>
                </b>
                <span>fastest full website</span>
              </div>
              <div>
                <b>
                  <span data-count="0" data-suffix="">
                    0
                  </span>
                </b>
                <span>template page builders</span>
              </div>
            </div>

            <div className="scroll-cue">
              <span className="line" />
              scroll to explore
            </div>
          </div>

          <div className="hero-art">
            <span className="orb" />
            <div className="glass-card browser" data-reveal="scale" data-delay="0.2">
              <div className="browser-bar">
                <s />
                <s />
                <s />
                <u>yourbrand.com</u>
              </div>
              <div className="browser-body">
                <div className="skel h34 w70" />
                <div className="skel" />
                <div className="skel w45" />
                <div className="skel h72" />
                <div className="skel w70" />
                <div className="skel w45" />
              </div>
            </div>

            <div className="float-card fc-1">
              <span className="fi">
                <Zap size={17} />
              </span>
              <span>
                <strong>0.6s first load</strong>
                <small>edge hosted, globally</small>
              </span>
            </div>
            <div className="float-card fc-2">
              <span className="fi">
                <Check size={17} />
              </span>
              <span>
                <strong>Yours, fully</strong>
                <small>domain + code handed over</small>
              </span>
            </div>
            <div className="float-card fc-3">
              <span className="fi">
                <Rocket size={17} />
              </span>
              <span>
                <strong>Live in days</strong>
                <small>not months</small>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
