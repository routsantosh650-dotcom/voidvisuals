interface Env {
  OTP_DO: DurableObjectNamespace;
  ASSETS: Fetcher;
  FIREBASE_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  FIRESTORE_DATABASE_ID: string;
  EMAILJS_SERVICE_ID: string;
  EMAILJS_TEMPLATE_ID: string;
  EMAILJS_PUBLIC_KEY: string;
  EMAILJS_PRIVATE_KEY: string;
  GEMINI_API_KEY: string;
}

// The only two accounts allowed to open the studio console. Enforced here and in
// firestore.rules; src/lib/adminGate.ts ships only their SHA-256 digests to the browser.
const ADMIN_EMAILS = ['voidvisuals999@gmail.com', 'routsantosh650@gmail.com'];

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const BRIEF_SERVICES = [
  'New website',
  'Website upgrade / redesign',
  'Landing page',
  'Online store',
  'Portfolio / personal site',
  'SEO & speed tune-up',
  'Something else',
];

const BRIEF_STATUSES = ['new', 'reviewing', 'quoted', 'in-progress', 'delivered', 'archived'];

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Baseline hardening for every response this Worker serves (no dashboard setup needed).
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

function withSecurityHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!out.headers.has(key)) out.headers.set(key, value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Durable Object: OTP records + fixed-window rate counters.
// SQLite-backed storage keeps them alive across object eviction.
// ---------------------------------------------------------------------------
type OtpRecord = { code: string; expires: number; attempts: number };
type RateRecord = { start: number; count: number };

export class OtpStore {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/rate' && req.method === 'POST') {
      const body = (await req.json()) as { max?: number; windowMs?: number };
      const max = body.max || 5;
      const windowMs = body.windowMs || 15 * 60 * 1000;
      const now = Date.now();
      const rec = (await this.state.storage.get<RateRecord>('rate')) || { start: now, count: 0 };
      if (now - rec.start > windowMs) {
        rec.start = now;
        rec.count = 0;
      }
      rec.count += 1;
      await this.state.storage.put('rate', rec);
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - rec.start)) / 1000));
      return json({ allowed: rec.count <= max, retryAfter });
    }

    if (url.pathname === '/set' && req.method === 'POST') {
      const body = (await req.json()) as { code?: string };
      const rec: OtpRecord = {
        code: body.code || '',
        expires: Date.now() + CODE_TTL_MS,
        attempts: 0,
      };
      await this.state.storage.put('rec', rec);
      return json({ ok: true });
    }

    if (url.pathname === '/check' && req.method === 'POST') {
      const body = (await req.json()) as { code?: string };
      const rec = (await this.state.storage.get<OtpRecord>('rec')) || null;
      let result = 'expired';
      if (rec) {
        if (Date.now() > rec.expires) {
          await this.state.storage.delete('rec');
        } else if (rec.attempts >= MAX_ATTEMPTS) {
          await this.state.storage.delete('rec');
          result = 'too-many';
        } else {
          rec.attempts += 1;
          result = rec.code === (body.code || '') ? 'ok' : 'wrong';
          if (result === 'ok') await this.state.storage.delete('rec');
          else await this.state.storage.put('rec', rec);
        }
      }
      return json({ result });
    }

    return new Response('not found', { status: 404 });
  }
}

// ---------------------------------------------------------------------------
// Firebase session helpers
// ---------------------------------------------------------------------------
type FirebaseSession = { uid: string; email: string; verified: boolean };

async function sessionFromIdToken(
  idToken: string,
  apiKey: string
): Promise<FirebaseSession | null> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
  };
  const user = data.users?.[0];
  if (!user?.localId || !user.email) return null;
  return {
    uid: user.localId,
    email: user.email.toLowerCase(),
    verified: user.emailVerified === true,
  };
}

async function emailFromIdToken(idToken: string, apiKey: string): Promise<string | null> {
  return (await sessionFromIdToken(idToken, apiKey))?.email ?? null;
}

