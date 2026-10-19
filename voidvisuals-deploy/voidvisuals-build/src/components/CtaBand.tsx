import React from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { SiteConfigData } from '../data/vvData';
import { navigate } from '../router';

export const CtaBand: React.FC<{ config: SiteConfigData }> = ({ config }) => (
  <section className="section" style={{ paddingTop: 0 }}>
    <div className="shell">
      <div className="band" data-reveal="scale">
        <div>
          <span className="eyebrow">Next slot open</span>
          <h2>Let us build the website your business deserves.</h2>
          <p>
            Send a two-line brief and you will get a real plan, a fixed price and a start date — not
            a sales call.
          </p>
        </div>
        <div className="row">
          <a
            className="btn btn-primary"
            href="/contact"
            onClick={(e) => {
              e.preventDefault();
              navigate('/contact');
            }}
          >
            Start a project
            <ArrowRight size={17} className="arrow" />
          </a>
          <a className="btn btn-ghost" href={config.whatsappUrl} target="_blank" rel="noreferrer noopener">
            <MessageCircle size={16} />
            Chat on WhatsApp
          </a>
        </div>
      </div>
    </div>
  </section>
);
