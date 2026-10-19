# VoidVisuals — creative web studio site

One repo, three moving parts:

| Part | What it is | Where it runs |
| --- | --- | --- |
| `src/` | Vite + React SPA — Home, Studio, Work, Plans, Contact, Client portal, hidden Studio console | Cloudflare Worker assets (`./dist`) |
| `worker.ts` | API + static file server: briefs, admin 2FA code, AI chat, IP rate limits, security headers | Cloudflare Worker (free tier) |
| `firestore.rules` | Data safety for every collection | Firebase project **`voidvisualsdb`**, database **`(default)`** |

Nothing here talks to Areex. Different Firebase project (`voidvisualsdb`), different Worker name
(`voidvisuals`), different Firestore database, different Durable-Object migrations tag. Redeploying
Areex can never break this site, and vice versa.

## Pages

- `/` — hero, marquee, services, work board (with cover artwork), animated sales globe, process,
  plans + discount board, reviews, tech stack, FAQ, CTA
- `/studio` — the story, promises, founder quote, crew roster with roles, studio photo, FAQ
- `/work` — full portfolio with category filters and a lightbox
- `/plans` — every tier, add-on and the care plan
- `/contact` — project brief form (this is where "Choose plan" lands for anything custom)
- `/portal` — a signed-in customer sees their own briefs **and their invoices**: line items,
  totals, coupon, payment reference and the delivery timeline
- `/<hidden console>` — studio console: brief inbox, **Billing desk** (invoices and UPI payments),
  work board, reviews, plans, site content, audit log
  (the URL is not written anywhere in this repo; see `ADMIN_ACCESS.local.md`)

Payment is UPI only, by design: the checkout sheet builds a `upi://pay` intent for the exact total
and renders it as a QR. There is no gateway and no callback, so an invoice only becomes "paid" when
the studio records the UPI reference in the Billing desk — `firestore.rules` enforces that money can
never be marked paid by the payer, and freezes every rupee on an invoice the moment it is created.

Right-click anywhere on the site opens the studio's own glass context menu (Copy, Search, Open link
in a new tab, Save image, plus shortcuts to plans, work and the brief form) instead of the browser's.

## Deploy (the only way that works for this project)

There is no Node.js on your laptop, so nothing is built locally. GitHub + Workers Builds does it.

1. **GitHub** — upload every file in this folder to a repository (keep the folder structure).
   Do **not** upload `ADMIN_ACCESS.local.md` — it is gitignored and must stay off GitHub.
2. **Cloudflare → Workers & Pages → Create → Workers → "Builds" → Connect to GitHub**, pick that
   repo. Build command `npm install && vite build`, output directory `dist`.
   The first deploy creates the Worker named in `wrangler.toml`: `voidvisuals`.
3. **Worker → Settings → Secrets** — add the two secrets listed in `SECURITY_SETUP.md`.
4. **Firebase project `voidvisualsdb`** (its own project, separate from Areex) →
   **Firestore Database → Security rules** → in the database picker choose **`(default)`** →
   paste `firestore.rules` → **Publish**. Rules are per-database, so publish them on this database
   and nowhere else.
5. **Same project → Authentication** → Sign-in method: **Email/Password** and **Google** both
   enabled. Then **Settings → Authorized domains** → add
   `voidvisuals.routsantosh650.workers.dev` (and your custom domain later), otherwise Google
   sign-in throws `auth/unauthorized-domain`.
6. **emailjs.com** — clone the Areex template as a VoidVisuals one (subject/body must say
   VoidVisuals), then paste the new `template_xxxxxxx` ID into `wrangler.toml` →
   `EMAILJS_TEMPLATE_ID` and push. Without this step the console's emailed login code says
   "Areex".

## After deploying — 60-second health check

Run these in a browser or with curl, replacing `HOST` with your Worker URL:

- `https://HOST/` → the site renders, no white page.
- `https://HOST/plans` → a deep link loads (this is the `env.ASSETS` + SPA-routing check).
- Submit the contact form → you get a brief reference number. If it says "could not be saved",
  the rules are not published on the `(default)` database of project `voidvisualsdb`.
- The console URL from `ADMIN_ACCESS.local.md` → the site opens the studio console, sign in, then
  the 6-digit code arrives by email. If the code email fails, the EmailJS secret/template is wrong.
- Ask the chat widget something in Hindi → it answers. Without `GEMINI_API_KEY` it falls back to
  built-in answers, which is intentional and nothing breaks.
- Add a plan to the cart → open the checkout sheet → "Get the UPI QR" → a QR appears and `/portal`
  shows that invoice as *Awaiting payment*. If the order is refused, the rules on the `(default)`
  database are the older copy: this build added the `orders` collection block and the optional
  `cover` field on `work`, so `firestore.rules` must be pasted and published again.
- Right-click on the page → the studio menu opens; on a phone the long-press behaviour is untouched.

## Editing content

Everything a client can see is editable from the console — no code, no redeploy:
headlines, contacts, WhatsApp/Instagram links, plans and prices, portfolio items, reviews,
coupon codes, and the discount board with its countdown deadline.

Content lives in Firestore collections: `siteConfig/main`, `plans/{id}`, `work/{id}`,
`testimonials/{id}`, `coupons/{CODE}`, `briefs/{id}`, `auditLog/{id}`.
The defaults in `src/data/vvData.ts` are only the seed/placeholder values; the Site content tab
has "Publish starter plans" and "Publish sample work" buttons to push them into Firestore.

## Commands (only useful on a machine that has Node)

```
npm install
npm run dev      # local dev server
npm run build    # -> dist/
npm run lint     # tsc --noEmit type check
```