async function sendCodeEmail(
  to: string,
  code: string,
  env: Env
): Promise<'ok' | 'not-configured' | 'failed'> {
  if (!env.EMAILJS_SERVICE_ID || !env.EMAILJS_TEMPLATE_ID || !env.EMAILJS_PUBLIC_KEY) {
    return 'not-configured';
  }
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: env.EMAILJS_SERVICE_ID,
      template_id: env.EMAILJS_TEMPLATE_ID,
      user_id: env.EMAILJS_PUBLIC_KEY,
      accessToken: env.EMAILJS_PRIVATE_KEY || undefined,
      template_params: { to_email: to, code, to_name: 'VoidVisuals Studio' },
    }),
  });
  return res.ok ? 'ok' : 'failed';
}

// ---------------------------------------------------------------------------
// Firestore REST write (briefs)
// ---------------------------------------------------------------------------
type FsField = Record<string, unknown>;

const s = (value: string): FsField => ({ stringValue: value });
const i = (value: number): FsField => ({ integerValue: String(Math.round(value)) });

function briefDocName(env: Env, id: string): string {
  return (
    `projects/${env.FIREBASE_PROJECT_ID}/databases/${env.FIRESTORE_DATABASE_ID}` +
    `/documents/briefs/${id}`
  );
}

/**
 * Writes one brief. Uses the caller's own ID token when there is one, so firestore.rules
 * still decides what this request may do — the Worker never acts with elevated rights.
 */
async function writeBrief(
  env: Env,
  idToken: string,
  briefId: string,
  fields: Record<string, FsField>
): Promise<boolean> {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}` +
      `/databases/${env.FIRESTORE_DATABASE_ID}/documents:commit?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        writes: [
          {
            currentDocument: { exists: false },
            document: { name: briefDocName(env, briefId), fields },
          },
        ],
      }),
    }
  );
  return res.ok;
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  return ((await req.json().catch(() => null)) as Record<string, unknown> | null) || {};
}

// ---------------------------------------------------------------------------
// Firestore REST read (pricing for /api/order)
//
// /plans/{id} and /coupons/{code} are publicly readable in firestore.rules, so the Worker can
// fetch them with the browser's own ID token and the rules still decide what is allowed. Prices
// are therefore taken from the database, never from the request body.
// ---------------------------------------------------------------------------
const fsBase = (env: Env) =>
  `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}` +
  `/databases/${env.FIRESTORE_DATABASE_ID}/documents`;

