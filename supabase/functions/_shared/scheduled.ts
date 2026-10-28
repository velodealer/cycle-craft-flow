// Verifies that a request came from our own pg_cron schedule.
// The schedule sends `x-cron-token`, read from the service-role-only
// `scheduler_token` table, so outsiders cannot trigger scheduled work.
// deno-lint-ignore no-explicit-any
export async function isScheduledCall(req: Request, db: any): Promise<boolean> {
  const sent = req.headers.get('x-cron-token') || '';
  if (sent.length < 32) return false;
  const { data } = await db.from('scheduler_token').select('token').eq('id', 1).maybeSingle();
  const expected = (data as { token?: string } | null)?.token || '';
  if (!expected || expected.length !== sent.length) return false;
  let diff = 0;
  for (let i = 0; i < sent.length; i++) diff |= sent.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
