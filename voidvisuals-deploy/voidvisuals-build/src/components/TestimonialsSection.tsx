import React, { useEffect, useState } from 'react';
import { Quote, Star } from 'lucide-react';
import { Testimonial } from '../data/vvData';
import { prefersReducedMotion } from '../lib/motion';

export const TestimonialsSection: React.FC<{ items: Testimonial[] }> = ({ items }) => {
  const [index, setIndex] = useState(0);
  const count = items.length;

  useEffect(() => {
    if (count < 2 || prefersReducedMotion()) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 6500);
    return () => clearInterval(id);
  }, [count]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (!count) return null;
  const active = items[Math.min(index, count - 1)];

  return (
    <section className="section" id="clients">
      <div className="shell">
        <div className="section-head center">
          <span className="eyebrow">Client words</span>
          <h2 className="display">
            <span data-split>What people say</span> <i>after launch</i>
          </h2>
        </div>

        <div className="glass-card quotes" data-reveal="scale">
          {items.map((t, i) => (
            <figure className={`quote ${i === index ? 'is-on' : ''}`} key={t.id} style={{ margin: 0 }}>
              <span className="mark">
                <Quote size={34} />
              </span>
              <blockquote>{t.text}</blockquote>
              <figcaption className="by">
                <span className="avatar">{(t.author || 'V').trim().charAt(0).toUpperCase()}</span>
                <span>
                  <b>{t.author}</b>
                  <span>{t.role}</span>
                </span>
                <span className="stars" aria-label={`${t.rating} out of 5`}>
                  {Array.from({ length: 5 }, (_, s) => (
                    <Star key={s} size={14} fill={s < t.rating ? 'currentColor' : 'none'} />
                  ))}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        {count > 1 ? (
          <div className="dots" role="tablist" aria-label="Choose a testimonial">
            {items.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${t.author} — ${t.role}`}
                className={i === index ? 'is-on' : ''}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        ) : null}

        <p className="tagline center" style={{ marginTop: 18 }}>
          Showing {active.author} · reviews are collected after delivery and published with permission
        </p>
      </div>
    </section>
  );
};
