/** Messages are only accepted from this app or our own sign-in service. */
export function isTrustedOrigin(origin: string): boolean {
  if (origin === window.location.origin) return true;
  try {
    const fn = new URL(import.meta.env.VITE_SUPABASE_URL as string).origin;
    if (origin === fn) return true;
  } catch { /* ignore */ }
  return origin === 'https://api.velodealer.com' || origin === 'https://hgztcymscgyuekgsyyfe.supabase.co';
}
