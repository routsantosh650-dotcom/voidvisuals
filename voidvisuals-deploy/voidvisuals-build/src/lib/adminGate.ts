/**
 * Admin gate helpers.
 *
 * Neither the console URL nor the admin allowlist exists as a readable string in this bundle —
 * only their SHA-256 digests do, so searching the shipped JS for "admin", a route or an email
 * finds nothing, and no crawler or curious visitor can guess the path. This is anti-discovery,
 * not authorization: the real gate is Firebase Auth + the emailed 6-digit code + the same
 * allowlist enforced in worker.ts and firestore.rules.
 */

// Rotate the console URL: edit the path in ADMIN_ACCESS.local.md, hash it, replace this digest,
// redeploy. Nothing else in the app references the literal path.
const CONSOLE_PATH_DIGEST =
  'be13a8c7b550a83b1837c9d853d05dc4490e795ad40cad1f8953378d9cbb60cc';

// digest → what the console may show for that account.
const ADMIN_DIGESTS: Array<[string, { name: string; role: string }]> = [
  ['005f04b6ce529f4bb044d13bc8cdb21c1a30d851f8be2ae87caddbac5c4b0d19', { name: 'VoidVisuals Studio', role: 'Studio Account · Owner' }],
  ['3d42898c99b5059d686de13333e4c2862aa88cd2999cc361b11d9435a0476b7e', { name: 'Santosh Rout', role: 'Lead Developer · Co-Admin' }],
];

// SHA-256 in plain JS, used only when WebCrypto cannot run — crypto.subtle is undefined outside a
// secure context and in some hardened or extension-sandboxed browsers. Without a fallback the
// console path can never match, and the studio's own admin sees a public 404 with no clue why.
const ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

function sha256Bytes(bytes: Uint8Array): string {
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const len = bytes.length;
  const padded = new Uint8Array(((len + 72) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((len * 8) / 4294967296));
  view.setUint32(padded.length - 4, (len * 8) >>> 0);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, x] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const t1 = (x + S1 + ((e & f) ^ (~e & g)) + ROUND_CONSTANTS[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      x = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    const round = [a, b, c, d, e, f, g, x];
    for (let i = 0; i < 8; i++) h[i] = (h[i] + round[i]) >>> 0;
  }
  return h.map((word) => word.toString(16).padStart(8, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  if (!globalThis.crypto?.subtle) return sha256Bytes(bytes);
  try {
    const buffer = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return sha256Bytes(bytes);
  }
}

function normalizePath(path: string): string {
  return path.replace(/\/+$/, '').toLowerCase() || '/';
}

export async function isConsolePath(path: string): Promise<boolean> {
  return (await sha256Hex(normalizePath(path))) === CONSOLE_PATH_DIGEST;
}

export async function consoleProfileForEmail(
  email: string
): Promise<{ name: string; role: string } | null> {
  const digest = await sha256Hex((email || '').trim().toLowerCase());
  if (!digest) return null;
  return ADMIN_DIGESTS.find(([allowed]) => allowed === digest)?.[1] ?? null;
}
