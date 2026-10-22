/** Deferred workshop jobs block handover unless an owner/admin gives an override reason. */
export function handoverAllowed(deferredOpenJobs: number, role: string | null | undefined, overrideReason: unknown): boolean {
  if (deferredOpenJobs <= 0) return true;
  const reason = String(overrideReason ?? '').trim();
  return reason.length > 0 && ['admin', 'owner'].includes(String(role ?? ''));
}
