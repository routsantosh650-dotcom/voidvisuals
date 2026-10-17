/**
 * Every piece of copy, price and default content for the VoidVisuals site.
 *
 * Firestore overrides anything the admin edits (plans, work, testimonials, siteConfig), so this
 * file is the "first deploy" state: the site is complete and saleable before a single document
 * exists in the database.
 */

export type PlanCategory = 'website' | 'addon' | 'care';

export interface PlanDoc {
  id: string;
  name: string;
  tagline: string;
  category: PlanCategory;
  priceInr: number;
  oldPriceInr: number;
  periodLabel: string;
  features: string[];
  badge: string;
  popular: boolean;
  sortOrder: number;
  active: boolean;
}

export interface WorkItem {
  id: string;
  title: string;
  client: string;
  category: 'business' | 'creator' | 'ecommerce' | 'upgrade' | 'landing';
  summary: string;
  detail: string;
  tags: string[];
  year: number;
  url: string;
  accent: string;
  featured: boolean;
  /** 'sample' items are clearly marked until the studio replaces them with real launches. */
  status: 'live' | 'sample';
  sortOrder: number;
}

export interface Testimonial {
  id: string;
  author: string;
  role: string;
  text: string;
  rating: number;
  approved: boolean;
  sortOrder: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  initials: string;
}

export interface ServiceItem {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  bullets: string[];
}

export interface SiteConfigData {
  brandName: string;
  heroTitle: string;
  heroSubtitle: string;
  studioLine: string;
  contactEmail: string;
  contactPhone: string;
  whatsappUrl: string;
  instagramUrl: string;
  behanceUrl: string;
  founderName: string;
  founderQuote: string;
  statusNote: string;
  discountOffer: string;
  discountEndsAt: number;
}

export interface Coupon {
  code: string;
  discountPercent: number;
}

// ---------------------------------------------------------------------------
// Plans — the three tiers from the previous site, plus the upgrade/add-on menu
// that used to be "discussed separately". Prices are the studio's own.
// ---------------------------------------------------------------------------
export const DEFAULT_PLANS: PlanDoc[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Personal sites, small projects and new businesses.',
    category: 'website',
    priceInr: 2500,
    oldPriceInr: 0,
    periodLabel: 'one-time build',
    features: [
      '1–3 page website',
      'Mobile + desktop responsive',
      'Custom modern UI',
      'Scroll and hover animations',
      'WhatsApp / call button',
      'Basic SEO setup',
      'Social media links',
      'Free domain — first year',
      'Delivered in 5–7 days',
    ],
    badge: '',
    popular: false,
    sortOrder: 1,
    active: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'Growing businesses, creators and portfolios.',
    category: 'website',
    priceInr: 5000,
    oldPriceInr: 0,
    periodLabel: 'one-time build',
    features: [
      'Everything in Starter',
      '5–7 pages',
      'Premium UI/UX system',
      'Advanced animations + interactive sections',
      'Working contact / enquiry form',
      'Google Maps embed',
      'Advanced SEO + Open Graph',
      'Free domain — first year',
      'Free hosting — first year',
      '2 revision rounds',
      'Delivered in 10–14 days',
    ],
    badge: 'MOST POPULAR',
    popular: true,
    sortOrder: 2,
    active: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'A complete digital experience for serious brands.',
    category: 'website',
    priceInr: 8000,
    oldPriceInr: 0,
    periodLabel: 'one-time build',
    features: [
      'Everything in Professional',
      '8–12 pages',
      'Fully custom design language',
      '3D-style and scroll-story effects',
      'Basic CMS (blog, products, pages)',
      'Performance + Core Web Vitals tuning',
      'Advanced SEO + analytics',
      'Free domain — first year',
      'Free hosting — first year',
      '4 revision rounds',
      'Priority support',
    ],
    badge: '',
    popular: false,
    sortOrder: 3,
    active: true,
  },
  {
    id: 'addon_extra_page',
    name: 'Extra page',
    tagline: 'Add a page to a site already live.',
    category: 'addon',
    priceInr: 700,
    oldPriceInr: 0,
    periodLabel: 'per page',
    features: ['Matches your existing design', 'Responsive + animated', 'SEO metadata included'],
    badge: '',
    popular: false,
    sortOrder: 11,
    active: true,
  },
  {
    id: 'addon_animation_pack',
    name: 'Animation pack',
    tagline: 'Motion pass over an existing website.',
    category: 'addon',
    priceInr: 1500,
    oldPriceInr: 0,
    periodLabel: 'one-time',
    features: ['Scroll reveals + transitions', 'Hero and section motion', 'Reduced-motion safe'],
    badge: '',
    popular: false,
    sortOrder: 12,
    active: true,
  },
  {
    id: 'addon_seo_boost',
    name: 'SEO & speed tune-up',
    tagline: 'Rank better, load faster.',
    category: 'addon',
    priceInr: 1200,
    oldPriceInr: 0,
    periodLabel: 'one-time',
    features: ['Meta + structured data', 'Image and script weight cut', 'Core Web Vitals report'],
    badge: '',
    popular: false,
    sortOrder: 13,
    active: true,
  },
  {
    id: 'addon_redesign',
    name: 'Website upgrade / redesign',
    tagline: 'Your old site, rebuilt on a modern stack.',
    category: 'addon',
    priceInr: 3000,
    oldPriceInr: 0,
    periodLabel: 'starting at',
    features: ['Full content migration', 'New design system', 'No downtime switch-over'],
    badge: 'UPGRADE',
    popular: false,
    sortOrder: 14,
    active: true,
  },
  {
    id: 'care_monthly',
    name: 'Care plan',
    tagline: 'Editing, hosting and peace of mind.',
    category: 'care',
    priceInr: 499,
    oldPriceInr: 0,
    periodLabel: 'per month',
    features: ['4 content edits a month', 'Hosting + domain kept live', 'Monthly backup + security check', 'Small feature tweaks'],
    badge: '',
    popular: false,
    sortOrder: 21,
    active: true,
  },
];

