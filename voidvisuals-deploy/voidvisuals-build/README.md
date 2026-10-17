# VoidVisuals — creative web studio site

One repo, three moving parts:

| Part | What it is | Where it runs |
| --- | --- | --- |
| `src/` | Vite + React SPA — Home, Studio, Work, Plans, Contact, Client portal, hidden Studio console | Cloudflare Worker assets (`./dist`) |
| `worker.ts` | API + static file server: briefs, admin 2FA code, AI chat, IP rate limits, security headers | Cloudflare Worker (free tier) |
| `firestore.rules` | Data safety for every collection | Firebase, **database `voidvisualsdb`** |

Nothing here talks to Areex. Different Worker name (`voidvisuals`), different Firestore
database (`voidvisualsdb`), different Durable-Object migrations tag. Redeploying Areex can never
break this site, and vice versa.

## Pages

- `/` — hero, marquee, services, work board, process, plans + discount board, reviews, FAQ, CTA
- `/studio` — the story, promises, founder quote, team, FAQ
- `/work` — full portfolio with category filters and a lightbox
- `/plans` — every tier, add-on and the care plan
- `/contact` — project brief form (this is where "Choose plan" lands — **no payment gateway by design**)
- `/portal` — a signed-in customer sees their own briefs, status and the studio's replies
- `/<hidden console>` — studio console: brief inbox, work, reviews, plans, site content, audit log
  (the URL is not written anywhere in this repo; see `ADMIN_ACCESS.local.md`)

## Deploy (the only way that works for this project)

There is no Node.js on your laptop, so nothing is built locally. GitHub + Workers Builds does it.

1. **GitHub** — upload every file in this folder to a repository (keep the folder structure).
   Do **not** upload `ADMIN_ACCESS.local.md` — it is gitignored and must stay off GitHub.
2. **Cloudflare → Workers & Pages → Create → Workers → "Builds" → Connect to GitHub**, pick that
   repo. Build command `npm install && vite build`, output directory `dist`.
   The first deploy creates the Worker named in `wrangler.toml`: `voidvisuals`.
3. **Worker → Settings → Secrets** — add the two secrets listed in `SECURITY_SETUP.md`.
4. **Firebase → Firestore → create the database `voidvisualsdb`** (Cloud Firestore, native mode),
   then open **that database's Security tab** and publish `firestore.rules`.
   Rules are per-database — publishing them on Areex's database does nothing for this site.
5. **Firebase → Authentication → Settings → Authorized domains** — add
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
  the rules are not published on `voidvisualsdb`.
- The console URL from `ADMIN_ACCESS.local.md` → the site opens the studio console, sign in, then
  the 6-digit code arrives by email. If the code email fails, the EmailJS secret/template is wrong.
- Ask the chat widget something in Hindi → it answers. Without `GEMINI_API_KEY` it falls back to
  built-in answers, which is intentional and nothing breaks.

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
