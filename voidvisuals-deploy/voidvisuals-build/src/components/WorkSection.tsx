import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, ExternalLink, X } from 'lucide-react';
import { WorkItem } from '../data/vvData';
import { navigate } from '../router';

const CATEGORY_LABEL: Record<WorkItem['category'], string> = {
  business: 'Business sites',
  creator: 'Creators',
  ecommerce: 'Stores',
  upgrade: 'Upgrades',
  landing: 'Landing pages',
};

interface Props {
  items: WorkItem[];
  limit?: number;
  eyebrow?: string;
  titlePlain?: string;
  titleAccent?: string;
  intro?: string;
}

export const WorkSection: React.FC<Props> = ({
  items,
  limit,
  eyebrow = 'Selected work',
  titlePlain = 'Recent builds,',
  titleAccent = 'not mockups',
  intro = 'Every project below shipped with a custom design system, motion and a speed pass. Sample boards are labelled until real launches replace them.',
}) => {
  const categories = useMemo(() => {
    const seen = new Set(items.map((w) => w.category));
    return (Object.keys(CATEGORY_LABEL) as WorkItem['category'][]).filter((c) => seen.has(c));
  }, [items]);

  const [filter, setFilter] = useState<'all' | WorkItem['category']>('all');
  const [open, setOpen] = useState<WorkItem | null>(null);

  // A new collection from Firestore can make the active filter impossible — fall back to all.
  useEffect(() => {
    if (filter !== 'all' && !categories.includes(filter)) setFilter('all');
  }, [categories, filter]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const visible = useMemo(() => {
    const pool = filter === 'all' ? items : items.filter((w) => w.category === filter);
    return limit ? pool.slice(0, limit) : pool;
  }, [items, filter, limit]);

  return (
    <section className="section" id="work">
      <div className="shell">
        <div className="section-head">
          <span className="eyebrow">{eyebrow}</span>
          <h2 className="display">
            <span data-split>{titlePlain}</span> <i>{titleAccent}</i>
          </h2>
          <p className="lead" data-reveal="up" data-delay="0.15">
            {intro}
          </p>
        </div>

        {categories.length > 1 ? (
          <div className="filters" data-reveal="up">
            <button
              type="button"
              className={`filter ${filter === 'all' ? 'is-on' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`filter ${filter === c ? 'is-on' : ''}`}
                onClick={() => setFilter(c)}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        ) : null}

        {visible.length === 0 ? (
          <div className="empty">No projects in this category yet — the studio is adding them.</div>
        ) : (
          <div className="work-grid">
            {visible.map((w, i) => (
              <article
                key={w.id}
                className="card work-card"
                style={{ animationDelay: `${0.05 * i}s` }}
                onClick={() => setOpen(w)}
              >
                <div className="work-cover">
                  <span
                    className="wash"
                    style={{
                      background: `radial-gradient(120% 90% at 18% 8%, ${w.accent}55, transparent 60%), linear-gradient(150deg, ${w.accent}2e, #05060f 70%)`,
                    }}
                  />
                  <span className="tag">{CATEGORY_LABEL[w.category]}</span>
                  {w.status === 'sample' ? <span className="badge-sample">Sample board</span> : null}
                  <span className="yr">{w.year}</span>
                </div>
                <div className="work-body">
                  <h3>{w.title}</h3>
                  <span className="who">{w.client || 'VoidVisuals build'}</span>
                  <p>{w.summary}</p>
                  <div className="work-tags">
                    {w.tags.slice(0, 4).map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {!limit ? null : (
          <div className="row" style={{ marginTop: 34 }}>
            <a
              className="btn btn-ghost"
              href="/work"
              onClick={(e) => {
                e.preventDefault();
                navigate('/work');
              }}
            >
              View all projects
              <ArrowUpRight size={16} className="arrow" />
            </a>
          </div>
        )}
      </div>

      {open ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={open.title} onClick={() => setOpen(null)}>
          <div className="glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">{CATEGORY_LABEL[open.category]}</span>
                <h3 style={{ margin: '8px 0 0' }}>{open.title}</h3>
              </div>
              <button type="button" className="x" aria-label="Close" onClick={() => setOpen(null)}>
                <X size={17} />
              </button>
            </div>

            <div
              className="work-cover"
              style={{ height: 168, borderRadius: 18, marginBottom: 18 }}
            >
              <span
                className="wash"
                style={{
                  background: `radial-gradient(120% 90% at 18% 8%, ${open.accent}66, transparent 60%), linear-gradient(150deg, ${open.accent}33, #05060f 70%)`,
                }}
              />
              <span className="tag">{open.client || 'VoidVisuals build'}</span>
              <span className="yr">{open.year}</span>
            </div>

            <p style={{ margin: 0, fontSize: 16.5, color: '#ffffffd9' }}>
              {open.detail || open.summary}
            </p>

            <ul className="bullets" style={{ marginTop: 16 }}>
              {open.tags.map((t) => (
                <li key={t}>
                  <Check size={14} />
                  {t}
                </li>
              ))}
            </ul>

            <div className="spread" style={{ marginTop: 22 }}>
              <div className="row">
                {open.url ? (
                  <a className="btn btn-primary btn-sm" href={open.url} target="_blank" rel="noreferrer noopener">
                    <ExternalLink size={15} />
                    Open site
                  </a>
                ) : (
                  <span className="tagline">
                    {open.status === 'sample' ? 'Concept board — not published' : 'Live client site, NDA held'}
                  </span>
                )}
              </div>
              <a
                className="btn btn-ghost btn-sm"
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(null);
                  navigate('/contact');
                }}
              >
                I want something like this
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