async function fsGet(
  env: Env,
  path: string,
  idToken: string
): Promise<Record<string, FsField> | null> {
  const res = await fetch(`${fsBase(env)}/${path}?key=${env.FIREBASE_API_KEY}`, {
    headers: { 'Cache-Control': 'no-store', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
  });
  if (!res.ok) return null;
  const doc = (await res.json().catch(() => null)) as { fields?: Record<string, FsField> } | null;
  return doc?.fields || null;
}

const fsStr = (fields: Record<string, FsField> | null, key: string): string => {
  const v = fields?.[key]?.stringValue;
  return typeof v === 'string' ? v : '';
};

const fsInt = (fields: Record<string, FsField> | null, key: string): number => {
  const raw = fields?.[key]?.integerValue ?? fields?.[key]?.doubleValue;
  const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const fsBool = (fields: Record<string, FsField> | null, key: string): boolean =>
  fields?.[key]?.booleanValue === true;

const m = (fields: Record<string, FsField>): FsField => ({ mapValue: { fields } });

/** One cart line, priced from the plan document the database actually holds. */
type PricedItem = {
  planId: string;
  name: string;
  priceInr: number;
  qty: number;
  lineTotalInr: number;
  periodLabel: string;
};

const QTY_CAP: Record<string, number> = { website: 1, care: 12, addon: 10 };

async function priceItems(
  env: Env,
  rawItems: unknown[],
  idToken: string
): Promise<{ items: PricedItem[]; error?: string }> {
  const items: PricedItem[] = [];
  // Six lines maximum: firestore.rules may make only 10 get() calls for this one document, and
  // each priced line costs one of them.
  for (const entry of rawItems.slice(0, 6)) {
    const x = (entry || {}) as Record<string, unknown>;
    const planId = clipText(x.planId, 64);
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(planId)) return { items: [], error: 'bad-plan' };
    if (items.some((it) => it.planId === planId)) return { items: [], error: 'duplicate-plan' };

    const plan = await fsGet(env, `plans/${planId}`, idToken);
    if (!plan) return { items: [], error: 'plan-not-found' };
    const priceInr = fsInt(plan, 'priceInr');
    if (priceInr < 1 || priceInr > 200000) return { items: [], error: 'plan-not-priced' };
    if (!fsBool(plan, 'active')) return { items: [], error: 'plan-retired' };

    const category = fsStr(plan, 'category') || 'addon';
    const qty = Math.max(1, Math.min(QTY_CAP[category] || 1, Math.round(Number(x.qty) || 1)));
    items.push({
      planId,
      name: clipText(fsStr(plan, 'name'), 60),
      priceInr,
      qty,
      lineTotalInr: priceInr * qty,
      periodLabel: clipText(fsStr(plan, 'periodLabel'), 40),
    });
  }
  if (!items.length) return { items: [], error: 'empty-cart' };
  if (items.reduce((sum, it) => sum + it.lineTotalInr, 0) > 500000) return { items: [], error: 'too-large' };
  return { items };
}

async function writeOrder(
  env: Env,
  idToken: string,
  orderId: string,
  fields: Record<string, FsField>
): Promise<boolean> {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}` +
      `/databases/${env.FIRESTORE_DATABASE_ID}/documents:commit?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        writes: [
          {
            currentDocument: { exists: false },
            document: {
              name:
                `projects/${env.FIREBASE_PROJECT_ID}/databases/${env.FIRESTORE_DATABASE_ID}` +
                `/documents/orders/${orderId}`,
              fields,
            },
          },
        ],
      }),
    }
  );
  return res.ok;
}

function bearerToken(req: Request): string {
  const raw = req.headers.get('authorization') || '';
  return raw.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
}

const clipText = (value: unknown, max: number): string =>
  String(value ?? '')
    .replace(/\r/g, '')
    .trim()
    .slice(0, max);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

// ---------------------------------------------------------------------------
// 24/7 studio chat. The browser never holds an AI key: it posts the question here and the
// Worker answers with the studio's own facts. Without GEMINI_API_KEY the endpoint reports
// "ai-not-configured" and the widget silently falls back to its built-in answers.
// ---------------------------------------------------------------------------
const SUPPORT_MODEL = 'gemini-2.5-flash';

