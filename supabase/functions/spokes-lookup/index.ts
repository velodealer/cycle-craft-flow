import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const API_BASE = 'https://api.99spokes.com/v1';
const API_KEY = Deno.env.get('NINETYNINE_SPOKES_API_KEY');

const DETAIL_INCLUDE = [
  'thumbnailUrl',
  'shifting',
  'weight',
  'wheels',
  'tireClearance',
  'gearing',
  'suspension',
  'components',
  'sizes',
  'images',
  'colors',
].join(',');

const SEARCH_INCLUDE = ['thumbnailUrl', 'suspension', 'components'].join(',');

function partLabel(part: any): string | null {
  if (!part) return null;
  const label = [part.maker, part.model].filter(Boolean).join(' ').trim();
  return label || part.display || part.description || null;
}

const detailCache = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 10 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function spokes(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const details = await res.text();
    console.error(`99spokes request failed [${res.status}] ${path}: ${details}`);
    throw Object.assign(new Error('99spokes request failed'), { status: res.status, details });
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!API_KEY) return json({ error: '99spokes API key is not configured' }, 500);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');

    if (action === 'search') {
      const query = String(body?.query ?? '').trim();
      if (query.length < 2) return json({ items: [], total: 0 });
      const limit = Math.min(Math.max(Number(body?.limit ?? 20) || 20, 1), 50);
      const params = new URLSearchParams({
        q: query,
        queryMode: 'prefix',
        limit: String(limit),
        include: SEARCH_INCLUDE,
      });
      const data = await spokes(`/bikes?${params.toString()}`);
      const items = (data?.items ?? []).map((b: any) => {
        const c = b.components || {};
        return {
          id: b.id,
          maker: b.maker,
          model: b.model,
          family: b.family,
          year: b.year,
          category: b.category,
          subcategory: b.subcategory,
          isEbike: b.isEbike,
          isFrameset: b.isFrameset,
          thumbnailUrl: b.thumbnailUrl ?? null,
          url: b.url ?? null,
          groupset: partLabel(c.rearDerailleur) ?? partLabel(c.shifters),
          wheelset: partLabel(c.rims),
        };
      });
      return json({ items, total: data?.total ?? items.length });
    }

    if (action === 'get') {
      const id = String(body?.id ?? '').trim();
      if (!id) return json({ error: 'id is required' }, 400);

      const cached = detailCache.get(id);
      if (cached && Date.now() - cached.at < CACHE_MS) return json(cached.data);

      const bike = await spokes(`/bikes/${encodeURIComponent(id)}?include=${DETAIL_INCLUDE}`);
      const payload = { bike };
      detailCache.set(id, { at: Date.now(), data: payload });
      return json(payload);
    }

    return json({ error: `Unknown action: ${action || '(none)'}` }, 400);
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return json({ error: err?.message ?? 'Unexpected error', details: err?.details ?? null }, status);
  }
});