// ---------------------------------------------------------------------------
// Services, process, team, FAQ
// ---------------------------------------------------------------------------
export const SERVICES: ServiceItem[] = [
  {
    id: 'design',
    icon: 'PenTool',
    title: 'Website Design',
    blurb: 'Clean, modern interfaces designed around your brand and what you actually sell.',
    bullets: ['Custom design system', 'Mobile-first layouts', 'Two revision rounds'],
  },
  {
    id: 'development',
    icon: 'Code2',
    title: 'Development',
    blurb: 'Hand-written, responsive and scalable code — no bloated page builders.',
    bullets: ['Fast static + edge hosting', 'Forms and CMS', 'Secure by default'],
  },
  {
    id: 'motion',
    icon: 'Sparkles',
    title: 'Animations & UI',
    blurb: 'Scroll reveals, hover physics and transitions that make a site feel alive.',
    bullets: ['GSAP scroll motion', 'Reduced-motion safe', '60fps targets'],
  },
  {
    id: 'growth',
    icon: 'TrendingUp',
    title: 'SEO & Performance',
    blurb: 'Metadata, structured data, image weight and Core Web Vitals handled.',
    bullets: ['Google-ready markup', 'Speed tuning', 'Analytics setup'],
  },
  {
    id: 'upgrade',
    icon: 'RefreshCw',
    title: 'Future Upgrades',
    blurb: 'Add pages, features and sections whenever your project grows — no rebuild.',
    bullets: ['Content edits', 'New sections', 'Redesign of an old site'],
  },
  {
    id: 'support',
    icon: 'Headphones',
    title: 'Direct Support',
    blurb: 'Talk to the people who built it, any time your website needs attention.',
    bullets: ['24/7 studio chat', 'WhatsApp or email', 'Same-day replies'],
  },
];

export const PROCESS: { id: string; title: string; text: string; days: string }[] = [
  { id: 'brief', title: 'Brief', text: 'You tell us the goal, the audience and anything you already have.', days: 'Day 0' },
  { id: 'design', title: 'Design', text: 'We send a real page design, not a template mockup. You react, we refine.', days: 'Day 1–3' },
  { id: 'build', title: 'Build', text: 'Responsive code, animations, forms, SEO metadata and speed pass.', days: 'Day 4–10' },
  { id: 'launch', title: 'Launch', text: 'Domain connected, hosted on the edge, and handed over with login access.', days: 'Day 10–14' },
  { id: 'grow', title: 'Grow', text: 'Upgrades, edits and new pages whenever your business needs them.', days: 'Ongoing' },
];

