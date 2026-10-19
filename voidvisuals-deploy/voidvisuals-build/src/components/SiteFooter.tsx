import React from 'react';
import { ArrowUpRight, AtSign, Mail, Phone, MessageCircle } from 'lucide-react';
import { SiteConfigData } from '../data/vvData';
import { useT } from '../lib/prefs';
import { LiveClock } from './LiveClock';
import { VVLogo } from './VVLogo';
import { BUILD_TAG } from '../version';

interface Props {
  config: SiteConfigData;
  signedIn: boolean;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export const SiteFooter: React.FC<Props> = ({ config, signedIn, onOpenAuth, onSignOut }) => {
  const t = useT();
  const year = new Date().getFullYear();
  return (
    <footer className="ftr">
      <div className="shell">
        <div className="ftr-top">
          <div style={{ maxWidth: 340 }}>
            <div className="brand">
              <span className="mark">
                <VVLogo />
              </span>
              <span>
                Void<em>Visuals</em>
              </span>
            </div>
            <p className="lead" style={{ fontSize: 15, marginTop: 16 }}>
              {config.studioLine}
            </p>
            <div className="row" style={{ marginTop: 18 }}>
              <LiveClock />
              <span className="chip">
                <span className="dot" />
                {config.statusNote || 'Open for new projects'}
              </span>
            </div>
          </div>

          <nav className="ftr-links" aria-label="Footer">
            <div className="ftr-col">
              <b>Studio</b>
              <a href="/studio">About us</a>
              <a href="/work">Selected work</a>
              <a href="/plans">Pricing</a>
              <a href="/contact">Start a project</a>
            </div>
            <div className="ftr-col">
              <b>Services</b>
              <a href="/studio">Website design</a>
              <a href="/studio">Development</a>
              <a href="/studio">Upgrades &amp; redesign</a>
              <a href="/plans">Care plan</a>
            </div>
            <div className="ftr-col">
              <b>Reach us</b>
              <a href={`mailto:${config.contactEmail}`}>
                <span className="row" style={{ gap: 7 }}>
                  <Mail size={14} /> {config.contactEmail}
                </span>
              </a>
              <a href={`tel:${config.contactPhone.replace(/\s/g, '')}`}>
                <span className="row" style={{ gap: 7 }}>
                  <Phone size={14} /> {config.contactPhone}
                </span>
              </a>
              <a href={config.whatsappUrl} target="_blank" rel="noreferrer noopener">
                <span className="row" style={{ gap: 7 }}>
                  <MessageCircle size={14} /> WhatsApp
                </span>
              </a>
              {config.instagramUrl ? (
                <a href={config.instagramUrl} target="_blank" rel="noreferrer noopener">
                  <span className="row" style={{ gap: 7 }}>
                    <AtSign size={14} /> Instagram
                  </span>
                </a>
              ) : null}
              <a href="/portal">
                <span className="row" style={{ gap: 7 }}>
                  <ArrowUpRight size={14} /> Track my project
                </span>
              </a>
            </div>
          </nav>
        </div>

        <div className="ftr-note">
          <span>
            © {year} {config.brandName} — {t('ftr.tagline')}
          </span>
          <span className="row" style={{ gap: 14 }}>
            <button type="button" className="linkish" onClick={signedIn ? onSignOut : onOpenAuth}>
              {signedIn ? 'Sign out' : 'Client sign in'}
            </button>
            <span>Times shown in IST (UTC+5:30)</span>
            <span title="Live build">{BUILD_TAG}</span>
          </span>
        </div>
      </div>
    </footer>
  );
};
