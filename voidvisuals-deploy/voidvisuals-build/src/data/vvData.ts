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
  /** Optional project screenshot; without it the card paints an accent-coloured wash. */
  cover?: string;
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

/**
 * Payments go straight to the studio's own UPI — no gateway, no monthly fee, no extra
 * commission on top of what the bank already charges. The QR encodes a standard UPI intent.
 */
export const UPI = {
  vpa: '8920368725@fam',
  payee: 'Santosh',
  /** Shown next to the QR so the payer can confirm the name before scanning. */
  verifyLine: 'Name on the UPI app should read "Santosh" before you pay.',
};

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
  { id: 'ansh', name: 'ANSH', role: 'Founder', bio: 'Sets the direction — every project starts and ends with him.', initials: 'A' },
  { id: 'santosh', name: 'Santosh Rout', role: 'Developer Co-Founder · Senior Developer', bio: 'Builds the front end, the motion and the systems behind every site.', initials: 'SR' },
  { id: 'sylux', name: 'MNG | SYLUX', role: 'Manager', bio: 'Runs delivery, timelines and client communication.', initials: 'SY' },
  { id: 'emperor', name: 'MNG | EMPEROR', role: 'Jr. Manager', bio: 'Keeps day-to-day work moving and follow-ups closed.', initials: 'EM' },
  { id: 'sam', name: 'sam', role: 'Outreach', bio: 'Finds the businesses that need a better website.', initials: 'SA' },
  { id: 'nainsafi', name: 'NaInsafi', role: 'Outreach', bio: 'Reaches creators and communities on social platforms.', initials: 'NI' },
  { id: 'om', name: 'Om Krishna Bhandari', role: 'Outreach', bio: 'Handles first contact and books the brief call.', initials: 'OK' },
  { id: 'ankush', name: 'ANKUSH YADAV', role: 'Outreach', bio: 'Works the DMs, groups and referral chain.', initials: 'AY' },
  { id: 'darkframe', name: 'DarkFrame', role: 'Social Handler', bio: 'Runs the studio presence across social channels.', initials: 'DF' },
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

export const MARQUEE_WORDS = [
  'Custom design',
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
// The five builds actually shipped and live right now. Cover images sit in /public/img so the
// admin can swap them without touching code.
export const DEFAULT_WORK: WorkItem[] = [
  {
    id: 'areex-cloud',
    title: 'Areex Cloud',
    client: 'Indian game-hosting platform',
    category: 'business',
    summary: 'Minecraft, VPS and bot hosting with live network map, plans and one-click deploy flow.',
    detail: 'Front end for the whole platform: plan matrix with INR/USD pricing, global latency map, support chat and a checkout that hands off to the payment gateway.',
    tags: ['Hosting platform', 'Network map', 'Multi-currency'],
    year: 2026,
    url: 'https://www.areexcloud.site/',
    accent: '#ff7a18',
    cover: '/img/work-areex.jpg',
    featured: true,
    status: 'live',
    sortOrder: 1,
  },
  {
    id: 'voidmc-network',
    title: 'VoidMC',
    client: 'Minecraft server network',
    category: 'creator',
    summary: 'Official site for the VoidMC community — server story, rules, staff and join flow.',
    detail: 'Dark, motion-heavy single brand page built to convert Discord traffic into players, with a live join IP and IP-copy affordance.',
    tags: ['Community site', 'Motion', 'Discord'],
    year: 2026,
    url: 'https://voidmc-website.onrender.com/',
    accent: '#ffb43d',
    cover: '/img/work-voidmc.jpg',
    featured: true,
    status: 'live',
    sortOrder: 2,
  },
  {
    id: 'voidmc-staff',
    title: 'VoidMC SMP — Staff Control Centre',
    client: 'VoidMC SMP',
    category: 'business',
    summary: 'Staff commands, live attendance, strike discipline, alerts and directory in one console.',
    detail: 'An internal operations platform: role-gated screens, real-time attendance board, discipline ledger and admin controls, all in one place for the staff team.',
    tags: ['Dashboard', 'Roles', 'Realtime'],
    year: 2026,
    url: 'https://voidmc-system.onrender.com/',
    accent: '#ff5a2e',
    cover: '/img/work-staff.jpg',
    featured: false,
    status: 'live',
    sortOrder: 3,
  },
  {
    id: 'educationist',
    title: 'The Educationist',
    client: 'Educational platform',
    category: 'business',
    summary: 'Learning platform built for students — resources, courses and a clean readable interface.',
    detail: 'Accessible layout that stays fast on cheap phones, structured so a student reaches a lesson in two taps and a teacher can add material without help.',
    tags: ['EdTech', 'Accessible', 'Fast on 3G'],
    year: 2026,
    url: 'https://theeeducationist7cr.pages.dev/',
    accent: '#ffd166',
    cover: '/img/work-educationist.jpg',
    featured: true,
    status: 'live',
    sortOrder: 4,
  },
  {
    id: 'notme-editz',
    title: 'Notme Editz',
    client: 'Web developer · content creator · video editor',
    category: 'creator',
    summary: 'Personal portfolio pulling code, edits and content into one place.',
    detail: 'A creator portfolio that behaves like a showreel: scroll motion, work grid by discipline, and a contact rail that goes straight to DMs.',
    tags: ['Portfolio', 'Showreel', 'Creator'],
    year: 2026,
    url: 'https://notme-1n0.pages.dev/',
    accent: '#ff8a3d',
    cover: '/img/work-notme.jpg',
    featured: false,
    status: 'live',
    sortOrder: 5,
  },
];

export const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: 't-areex',
    author: 'Areex Cloud',
    role: 'Founder',
    text: 'VoidVisuals made the official Areex Cloud website for us — he handled most of the front end. The websites are really well designed, and all the systems are easy to use and control. Everything works smoothly and we absolutely love the final result.',
    rating: 5,
    approved: true,
    sortOrder: 1,
  },
  {
    id: 't-voidmc',
    author: 'VOIDMC Team',
    role: 'Server network',
    text: 'VoidVisuals made two websites for us — the official VOIDMC website and the Staff Control Center. Both are really well designed, every system is easy to use and control, and everything works smoothly. We absolutely love the final result.',
    rating: 5,
    approved: true,
    sortOrder: 2,
  },
  {
    id: 't-educationist',
    author: 'Faiz',
    role: 'Founder, The Educationist',
    text: 'We came with a rough idea of what learning should feel like and got a platform that students actually use. The interface is clean, everything loads fast, and the systems are simple enough that our team runs it without calling for help.',
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

// ---------------------------------------------------------------------------
// Display currency. Every price is stored in INR (that is what the studio
// actually charges and what the admin console edits); the switcher only
// reformats what the visitor sees, exactly like Areex's currency bar. Rates are
// indicative — update the numbers here once in a while, nothing else to touch.
// ---------------------------------------------------------------------------

export type CurrencyCode =
  | 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SAR' | 'QAR' | 'KWD' | 'CAD' | 'AUD'
  | 'NZD' | 'SGD' | 'MYR' | 'CHF' | 'CNY' | 'JPY' | 'KRW' | 'THB' | 'ZAR' | 'TRY'
  | 'RUB' | 'BDT' | 'PKR' | 'LKR' | 'NPR' | 'IDR' | 'PHP' | 'VND' | 'BRL' | 'MXN';

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  name: string;
  /** How many units of this currency one Indian rupee buys. */
  rateFromInr: number;
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', rateFromInr: 1 },
  { code: 'USD', symbol: '$', name: 'US Dollar', rateFromInr: 0.012 },
  { code: 'EUR', symbol: '€', name: 'Euro', rateFromInr: 0.011 },
  { code: 'GBP', symbol: '£', name: 'British Pound', rateFromInr: 0.0095 },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', rateFromInr: 0.044 },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', rateFromInr: 0.045 },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal', rateFromInr: 0.044 },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', rateFromInr: 0.0037 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rateFromInr: 0.016 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rateFromInr: 0.018 },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', rateFromInr: 0.02 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', rateFromInr: 0.016 },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', rateFromInr: 0.051 },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', rateFromInr: 0.0106 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', rateFromInr: 0.086 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rateFromInr: 1.82 },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', rateFromInr: 16 },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', rateFromInr: 0.39 },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', rateFromInr: 0.0216 },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', rateFromInr: 0.49 },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', rateFromInr: 1.1 },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', rateFromInr: 1.32 },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', rateFromInr: 3.35 },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', rateFromInr: 3.6 },
  { code: 'NPR', symbol: 'Rs', name: 'Nepali Rupee', rateFromInr: 1.6 },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', rateFromInr: 195 },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', rateFromInr: 0.68 },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', rateFromInr: 290 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', rateFromInr: 0.065 },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', rateFromInr: 0.22 },
];