export const TEAM: TeamMember[] = [
  { id: 'ansh', name: 'Ansh', role: 'Founder / Web Developer', bio: 'Turns ideas into functional, memorable digital experiences.', initials: 'A' },
  { id: 'santosh', name: 'Santosh', role: 'UI/UX Designer', bio: 'Designs clean interfaces with attention to every detail.', initials: 'S' },
  { id: 'sayak', name: 'Sayak', role: 'Frontend Developer', bio: 'Builds the responsive, animated front of every project.', initials: 'Sa' },
  { id: 'sachin', name: 'Sachin', role: 'Creative / Content', bio: 'Brings visuals, words and brand voice together.', initials: 'Sc' },
];

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is the domain really free?',
    a: 'Yes — the domain is free for the first year on every plan, and hosting is free for the first year on Professional and Premium. Renewal after the first year is charged at the registrar price, which we tell you before it happens.',
  },
  {
    q: 'Can I upgrade my website later?',
    a: 'That is the whole point. Add pages, animations, a blog, a store or a booking section any time — the site grows in place, you never pay for a rebuild.',
  },
  {
    q: 'How long does a website take?',
    a: 'Starter usually lands in 5–7 days, Professional in 10–14, Premium in about 3 weeks depending on how fast content and approvals come back.',
  },
  {
    q: 'Do you also fix or redesign an existing website?',
    a: 'Yes. The upgrade service rebuilds your current site on a modern stack with the same content and URLs, so search rankings and traffic are not lost.',
  },
  {
    q: 'Who owns the website and the code?',
    a: 'You do — domain, code, content and hosting account access are handed over. There is no lock-in; the care plan is optional.',
  },
  {
    q: 'What do you need from me to start?',
    a: 'Your logo (if you have one), the text or a rough idea of each page, and any photos. If you have nothing yet, we draft the structure with you on a call.',
  },
];

/** Plain statements used on the studio page — every one of these is a promise we can keep. */
export const SITE_FACTS: string[] = [
  'Hand-coded React + CSS, no WordPress, no Wix, no page builder',
  'Global edge hosting — the site loads fast in India and abroad',
  'Design draft sent before any production code is written',
  'Fixed price after the brief, no surprise invoices later',
  'Domain, code and hosting access handed over to you at launch',
  'Upgrades, new pages and edits available any time after launch',
];

export const MARQUEE_WORDS = [  'Custom design',
  'Responsive',
  'GSAP motion',
  'SEO ready',
  'Edge hosting',
  'Free domain year 1',
  'Upgrade anytime',
  'Hand-coded',
];

// Sample work entries so the portfolio is never empty on day one. Replace them in the admin
// console as real launches land; anything with status "sample" shows a small SAMPLE badge.
export const DEFAULT_WORK: WorkItem[] = [
  {
    id: 'sample-cafe',
    title: 'Aurelia Bakery',
    client: 'Local bakery chain',
    category: 'business',
    summary: 'Order-ahead site with menu, gallery and WhatsApp checkout.',
    detail: 'Three pages, a menu that updates itself, and an order button that opens WhatsApp pre-filled.',
    tags: ['Business site', 'Menu', 'WhatsApp'],
    year: 2026,
    url: '',
    accent: '#F0A6CA',
    featured: true,
    status: 'sample',
    sortOrder: 1,
  },
  {
    id: 'sample-gym',
    title: 'Northline Fitness',
    client: 'Gym & trainers',
    category: 'business',
    summary: 'Plans, trainer profiles and a booking form in one scroll.',
    detail: 'Section-per-plan layout with motion, an enquiry form and Google Maps embed.',
    tags: ['5 pages', 'Booking form', 'Maps'],
    year: 2026,
    url: '',
    accent: '#4FE8FF',
    featured: true,
    status: 'sample',
    sortOrder: 2,
  },
  {
    id: 'sample-creator',
    title: 'Ruhaan Sethi',
    client: 'Music creator',
    category: 'creator',
    summary: 'Portfolio drop with releases, tour dates and press links.',
    detail: 'Dark, motion-heavy single page built for link-in-bio traffic and Instagram.',
    tags: ['Portfolio', 'Motion', 'Link hub'],
    year: 2025,
    url: '',
    accent: '#A99BFF',
    featured: true,
    status: 'sample',
    sortOrder: 3,
  },
  {
    id: 'sample-store',
    title: 'Kala Cotton Co.',
    client: 'Handloom store',
    category: 'ecommerce',
    summary: 'Catalogue store with product pages and enquiry cart.',
    detail: 'Lightweight catalogue, no monthly platform fee, orders arrive as email + WhatsApp.',
    tags: ['Catalogue', 'CMS', 'Enquiry cart'],
    year: 2025,
    url: '',
    accent: '#FFB35C',
    featured: false,
    status: 'sample',
    sortOrder: 4,
  },
  {
    id: 'sample-upgrade',
    title: 'Vidya Coaching',
    client: 'Tuition centre',
    category: 'upgrade',
    summary: 'Old WordPress site rebuilt as a fast static site.',
    detail: 'Same URLs, same content, 3.2s load cut to 0.6s, rankings kept intact.',
    tags: ['Redesign', 'Speed', 'SEO kept'],
    year: 2026,
    url: '',
    accent: '#7CFFB2',
    featured: false,
    status: 'sample',
    sortOrder: 5,
  },
  {
    id: 'sample-landing',
    title: 'Zenstay Retreats',
    client: 'Boutique stays',
    category: 'landing',
    summary: 'Campaign landing page for a monsoon offer.',
    detail: 'One scroll, one offer, one button — built in 48 hours with A/B ready copy blocks.',
    tags: ['Landing page', 'Campaign', '48 hours'],
    year: 2025,
    url: '',
    accent: '#FF7BD5',
    featured: false,
    status: 'sample',
    sortOrder: 6,
  },
];

