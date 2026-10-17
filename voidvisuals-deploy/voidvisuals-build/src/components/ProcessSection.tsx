import React from 'react';
import { PROCESS } from '../data/vvData';
import { navigate } from '../router';

export const ProcessSection: React.FC = () => (
  <section className="section" id="process">
    <div className="shell">
      <div className="section-head">
        <span className="eyebrow">How a project runs</span>
        <h2 className="display">
          <span data-split>Five steps, no mystery,</span> <i>no ghosting</i>
        </h2>
        <p className="lead" data-reveal="up" data-delay="0.15">
          You always know what is happening today and what lands next. Every step has a real
          deliverable — not a status update.
        </p>
      </div>

      <div className="flow">
        {PROCESS.map((step, i) => (
          <div className="flow-step" key={step.id} data-reveal="left" data-delay={`${0.06 * i}`}>
            <span className="idx">{String(i + 1).padStart(2, '0')}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            <span className="days">{step.days}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-3" style={{ marginTop: 44 }}>
        <div className="card" data-reveal="up">
          <b className="hl" style={{ fontSize: 34, letterSpacing: "-0.03em" }}>
            <span data-count="14" data-suffix=" days">
              14 days
            </span>
          </b>
          <p>Typical Professional build, brief to launch.</p>
        </div>
        <div className="card" data-reveal="up" data-delay="0.1">
          <b className="hl" style={{ fontSize: 34, letterSpacing: "-0.03em" }}>
            <span data-count="90" data-suffix="+">
              90+
            </span>
          </b>
          <p>Lighthouse performance score we hand over on every site.</p>
        </div>
        <div className="card" data-reveal="up" data-delay="0.2">
          <b className="hl" style={{ fontSize: 34, letterSpacing: "-0.03em" }}>
            <span data-count="24" data-suffix="h">
              24h
            </span>
          </b>
          <p>Maximum reply time on WhatsApp, email or studio chat.</p>
        </div>
      </div>

      <div className="row" style={{ marginTop: 34 }}>
        <a
          className="btn btn-primary"
          href="/contact"
          onClick={(e) => {
            e.preventDefault();
            navigate('/contact');
          }}
        >
          Book step one — the brief
        </a>
      </div>
    </div>
  </section>
);
