/**
 * Storefront content, live from Firestore with the repo defaults underneath it.
 *
 * Reads are public (firestore.rules allows get/list on these collections); the admin console is
 * the only writer. If a collection is still empty the site renders DEFAULT_* from src/data/vvData,
 * so a brand-new deployment is never blank and a rules mistake is never fatal.
 */

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Coupon,
  DEFAULT_COUPONS,
  DEFAULT_PLANS,
  DEFAULT_SITE_CONFIG,
  DEFAULT_TESTIMONIALS,
  DEFAULT_WORK,
  PlanDoc,
  SiteConfigData,
  Testimonial,
  WorkItem,
} from '../data/vvData';

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((i) => typeof i === 'string').slice(0, 24) : [];

const PLAN_CATEGORIES = ['website', 'addon', 'care'];
const WORK_CATEGORIES = ['business', 'creator', 'ecommerce', 'upgrade', 'landing'];

export interface LiveContent {
  ready: boolean;
  config: SiteConfigData;
  plans: PlanDoc[];
  work: WorkItem[];
  testimonials: Testimonial[];
  coupons: Coupon[];
}

function mapPlan(id: string, d: Record<string, unknown>, index: number): PlanDoc {
  const category = str(d.category, 'website') as PlanDoc['category'];
  return {
    id,
    name: str(d.name, id),
    tagline: str(d.tagline),
    category: PLAN_CATEGORIES.includes(category) ? category : 'website',
    priceInr: Math.max(0, num(d.priceInr)),
    oldPriceInr: Math.max(0, num(d.oldPriceInr)),
    periodLabel: str(d.periodLabel, 'one-time build'),
    features: list(d.features),
    badge: str(d.badge).slice(0, 28),
    popular: bool(d.popular),
    sortOrder: num(d.sortOrder, index + 1),
    active: bool(d.active, true),
  };
}

function mapWork(id: string, d: Record<string, unknown>, index: number): WorkItem {
  const category = str(d.category, 'business') as WorkItem['category'];
  const status = str(d.status, 'live') === 'sample' ? 'sample' : 'live';
  return {
    id,
    title: str(d.title, id),
    client: str(d.client),
    category: WORK_CATEGORIES.includes(category) ? category : 'business',
    summary: str(d.summary),
    detail: str(d.detail),
    tags: list(d.tags),
    year: num(d.year, new Date().getFullYear()),
    url: str(d.url).slice(0, 200),
    accent: /^#[0-9a-fA-F]{6}$/.test(str(d.accent)) ? str(d.accent) : '#ff7a18',
    cover: str(d.cover).slice(0, 200),
    featured: bool(d.featured),
    status,
    sortOrder: num(d.sortOrder, index + 1),
  };
}

export function useLiveContent(): LiveContent {
  const [state, setState] = useState<LiveContent>({
    ready: false,
    config: DEFAULT_SITE_CONFIG,
    plans: DEFAULT_PLANS,
    work: DEFAULT_WORK,
    testimonials: DEFAULT_TESTIMONIALS,
    coupons: DEFAULT_COUPONS,
  });

  useEffect(() => {
    const unsub = [
      onSnapshot(doc(db, 'siteConfig', 'main'), (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() as Record<string, unknown>;
        setState((prev) => ({
          ...prev,
          ready: true,
          config: {
            brandName: str(d.brandName, prev.config.brandName).slice(0, 60),
            heroTitle: str(d.heroTitle, prev.config.heroTitle).slice(0, 120),
            heroSubtitle: str(d.heroSubtitle, prev.config.heroSubtitle).slice(0, 300),
            studioLine: str(d.studioLine, prev.config.studioLine).slice(0, 120),
            contactEmail: str(d.contactEmail, prev.config.contactEmail).slice(0, 120),
            contactPhone: str(d.contactPhone, prev.config.contactPhone).slice(0, 40),
            whatsappUrl: str(d.whatsappUrl, prev.config.whatsappUrl).slice(0, 200),
            instagramUrl: str(d.instagramUrl, prev.config.instagramUrl).slice(0, 200),
            behanceUrl: str(d.behanceUrl, prev.config.behanceUrl).slice(0, 200),
            founderName: str(d.founderName, prev.config.founderName).slice(0, 80),
            founderQuote: str(d.founderQuote, prev.config.founderQuote).slice(0, 400),
            statusNote: str(d.statusNote, prev.config.statusNote).slice(0, 120),
            discountOffer: str(d.discountOffer, prev.config.discountOffer).slice(0, 240),
            discountEndsAt: Math.max(0, num(d.discountEndsAt, prev.config.discountEndsAt)),
          },
        }));
      }),

      onSnapshot(collection(db, 'plans'), (snap) => {
        if (snap.empty) return;
        const plans = snap.docs
          .map((d, i) => mapPlan(d.id, d.data() as Record<string, unknown>, i))
          .filter((p) => p.active && p.priceInr > 0)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        if (plans.length) setState((prev) => ({ ...prev, ready: true, plans }));
      }),

      onSnapshot(collection(db, 'work'), (snap) => {
        if (snap.empty) return;
        const work = snap.docs
          .map((d, i) => mapWork(d.id, d.data() as Record<string, unknown>, i))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setState((prev) => ({ ...prev, ready: true, work }));
      }),

      onSnapshot(collection(db, 'testimonials'), (snap) => {
        if (snap.empty) return;
        const testimonials = snap.docs
          .map((d) => {
            const x = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              author: str(x.author, 'Client'),
              role: str(x.role).slice(0, 70),
              text: str(x.text).slice(0, 400),
              rating: Math.min(5, Math.max(1, num(x.rating, 5))),
              approved: bool(x.approved, true),
              sortOrder: num(x.sortOrder, 0),
            } satisfies Testimonial;
          })
          .filter((t) => t.approved && t.text.length > 8)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setState((prev) => ({ ...prev, ready: true, testimonials }));
      }),

      onSnapshot(collection(db, 'coupons'), (snap) => {
        if (snap.empty) return;
        const coupons = snap.docs
          .map((d) => {
            const x = d.data() as Record<string, unknown>;
            return { code: d.id.toUpperCase(), discountPercent: num(x.discountPercent, 0) } satisfies Coupon;
          })
          .filter((c) => c.discountPercent >= 1 && c.discountPercent <= 90);
        setState((prev) => ({ ...prev, ready: true, coupons }));
      }),
    ];
    return () => unsub.forEach((u) => u());
  }, []);

  return state;
}

/** Website tiers, in display order. */
export const websitesOf = (plans: PlanDoc[]) => plans.filter((p) => p.category === 'website');
export const addonsOf = (plans: PlanDoc[]) => plans.filter((p) => p.category === 'addon');
export const careOf = (plans: PlanDoc[]) => plans.filter((p) => p.category === 'care');