export const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: 't-1',
    author: 'Rohit M.',
    role: 'Café owner, Pune',
    text: 'They rebuilt our whole online presence in two weeks. The site loads instantly and customers finally find the menu without calling us.',
    rating: 5,
    approved: true,
    sortOrder: 1,
  },
  {
    id: 't-2',
    author: 'Ananya K.',
    role: 'Freelance designer',
    text: 'My portfolio looked like everyone else’s. Now it looks like me — and the animations never get in the way of the work.',
    rating: 5,
    approved: true,
    sortOrder: 2,
  },
  {
    id: 't-3',
    author: 'Imran S.',
    role: 'Gym owner, Kolkata',
    text: 'Enquiries went up in the first month. What I like is that when I need a change, I message them and it is done the same day.',
    rating: 5,
    approved: true,
    sortOrder: 3,
  },
];

export const DEFAULT_COUPONS: Coupon[] = [
  { code: 'VOID10', discountPercent: 10 },
  { code: 'LAUNCH15', discountPercent: 15 },
  { code: 'UPGRADE20', discountPercent: 20 },
];

export const DEFAULT_SITE_CONFIG: SiteConfigData = {
  brandName: 'VoidVisuals',
  heroTitle: 'Websites that feel alive.',
  heroSubtitle:
    'We design and build modern, fast, hand-made websites for businesses, creators and personal brands — then keep upgrading them as you grow.',
  studioLine: 'Creative web studio · India · remote worldwide',
  contactEmail: 'voidvisuals999@gmail.com',
  contactPhone: '+91 89203 68725',
  whatsappUrl: 'https://wa.me/918920368725',
  instagramUrl: 'https://instagram.com/voidvisuals',
  behanceUrl: '',
  founderName: 'Ansh · Founder',
  founderQuote:
    'A website is not a brochure. It is the first ten seconds of your business — so we make those ten seconds count.',
  statusNote: 'Currently taking new projects for this month',
  discountOffer: '',
  discountEndsAt: 0,
};

/**
 * The single writer for /siteConfig/main. Keys and size limits here must match the
 * isValidSiteConfig() rules in firestore.rules — a key the rules do not know about makes the
 * whole save fail, so both lists are maintained together on purpose.
 */
export function siteConfigFields(cfg: SiteConfigData): Record<string, string | number> {
  return {
    brandName: cfg.brandName.slice(0, 60),
    heroTitle: cfg.heroTitle.slice(0, 120),
    heroSubtitle: cfg.heroSubtitle.slice(0, 300),
    studioLine: cfg.studioLine.slice(0, 120),
    contactEmail: cfg.contactEmail.slice(0, 120),
    contactPhone: cfg.contactPhone.slice(0, 40),
    whatsappUrl: cfg.whatsappUrl.slice(0, 200),
    instagramUrl: cfg.instagramUrl.slice(0, 200),
    behanceUrl: cfg.behanceUrl.slice(0, 200),
    founderName: cfg.founderName.slice(0, 80),
    founderQuote: cfg.founderQuote.slice(0, 400),
    statusNote: cfg.statusNote.slice(0, 120),
    discountOffer: cfg.discountOffer.slice(0, 240),
    discountEndsAt: Number.isFinite(cfg.discountEndsAt) && cfg.discountEndsAt > 0 ? Math.floor(cfg.discountEndsAt) : 0,
  };
}

export const SITE_CONFIG_KEYS = Object.keys(siteConfigFields(DEFAULT_SITE_CONFIG));

/** ₹1,234 — the currency style used everywhere on the site. */
export const inr = (paiseFree: number) => `₹${Math.round(paiseFree).toLocaleString('en-IN')}`;