const SUPPORT_SYSTEM_PROMPT = `You are the "VoidVisuals Assistant", the official 24/7 chat of VoidVisuals (voidvisuals.pages.dev), a creative web studio in India that designs, builds and upgrades websites. Be warm, sharp and professional — like a senior studio producer, not a salesperson.

LANGUAGE RULE (most important): reply in exactly the same language and script the visitor used. Hindi in Devanagari gets Devanagari Hindi. Hinglish written in English letters gets Hinglish. Bengali, Tamil, Telugu, Malayalam, Marathi, Punjabi, Urdu, Indonesian, Spanish, Portuguese, French, German, Japanese, Korean, Arabic, Russian or plain English: same deal. Never translate into English unless the visitor wrote in English.

VERIFIED FACTS (the only source of truth — never invent a price, deadline or promise):
- What the studio does: custom website design, hand-coded development, animations and interactive UI, SEO and performance tuning, website upgrades and redesigns of old sites, landing pages, online stores (catalogue + enquiry based), ongoing care plans.
- Website plans (one-time build price): Starter Rs.2,500 for 1-3 pages; Professional Rs.5,000 for 5-7 pages (marked Most Popular); Premium Rs.8,000 for 8-12 pages with custom design, basic CMS and performance tuning.
- Add-ons: extra page Rs.700 per page, animation pack Rs.1,500, SEO and speed tune-up Rs.1,200, website upgrade/redesign from Rs.3,000. Care plan Rs.499 per month (4 content edits a month, hosting and domain kept live, monthly backup and security check).
- Domain is free for the first year on every plan. Hosting is free for the first year on Professional and Premium. Renewals after year one are charged at normal registrar/hosting cost and quoted first.
- Typical delivery: Starter 5-7 days, Professional 10-14 days, Premium about 3 weeks. A single landing page can go live in about 48 hours.
- Revisions: Professional includes 2 rounds, Premium includes 4.
- Team: Ansh (Founder / Web Developer), Santosh (UI/UX Designer), Sayak (Frontend Developer), Sachin (Creative / Content).
- Contact: email voidvisuals999@gmail.com, phone +91 89203 68725, WhatsApp wa.me/918920368725. Payment is not taken in this chat; projects start from the brief form on the site.
- Ownership: the client owns the domain, code, content and hosting access. No lock-in.
- What the studio needs to start: logo if they have one, the text or a rough idea per page, photos. It will draft structure and copy with them if they have nothing.
- Upgrade path: an existing site can be rebuilt with the same URLs and content so search rankings survive; speed is usually the biggest first win.
- Sizing guide for choosing a plan: personal or single-offer page = Starter; a business that needs credibility, a form, a map and several pages = Professional; a brand that needs a store, blog, custom design and advanced motion = Premium.

HOW TO ANSWER:
- 1-4 short sentences, or a few "•" bullet lines. No markdown headings, no tables, no code blocks.
- For plan, price, timeline or scope questions, answer directly from the facts above and end with a next step: send a brief through the contact form, or WhatsApp the studio.
- For general website questions (why is my site slow, what pages do I need, how do I show my work, is a store better than WhatsApp orders), give a genuinely useful short recommendation.
- If something is not in the facts above, say you are not sure and offer to pass it to a human through the brief form. Never guess a price, discount, date or policy.
- Never ask for passwords, OTPs, bank details or documents; the studio never requests those in chat.
- Refunds, disputed payments, missed deadlines, broken live sites or anything involving account access must go to a human: point to email or WhatsApp and tell them a founder replies the same day.
- Stay on topic: VoidVisuals, websites, design, hosting, domains, SEO and project scope.`;

type SupportTurn = { role: 'user' | 'model'; text: string };

