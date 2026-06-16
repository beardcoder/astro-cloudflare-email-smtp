/**
 * GDPR-friendly spam protection — no third parties, no cookies, no stored data.
 *
 * Strategy: a server-signed "time token". On render we hand the form an
 * HMAC-signed timestamp. On submit we verify the signature and that the form
 * was on screen for a plausible amount of time (humans take a few seconds,
 * bots fire instantly). Nothing personal is processed or persisted.
 */

// Humans need at least this long to fill the form; bots are faster.
const MIN_FILL_MS = 2_500;
// Tokens older than this are stale (page left open / replay attempts).
const MAX_AGE_MS = 1000 * 60 * 60 * 2; // 2 hours

// Fallback only for local dev — set the FORM_SECRET secret in production.
const FALLBACK_SECRET = "astro-cf-email-smtp-dev-secret-change-me";

const enc = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time string comparison to avoid leaking timing info on the signature.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Issue a signed token to embed in the form on render. */
export async function issueFormToken(secret: string | undefined): Promise<string> {
  const ts = Date.now().toString(36);
  const sig = await hmacHex(secret || FALLBACK_SECRET, ts);
  return `${ts}.${sig}`;
}

export type GuardResult =
  | { ok: true }
  | { ok: false; reason: "malformed" | "bad-signature" | "too-fast" | "expired" };

/** Verify a token submitted with the form. */
export async function verifyFormToken(
  secret: string | undefined,
  token: string | undefined,
): Promise<GuardResult> {
  if (!token) return { ok: false, reason: "malformed" };
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return { ok: false, reason: "malformed" };

  const expected = await hmacHex(secret || FALLBACK_SECRET, ts);
  if (!timingSafeEqual(sig, expected)) return { ok: false, reason: "bad-signature" };

  const issued = parseInt(ts, 36);
  if (Number.isNaN(issued)) return { ok: false, reason: "malformed" };

  const age = Date.now() - issued;
  if (age < MIN_FILL_MS) return { ok: false, reason: "too-fast" };
  if (age > MAX_AGE_MS) return { ok: false, reason: "expired" };

  return { ok: true };
}
