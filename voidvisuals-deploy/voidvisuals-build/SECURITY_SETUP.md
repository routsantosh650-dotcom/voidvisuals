# VoidVisuals — security setup

## Where every secret lives

| Value | Location | Committed to GitHub? |
| --- | --- | --- |
| Firebase web API key | `firebase-applet-config.json`, `wrangler.toml [vars]` | yes — it is a public browser key, not a secret |
| Firestore database id | `voidvisualsdb` in both files above | yes, public |
| EmailJS service id / public key | `wrangler.toml [vars]` | yes, public by EmailJS design |
| `EMAILJS_PRIVATE_KEY` | **Cloudflare Worker Secret only** | never |
| `GEMINI_API_KEY` | **Cloudflare Worker Secret only** | never |
| Console URL + admin emails | `ADMIN_ACCESS.local.md` (gitignored) | never |
| Firestore rules allowlist emails | `firestore.rules` | yes — unavoidable, rules need them; they are readable by anyone who can guess a document id, and give no access by themselves |

Adding a secret: Cloudflare → Workers & Pages → **voidvisuals** → Settings → Variables → Secrets →
Add. Then **Deploy** once so the secret attaches. Secrets are never written into a file in this repo —
`.env.example` documents them with `PASTE_ONLY_IN_CLOUDFLARE_NEVER_HERE`.

## Who may reach the studio console

Four independent checks; all four must pass.

1. **Path is not guessable.** `src/lib/adminGate.ts` stores only the SHA-256 digest of the console
   path. The literal URL appears in no bundle, no route table, no comment and no committed file —
   searching the shipped JS for it finds nothing. Unknown paths never render the console either
   (`consoleMatch` starts as `null` → boot screen, so nothing flashes before a 404).
2. **Firebase session** with one of the two allowlisted addresses, again matched by SHA-256 digest.
3. **6-digit emailed code** (`/api/admin/send-code` → `/api/admin/verify-code`), enforced by the
   Worker with the allowlist a second time. Codes expire, requests are IP-rate-limited, and the
   Durable Object `OtpStore` counts attempts so a brute force stops at the limit instead of
   reaching Firestore.
4. **Firestore rules** — `isBootstrappedAdmin()` guards every write. Even with a stolen session
   token, a non-allowlisted account cannot write `siteConfig`, `plans`, `work`, `testimonials`
   or `coupons`.

The verified session is stored in `sessionStorage` and locks itself after 30 minutes ("Lock console"
in the sidebar does it immediately).

### Rotating the console URL

1. Pick a new random path, e.g. `/nebula-<random-8>` (use a password generator; no relation to the brand).
2. Compute its digest — open any browser's DevTools console (F12) and run:
   ```js
   crypto.subtle.digest('SHA-256', new TextEncoder().encode('/nebula-xxxxxxxx'))
     .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('')));
   ```
   (The path is lower-cased and any trailing `/` is removed before hashing — hash it exactly as written.)
3. Replace `CONSOLE_PATH_DIGEST` in `src/lib/adminGate.ts`, push to GitHub, let it build.
4. Update `ADMIN_ACCESS.local.md` with the new URL. Old URL stops working immediately.

### Adding / removing a studio account

Same file, `ADMIN_DIGESTS`: hash the lower-cased email address with the snippet above, then update
`ADMIN_EMAILS` in `worker.ts` **and** `isBootstrappedAdmin()` in `firestore.rules` to match. All
three places are the same allowlist; keeping them out of sync is the classic way to break the console.

## Rotation you still owe (they were pasted into a chat at some point)

- EmailJS **private key** — emailjs.com → Account → API keys → Create new key, delete the old one,
  then set the new value as the `EMAILJS_PRIVATE_KEY` Worker Secret.
- If a payment secret is ever added for this brand, same rule: Worker Secret only, rotate anything
  that was typed into a chat.

## Data rules worth knowing before editing `firestore.rules`

- **Rules are per-database.** This file must be published on `voidvisualsdb`'s own Security tab.
- Every collection uses `hasAll`/`hasOnly` key lists plus per-field length caps. Adding a field in
  the app without adding it to the rules makes the whole save fail — update both together
  (`src/data/vvData.ts → siteConfigFields()` is the browser-side twin of `isValidSiteConfig`).
- `briefs` — anyone may create, only the studio or the owning customer may read, updates are
  limited to `status`, `note`, `timeline`; the original enquiry can never be rewritten.
- `auditLog` — append-only. `update` and `delete` are `false` for everyone, including the studio,
  and `createdAt` comes from the server clock.
- `testimonials` — the public sees `approved: true` rows only.
- The Worker writes with the caller's own ID token (never an admin token), so a direct REST client
  cannot smuggle a fake brief past the validators; `createdAt` is allowed a ±2 minute window around
  the server clock because the Worker stamps it just before committing.

## Abuse limits in `worker.ts`

- 4 briefs per 30 minutes per IP/device fingerprint, 6 per day per email address.
- OTP request and verify attempts are counted in `OtpStore`; exceeding the window returns 429.
- Chat AI is rate-limited too, so a stolen `GEMINI_API_KEY` cannot be drained from one page.
- Every response carries `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy` and a `Cache-Control: no-store` on API responses.
- Honeypot field + silent fake success for bots on the brief form.
- The console never appears in search engines: `noindex,nosnippet,noarchive` is injected only while
  the console route is matched, and it is stripped on unmount.
