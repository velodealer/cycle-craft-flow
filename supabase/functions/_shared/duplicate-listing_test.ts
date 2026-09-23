// Regression: a failed "does this listing already exist?" read must throw,
// never be treated as "not listed" (which would create a second offer/product).
import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { pushBikeToShopify } from './shopify-listing.ts';
import { pushBikeToSquarespace } from './squarespace-listing.ts';
import { pushBikeToEbay } from './ebay-listing.ts';

type Result = { data: any; error: any };

/** Chainable fake: every query builder call returns the chain; awaiting it yields the table's result. */
function fakeClient(tables: Record<string, Result>) {
  const writes: string[] = [];
  const from = (table: string) => {
    const chain: any = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          const r = tables[table] ?? { data: null, error: null };
          return (res: any, rej: any) => Promise.resolve(r).then(res, rej);
        }
        return (..._args: unknown[]) => {
          if (['insert', 'upsert', 'update', 'delete'].includes(String(prop))) writes.push(`${table}.${String(prop)}`);
          return chain;
        };
      },
    });
    return chain;
  };
  return { client: { from } as any, writes };
}

const READ_FAIL: Result = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } };
const FUTURE = new Date(Date.now() + 3_600_000);

function stubFetch() {
  const calls: string[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = ((input: any) => {
    calls.push(String(input));
    return Promise.resolve(new Response('{}', { status: 200 }));
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

const bike = { id: 'bike-1', make: 'Trek', model: 'Emonda', asking_price: 2400, photos: [], reference: 'BPS-TEST' } as any;

Deno.test('Shopify: failed existing-listing read throws and creates nothing', async () => {
  const { client, writes } = fakeClient({
    integrations: { data: { settings: { access_token: 't', shop_domain: 'x.myshopify.com' } }, error: null },
    shopify_listings: READ_FAIL,
  });
  const f = stubFetch();
  try {
    const err = await assertRejects(() => pushBikeToShopify(client, bike, 1));
    assert(String((err as Error).message).includes('existing Shopify listing'));
    assertEquals(f.calls.length, 0, 'no Shopify API call (so no productCreate)');
    assertEquals(writes, []);
  } finally { f.restore(); }
});

Deno.test('Squarespace: failed existing-listing read throws and creates nothing', async () => {
  const { client, writes } = fakeClient({
    bikes: { data: { ...bike, business_id: 'biz-1' }, error: null },
    integrations: { data: { is_active: true, settings: { access_token: 't', access_token_expires_at: FUTURE.getTime(), store_page_id: 'p1' } }, error: null },
    squarespace_listings: READ_FAIL,
  });
  const f = stubFetch();
  try {
    const err = await assertRejects(() => pushBikeToSquarespace(client, bike.id, 1));
    assert(String((err as Error).message).includes('existing Squarespace listing'));
    assertEquals(f.calls.length, 0, 'no Squarespace API call (so no product create)');
    assertEquals(writes, []);
  } finally { f.restore(); }
});

Deno.test('eBay: failed existing-listing read throws and creates no offer', async () => {
  const { client, writes } = fakeClient({
    bikes: { data: { business_id: 'biz-1' }, error: null },
    integrations: { data: { settings: { refresh_token: 'r', access_token: 't', access_token_expires_at: FUTURE.toISOString(), environment: 'sandbox' } }, error: null },
    ebay_listings: READ_FAIL,
  });
  const f = stubFetch();
  try {
    const err = await assertRejects(() => pushBikeToEbay(client, bike));
    assert(String((err as Error).message).includes('existing eBay listing'));
    assertEquals(f.calls.length, 0, 'no eBay API call (so no offer create)');
    assertEquals(writes, []);
  } finally { f.restore(); }
});
