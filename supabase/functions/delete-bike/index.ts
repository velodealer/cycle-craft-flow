import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Parse a public storage URL into { bucket, path }. */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  if (typeof url !== 'string' || !url) return null;
  const marker = '/storage/v1/object/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  let rest = url.slice(idx + marker.length);
  if (rest.startsWith('public/')) rest = rest.slice('public/'.length);
  else if (rest.startsWith('sign/')) rest = rest.slice('sign/'.length);
  rest = rest.split('?')[0];
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  return {
    bucket: rest.slice(0, slash),
    path: decodeURIComponent(rest.slice(slash + 1)),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!callerProfile || callerProfile.role !== 'admin') {
      return json({ error: 'Forbidden: admin only' }, 403);
    }

    const body = await req.json().catch(() => null);
    const bikeId = typeof body?.bike_id === 'string' ? body.bike_id.trim() : '';
    const dryRun = body?.dry_run === true;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(bikeId)) return json({ error: 'A valid bike_id is required' }, 400);

    const { data: bike, error: bikeErr } = await admin
      .from('bikes')
      .select('id, reference, make, model, photos')
      .eq('id', bikeId)
      .maybeSingle();
    if (bikeErr) return json({ error: bikeErr.message }, 500);
    if (!bike) return json({ error: 'Bike not found' }, 404);

    // Gather related data
    const [jobsRes, inspectionsRes, eventsRes, componentsRes, collectionsRes, partsRes, strippedRes, invoicesRes] =
      await Promise.all([
        admin.from('jobs').select('id, photos_before, photos_after').eq('bike_id', bikeId),
        admin.from('inspections').select('id').eq('bike_id', bikeId),
        admin.from('fulfilment_events').select('id').eq('bike_id', bikeId),
        admin.from('bike_components').select('id').eq('bike_id', bikeId),
        admin.from('bike_collections').select('id').eq('bike_id', bikeId),
        admin.from('parts').select('id').eq('bike_id', bikeId),
        admin.from('parts').select('id').eq('stripped_from_bike_id', bikeId),
        admin.from('invoices').select('id, invoice_number').eq('bike_id', bikeId),
      ]);

    const jobs = jobsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];

    const photoUrls: string[] = [
      ...((bike.photos as string[] | null) ?? []),
      ...jobs.flatMap((j: any) => [...(j.photos_before ?? []), ...(j.photos_after ?? [])]),
    ].filter(Boolean);

    const counts = {
      jobs: jobs.length,
      inspections: inspectionsRes.data?.length ?? 0,
      stage_events: eventsRes.data?.length ?? 0,
      components: componentsRes.data?.length ?? 0,
      collections: collectionsRes.data?.length ?? 0,
      parts: (partsRes.data?.length ?? 0) + (strippedRes.data?.length ?? 0),
      photos: photoUrls.length,
      invoices: invoices.length,
    };

    if (invoices.length > 0) {
      return json(
        {
          error: 'blocked_by_invoice',
          message: `This bike has ${invoices.length} linked invoice(s) (${invoices
            .map((i: any) => i.invoice_number)
            .join(', ')}). Cancel or unlink the invoice before deleting the bike.`,
          counts,
        },
        409,
      );
    }

    if (dryRun) {
      return json({ ok: true, dry_run: true, counts, reference: bike.reference });
    }

    // Remove storage objects, grouped by bucket
    const byBucket = new Map<string, string[]>();
    for (const url of photoUrls) {
      const parsed = parseStorageUrl(url);
      if (!parsed) continue;
      const list = byBucket.get(parsed.bucket) ?? [];
      list.push(parsed.path);
      byBucket.set(parsed.bucket, list);
    }
    const storageErrors: string[] = [];
    for (const [bucket, paths] of byBucket) {
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) storageErrors.push(`${bucket}: ${error.message}`);
    }

    // Detach references that should survive
    await admin.from('social_posts').update({ vehicle_id: null }).eq('vehicle_id', bikeId);

    // Delete dependent rows
    const steps: Array<[string, Promise<{ error: any }>]> = [
      ['parts', admin.from('parts').delete().eq('bike_id', bikeId) as any],
      ['parts (stripped)', admin.from('parts').delete().eq('stripped_from_bike_id', bikeId) as any],
      ['jobs', admin.from('jobs').delete().eq('bike_id', bikeId) as any],
      ['inspections', admin.from('inspections').delete().eq('bike_id', bikeId) as any],
      ['fulfilment_events', admin.from('fulfilment_events').delete().eq('bike_id', bikeId) as any],
      ['bike_components', admin.from('bike_components').delete().eq('bike_id', bikeId) as any],
      ['bike_collections', admin.from('bike_collections').delete().eq('bike_id', bikeId) as any],
    ];
    for (const [label, p] of steps) {
      const { error } = await p;
      if (error) return json({ error: `Failed deleting ${label}: ${error.message}` }, 500);
    }

    const { error: delErr } = await admin.from('bikes').delete().eq('id', bikeId);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true, counts, storage_errors: storageErrors, reference: bike.reference });
  } catch (e: any) {
    return json({ error: e?.message ?? 'Unknown error' }, 500);
  }
});
