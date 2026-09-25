import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const API_BASE = 'https://api.99spokes.com/v1';
const API_KEY = Deno.env.get('NINETYNINE_SPOKES_API_KEY');

// '*' asks 99spokes for every field our API key is allowed to see, so we store
// the complete manufacturer record rather than a hand-picked subset.
const DETAIL_INCLUDE = '*';

const SEARCH_INCLUDE = ['thumbnailUrl', 'suspension', 'components', 'sizes', 'prices', 'colors'].join(',');

function partLabel(part: any): string | null {
  if (!part) return null;
  const label = [part.maker, part.model].filter(Boolean).join(' ').trim();
  return label || part.display || part.description || null;
}

const detailCache = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 10 * 60 * 1000;

function toItem(b: any) {
  const c = b.components || {};
  return {
    id: b.id, maker: b.maker, model: b.model, family: b.family, year: b.year,
    category: b.category, subcategory: b.subcategory, isEbike: b.isEbike, isFrameset: b.isFrameset,
    thumbnailUrl: b.thumbnailUrl ?? null, url: b.url ?? null,
    groupset: partLabel(c.rearDerailleur) ?? partLabel(c.shifters),
    wheelset: partLabel(c.rims),
    brakes: partLabel(c.brakes),
    cassette: partLabel(c.cassette),
    colours: Array.isArray(b.colors) ? b.colors.map((colour: any) => String(colour?.name ?? colour ?? '').trim()).filter(Boolean) : [],
  };
}

// Words that never appear in 99spokes bike names.
const COLOURS = new Set(['grey','gray','black','white','red','blue','green','yellow','orange','pink','purple','silver','gold','matt','matte','gloss','glossy','raw','navy','teal','olive','sand','stealth','colour','color','bronze','copper','chrome','brown','beige','cream','mint','khaki']);
const SIZE_RE = /^(xxs|xs|s|m|l|xl|xxl|\d{2}(\.\d)?cm|\d{2}("|in|inch)?|size)$/i;
const CODE_MAP: [RegExp, string][] = [
  [/^(rd-|st-|fd-|fc-|cs-|br-)?r9\d{3}$/i, 'Dura-Ace'],
  [/^(rd-|st-|fd-|fc-|cs-|br-)?r8\d{3}$/i, 'Ultegra'],
  [/^(rd-|st-|fd-|fc-|cs-|br-)?r7\d{3}$/i, '105'],
  [/^(rd-|st-|fd-|fc-|cs-|br-)?r[3-4]\d{3}$/i, ''],
  [/^(rd-|st-|fd-|fc-|cs-|br-)?r2\d{3}$/i, 'Claris'],
  [/^grx\d*$/i, 'GRX'],
  [/^(rd-|st-)?rx\d{3}$/i, 'GRX'],
  [/^(rd-|st-)?m9\d{3}$/i, 'XTR'],
  [/^(rd-|st-)?m8\d{3}$/i, 'XT'],
  [/^(rd-|st-)?m7\d{3}$/i, 'SLX'],
  [/^(rd-|st-)?m6\d{3}$/i, 'Deore'],
];

function normaliseQuery(q: string) {
  const dropped: string[] = [];
  const out: string[] = [];
  const have = new Set(q.toLowerCase().split(/\s+/));
  for (const w of q.split(/\s+/).filter(Boolean)) {
    const lw = w.toLowerCase().replace(/[(),]/g, '');
    if (COLOURS.has(lw) || SIZE_RE.test(lw)) { dropped.push(w); continue; }
    const hit = CODE_MAP.find(([re]) => re.test(lw));
    if (hit) {
      dropped.push(w);
      if (hit[1] && !have.has(hit[1].toLowerCase()) && !out.includes(hit[1])) out.push(hit[1]);
      continue;
    }
    out.push(w);
  }
  return { cleaned: out.join(' '), dropped };
}

type SpokesLink = { maker: string; year: string; slug: string };
function parseSpokesUrl(q: string): SpokesLink | null {
  const m = q.match(/99spokes\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?bikes\/([^/\s?#]+)\/(\d{4})\/([^/\s?#]+)/i);
  if (!m) return null;
  return { maker: decodeURIComponent(m[1]).replace(/-/g, ' '), year: m[2], slug: decodeURIComponent(m[3]).toLowerCase() };
}
function slugOf(url?: string | null) {
  return url ? (url.split('?')[0].replace(/\/$/, '').split('/').pop() || '').toLowerCase() : '';
}
function sameLink(url: string | null | undefined, link: SpokesLink) {
  const p = url ? parseSpokesUrl(url) : null;
  return !!p && p.year === link.year && p.slug === link.slug;
}

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
      const query = String(body?.query ?? '').trim().slice(0, 300);
      if (query.length < 2) return json({ items: [], total: 0 });
      // This API key is not permitted to use cursor paging — sending a `cursor`
      // parameter makes 99spokes reject the request. "Show more" instead asks
      // for a larger page of the same query (this key honours limits up to 200).
      const limit = Math.min(Math.max(Number(body?.limit ?? 20) || 20, 1), 200);

      const run = async (q: string) => {
        const params = new URLSearchParams({ q, queryMode: 'prefix', limit: String(limit), include: SEARCH_INCLUDE });
        const data = await spokes(`/bikes?${params.toString()}`);
        return {
          items: (data?.items ?? []) as any[],
          total: Number(data?.total ?? 0) || 0,
        };
      };

      // Pasted 99spokes link: search by maker/year/slug and pick the exact bike.
      const link = parseSpokesUrl(query);
      if (link) {
        const words = link.slug.replace(/-/g, ' ');
        let items = await run(`${link.maker} ${words}`).then((p) => p.items).catch(() => []);
        if (!items.length) items = await run(`${link.maker} ${words.split(' ').slice(0, 2).join(' ')}`).then((p) => p.items);
        const exact = items.filter((b) => sameLink(b.url, link) || (String(b.year) === link.year && slugOf(b.url) === link.slug));
        const chosen = exact.length ? exact : items.filter((b) => !link.year || String(b.year) === link.year);
        return json({ items: chosen.map(toItem), total: chosen.length, relaxed: !exact.length, droppedTerms: [] });
      }

      const { cleaned } = normaliseQuery(query);
      const attempts = [query];
      if (cleaned && cleaned.toLowerCase() !== query.toLowerCase()) attempts.push(cleaned);
      const tokens = (cleaned || query).split(/\s+/).filter(Boolean);
      for (let n = tokens.length - 1; n >= 2; n--) attempts.push(tokens.slice(0, n).join(' '));

      let items: any[] = [];
      let used = query;
      let total = 0;
      for (const q of [...new Set(attempts)]) {
        const page = await run(q);
        items = page.items;
        total = page.total;
        used = q;
        if (items.length) break;
      }
      const relaxed = used !== query;
      const usedWords = new Set(used.toLowerCase().split(/\s+/));
      const ignored = relaxed
        ? query.split(/\s+/).filter((w) => !usedWords.has(w.toLowerCase()))
        : [];
      return json({ items: items.map(toItem), total, relaxed, usedQuery: used, droppedTerms: ignored });
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