async function askSupportAi(
  question: string,
  history: SupportTurn[],
  env: Env
): Promise<string | null> {
  // Gemini expects the first turn to come from the visitor, and every turn needs text.
  const turns: SupportTurn[] = history.filter((turn) => turn.text.length > 0);
  while (turns.length > 0 && turns[0].role === 'model') turns.shift();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${SUPPORT_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SUPPORT_SYSTEM_PROMPT }] },
        contents: [
          ...turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
          { role: 'user', parts: [{ text: question }] },
        ],
        generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
      }),
    }
  );
  const data = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;
  if (!res.ok) return null;
  const answer = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim();
  return answer || null;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const clientIp =
      req.headers.get('cf-connecting-ip') ||
      (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
      'unknown';

    // Fixed-window counter, one DO instance per bucket name. Returns a 429 once the budget is gone.
    const limitBy = async (bucket: string, max: number, windowMs: number): Promise<Response | null> => {
      const stub = env.OTP_DO.get(env.OTP_DO.idFromName(bucket));
      const r = await stub.fetch('https://do/rate', {
        method: 'POST',
        body: JSON.stringify({ max, windowMs }),
      });
      const out = (await r.json().catch(() => null)) as { allowed?: boolean; retryAfter?: number } | null;
      if (!out || out.allowed) return null;
      return json({ ok: false, error: 'rate-limited', retryAfter: out.retryAfter || 60 }, 429);
    };

    if (url.pathname === '/api/admin/send-code' && req.method === 'POST') {
      // Every successful call sends a real email, so this is what can drain the EmailJS quota.
      const tooManyDevices = await limitBy(`ip:${clientIp}`, 6, 15 * 60 * 1000);
      if (tooManyDevices) return tooManyDevices;
      const body = await readJsonBody(req);
      const idToken = String(body.idToken || '');
      const email = idToken ? await emailFromIdToken(idToken, env.FIREBASE_API_KEY) : null;
      // A missing session and a wrong allowlist are different fixes, so they report differently.
      if (!email) return json({ ok: false, error: 'no-session' }, 401);
      if (!ADMIN_EMAILS.includes(email)) return json({ ok: false, error: 'not-admin' }, 403);
      const tooManyCodes = await limitBy(`code:${email}`, 3, 15 * 60 * 1000);
      if (tooManyCodes) return tooManyCodes;
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const sent = await sendCodeEmail(email, code, env);
      if (sent !== 'ok') return json({ ok: false, error: `email-${sent}` }, 502);
      const stub = env.OTP_DO.get(env.OTP_DO.idFromName(email));
      await stub.fetch('https://do/set', { method: 'POST', body: JSON.stringify({ code }) });
      return json({ ok: true });
    }

    if (url.pathname === '/api/admin/verify-code' && req.method === 'POST') {
      const tooManyTries = await limitBy(`verify:${clientIp}`, 30, 15 * 60 * 1000);
      if (tooManyTries) return tooManyTries;
      const body = await readJsonBody(req);
      const idToken = String(body.idToken || '');
      const code = String(body.code || '');
      const email = idToken ? await emailFromIdToken(idToken, env.FIREBASE_API_KEY) : null;
      if (!email) return json({ ok: false, error: 'no-session' }, 401);
      if (!ADMIN_EMAILS.includes(email)) return json({ ok: false, error: 'not-admin' }, 403);
      const stub = env.OTP_DO.get(env.OTP_DO.idFromName(email));
      const r = await stub.fetch('https://do/check', { method: 'POST', body: JSON.stringify({ code }) });
      const out = (await r.json()) as { result?: string };
      if (out.result === 'ok') return json({ ok: true });
      return json({ ok: false, error: out.result || 'wrong' }, 401);
    }

    // Client-facing IP for the audit log's "Device / IP" column. Cloudflare knows the real
    // client IP here; the browser cannot.
    if (url.pathname === '/api/whoami' && req.method === 'GET') {
      const cf = (req as { cf?: { country?: string } }).cf;
      return json({ ip: clientIp === 'unknown' ? '' : clientIp, country: cf?.country || '' });
    }

    // Multilingual studio chat. The widget keeps a local fallback, so a missing key or an
    // upstream failure never breaks the conversation.
    if (url.pathname === '/api/support/ai' && req.method === 'POST') {
      const limited = await limitBy(`chat:${clientIp}`, 25, 5 * 60 * 1000);
      if (limited) return limited;
      if (!env.GEMINI_API_KEY) return json({ ok: false, error: 'ai-not-configured' }, 503);
      const body = await readJsonBody(req);
      const question = clipText(body.question, 600);
      if (question.length < 2) return json({ ok: false, error: 'empty-question' }, 400);
      const rawHistory = Array.isArray(body.history) ? (body.history as unknown[]).slice(-6) : [];
      const history: SupportTurn[] = rawHistory
        .map((t) => {
          const item = (t || {}) as Record<string, unknown>;
          return {
            role: String(item.role) === 'model' ? ('model' as const) : ('user' as const),
            text: clipText(item.text, 800),
          };
        })
        .filter((t) => t.text.length > 0);
      const answer = await askSupportAi(question, history, env);
      if (!answer) return json({ ok: false, error: 'ai-unavailable' }, 502);
      return json({ ok: true, answer });
    }

    // Project brief from the contact page.
    if (url.pathname === '/api/briefs' && req.method === 'POST') {
      const perDevice = await limitBy(`brief:${clientIp}`, 4, 30 * 60 * 1000);
      if (perDevice) return perDevice;

      const body = await readJsonBody(req);
      const raw = body;

      // Honeypot: a bot fills the hidden "company" field. Answer as if it worked.
      if (clipText(raw.company, 120).length > 0) return json({ ok: true, id: 'queued' });

      const name = clipText(raw.name, 60);
      const email = clipText(raw.email, 120).toLowerCase();
      const phone = clipText(raw.phone, 24);
      const service = clipText(raw.service, 60);
      const budget = clipText(raw.budget, 40);
      const details = clipText(raw.details, 1200);
      const link = clipText(raw.link, 200);
      const coupon = clipText(raw.coupon, 24).toUpperCase();

      if (name.length < 2) return json({ ok: false, error: 'Please tell us your name.' }, 400);
      if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'Please enter a working email address.' }, 400);
      if (!BRIEF_SERVICES.includes(service)) return json({ ok: false, error: 'Pick the kind of project you need.' }, 400);
      if (details.length < 12) return json({ ok: false, error: 'Tell us a little more about the project.' }, 400);

      const perEmail = await limitBy(`briefmail:${email}`, 6, 24 * 60 * 60 * 1000);
      if (perEmail) return perEmail;

      const idToken = bearerToken(req);
      const session = idToken ? await sessionFromIdToken(idToken, env.FIREBASE_API_KEY) : null;
      const ownerEmail = session?.email || '';

      const briefId = `brw_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
      const created = new Date();
      const fields: Record<string, FsField> = {
        name: s(name),
        email: s(email),
        phone: s(phone),
        service: s(service),
        budget: s(budget),
        details: s(details),
        link: s(link),
        coupon: s(coupon),
        ownerEmail: s(ownerEmail),
        status: s('new'),
        note: s(''),
        timeline: { arrayValue: { values: [{ mapValue: { fields: { at: i(created.getTime()), label: s('Brief received'), by: s('website') } } }] } },
        createdAt: { timestampValue: created.toISOString() },
        createdAtMs: i(created.getTime()),
      };

      const written = await writeBrief(env, idToken, briefId, fields);
      if (!written) {
        return json(
          { ok: false, error: 'The brief could not be saved. Please WhatsApp or email us instead.' },
          502
        );
      }
      return json({ ok: true, id: briefId });
    }

    // Order + invoice from the checkout sheet. The cart only sends plan ids and quantities;
    // every rupee below comes from the plans and coupons documents in Firestore.
    if (url.pathname === '/api/order' && req.method === 'POST') {
      const perDevice = await limitBy(`order:${clientIp}`, 8, 60 * 60 * 1000);
      if (perDevice) return perDevice;

      const body = await readJsonBody(req);

      // Honeypot: bots fill the hidden "website" field. Answer as if it worked.
      if (clipText(body.website, 120).length > 0) return json({ ok: true, error: 'spam-trap' });

      const name = clipText(body.name, 60);
      const email = clipText(body.email, 120).toLowerCase();
      const phone = clipText(body.phone, 24);
      const company = clipText(body.company, 80);
      const couponCode = clipText(body.coupon, 24).toUpperCase();
      const rawItems = Array.isArray(body.items) ? (body.items as unknown[]) : [];

      if (name.length < 2) return json({ ok: false, error: 'Please tell us who the invoice is for.' }, 400);
      if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'A working email address is needed for the invoice.' }, 400);
      if (phone.length < 8 || phone.length > 24) return json({ ok: false, error: 'Please enter a reachable phone number.' }, 400);
      if (!rawItems.length || rawItems.length > 6) return json({ ok: false, error: 'Your cart is empty.' }, 400);

      const perEmail = await limitBy(`ordermail:${email}`, 12, 24 * 60 * 60 * 1000);
      if (perEmail) return perEmail;

      // The customer's own session: prices are read through it, and the commit is written as them,
      // so firestore.rules stays the final authority on both.
      const idToken = bearerToken(req);
      if (!idToken) {
        return json({ ok: false, error: 'Please sign in to place an order — the invoice is tied to your account.' }, 401);
      }
      const session = await sessionFromIdToken(idToken, env.FIREBASE_API_KEY);
      if (!session) return json({ ok: false, error: 'Your session expired. Sign in again and try once more.' }, 401);

      const priced = await priceItems(env, rawItems, idToken);
      if (priced.error || !priced.items.length) {
        const messages: Record<string, string> = {
          'plan-not-found':
            'That item is not in the studio price list yet, so the order cannot be priced. Refresh the Plans page — or send a brief and we will quote you.',
          'plan-not-priced': 'A selected item has no valid price. Please send a brief instead.',
          'plan-retired': 'One of the selected items is no longer sold. Refresh and pick again.',
          'empty-cart': 'Your cart is empty.',
          'too-large': 'This order is too large for the checkout. Send a brief and we will quote it.',
          'duplicate-plan': 'The same item was added twice. Keep one line and raise its quantity.',
          'bad-plan': 'One of the selected items is not a real plan.',
        };
        return json({ ok: false, error: messages[priced.error || 'empty-cart'] || 'The cart could not be priced.' }, 400);
      }

      const subtotalInr = priced.items.reduce((sum, it) => sum + it.lineTotalInr, 0);
      let discountPercent = 0;
      if (couponCode && /^[A-Z0-9]{2,24}$/.test(couponCode)) {
        const coupon = await fsGet(env, `coupons/${couponCode}`, idToken);
        if (coupon) {
          // A coupon written before the `active` flag existed has no such field, so only an
          // explicit false refuses the code.
          const raw = coupon.active;
          const active = raw === undefined ? true : raw.booleanValue !== false;
          if (active) discountPercent = Math.min(90, Math.max(0, fsInt(coupon, 'discountPercent')));
        }
      }
      // Integer floor division — identical to the client and to the rules, to the paisa.
      const discountInr = Math.floor((subtotalInr * discountPercent) / 100);
      const totalInr = Math.max(1, subtotalInr - discountInr);

      const created = new Date();
      const createdMs = created.getTime();
      const orderId = `vo_${createdMs.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
      const ref = `VV-${createdMs.toString(36).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;

      const fields: Record<string, FsField> = {
        ref: s(ref),
        name: s(name),
        email: s(email),
        phone: s(phone),
        company: s(company),
        items: {
          arrayValue: {
            values: priced.items.map((it) =>
              m({
                planId: s(it.planId),
                name: s(it.name),
                priceInr: i(it.priceInr),
                qty: i(it.qty),
                lineTotalInr: i(it.lineTotalInr),
                periodLabel: s(it.periodLabel),
              })
            ),
          },
        },
        coupon: s(couponCode),
        subtotalInr: i(subtotalInr),
        discountInr: i(discountInr),
        totalInr: i(totalInr),
        status: s('awaiting-payment'),
        txnRef: s(''),
        note: s(''),
        ownerEmail: s(session.email),
        timeline: {
          arrayValue: {
            values: [
              {
                mapValue: {
                  fields: { at: i(createdMs), label: s('Order created — awaiting UPI payment'), by: s('website') },
                },
              },
            ],
          },
        },
        createdAt: { timestampValue: created.toISOString() },
        createdAtMs: i(createdMs),
      };

      const written = await writeOrder(env, idToken, orderId, fields);
      if (!written) {
        return json({ ok: false, error: 'The order could not be saved. Please WhatsApp or email us instead.' }, 502);
      }
      return json({ ok: true, id: orderId, ref, totalInr, currency: 'INR' });
    }

    // Everything else is the static SPA. A deployment that ships the script without its
    // assets would otherwise answer every page with an opaque Cloudflare 1101 error.
    if (!env.ASSETS) {
      return json(
        {
          ok: false,
          error: 'assets-not-attached',
          message: 'Re-deploy from GitHub so ./dist is uploaded together with the Worker.',
        },
        503
      );
    }
    return withSecurityHeaders(await env.ASSETS.fetch(req));
  },
};