const CURRENCY_BY_CODE: Record<string, CurrencyMeta> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c])
);

export const currencyMeta = (code: CurrencyCode): CurrencyMeta =>
  CURRENCY_BY_CODE[code] || CURRENCY_BY_CODE.INR;

/** Same amount, shown in the visitor's chosen currency. */
export const price = (amountInr: number, code: CurrencyCode = 'INR'): string => {
  const meta = currencyMeta(code);
  if (meta.code === 'INR') return inr(amountInr);
  const value = amountInr * meta.rateFromInr;
  const digits = value >= 1000 ? 0 : value >= 100 ? 1 : 2;
  return `${meta.symbol}${value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
};

// ---------------------------------------------------------------------------
// What the studio builds with. Display only — the "Tech stack" section and the
// studio page both read this list.
// ---------------------------------------------------------------------------

export interface TechGroup {
  label: string;
  items: string[];
}

export const TECH_GROUPS: TechGroup[] = [
  {
    label: 'Languages',
    items: ['HTML5', 'CSS3', 'JavaScript', 'TypeScript', 'Python', 'C++', 'C', 'Java', 'PHP', 'Go', 'Rust', 'Kotlin', 'Swift', 'SQL'],
  },
  {
    label: 'Frontend',
    items: ['React', 'Next.js', 'Vite', 'Tailwind CSS', 'GSAP', 'Framer Motion', 'Three.js', 'Vue', 'Svelte', 'Redux', 'React Router'],
  },
  {
    label: 'Backend & data',
    items: ['Node.js', 'Express', 'Cloudflare Workers', 'Firebase', 'Firestore', 'Django', 'Flask', 'PostgreSQL', 'MongoDB', 'Redis', 'REST', 'GraphQL'],
  },
  {
    label: 'Tooling & delivery',
    items: ['Git', 'GitHub Actions', 'Docker', 'Nginx', 'Figma', 'VS Code', 'Vercel', 'Netlify', 'Cloudflare Pages', 'Lighthouse', 'Sentry'],
  },
];

/** Flat list, used by the scrolling strip. */
export const TECH_MARQUEE = TECH_GROUPS.flatMap((group) => group.items);
