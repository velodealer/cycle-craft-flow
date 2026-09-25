// Pure helpers for the eBay OAuth redirect flow (tested in ebay-oauth-origin.test.ts).

export const DEFAULT_APP_ORIGIN = 'https://velodealer.com';

/** Only VeloDealer's own addresses may receive the post-sign-in redirect (prevents open redirects). */
export function allowedOrigin(input: unknown): string {
  if (typeof input !== 'string') return DEFAULT_APP_ORIGIN;
  try {
    const u = new URL(input);
    const host = u.hostname.toLowerCase();
    const ok =
      (u.protocol === 'https:' && (host === 'velodealer.com' || host.endsWith('.velodealer.com'))) ||
      (u.protocol === 'https:' && /^[a-z0-9-]+(--[a-z0-9-]+)*\.lovable\.app$/.test(host)) ||
      (u.protocol === 'https:' && host.endsWith('.lovableproject.com')) ||
      (u.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1'));
    return ok ? u.origin : DEFAULT_APP_ORIGIN;
  } catch {
    return DEFAULT_APP_ORIGIN;
  }
}

export type CallbackKind = 'code' | 'error' | 'declined' | 'none';

/** Classifies a GET request arriving at the OAuth endpoint from eBay. */
export function classifyCallback(params: URLSearchParams): CallbackKind {
  if (params.get('code')) return 'code';
  if (params.get('declined') !== null) return 'declined';
  const err = params.get('error');
  if (err) return err === 'access_denied' ? 'declined' : 'error';
  if (params.get('state')) return 'declined';
  return 'none';
}

/** eBay reports a dead refresh token as invalid_grant. */
export function isInvalidGrant(status: number, body: string): boolean {
  return (status === 400 || status === 401) && /invalid_grant/i.test(body);
}
