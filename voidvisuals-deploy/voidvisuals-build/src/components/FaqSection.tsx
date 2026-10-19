import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { FAQ } from '../data/vvData';

export const FaqSection: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="section" id="faq" style={compact ? { paddingTop: 60 } : undefined}>
      <div className="shell">
        <div className="section-head">
          <span className="eyebrow">Straight answers</span>
          <h2 className="display">
            <span data-split>Questions we get</span> <i>every week</i>
          </h2>
        </div>

        <div className="faq">
          {FAQ.map((item, i) => (
            <div className={`faq-item ${open === i ? 'is-open' : ''}`} key={item.q}>
              <button
                type="button"
                className="faq-q"
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
              >
                {item.q}
                <span className="pm">
                  <Plus size={16} />
                </span>
              </button>
              <div className="faq-a">
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="tagline" style={{ marginTop: 24 }}>
          anything else? the studio chat at the bottom right answers in your language, any hour
        </p>
      </div>
    </section>
  );
};
