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
  '1f8d31b54aca551e6b9d621ae1b4989d456a5da019dcd94e166da8a623b335d4';

// digest → what the console may show for that account.
const ADMIN_DIGESTS: Array<[string, { name: string; role: string }]> = [
  ['005f04b6ce529f4bb044d13bc8cdb21c1a30d851f8be2ae87caddbac5c4b0d19', { name: 'VoidVisuals Studio', role: 'Studio Account · Owner' }],
  ['3d42898c99b5059d686de13333e4c2862aa88cd2999cc361b11d9435a0476b7e', { name: 'Santosh Rout', role: 'Lead Developer · Co-Admin' }],
];

async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) return '';
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
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
