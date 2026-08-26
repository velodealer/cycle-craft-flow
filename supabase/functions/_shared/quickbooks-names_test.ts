import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  findOrCreateCustomer,
  findOrCreateItem,
  isDuplicateNameError,
} from './quickbooks-names.ts';

const DUP = new Error(
  'QuickBooks request failed [400]: {"Fault":{"Error":[{"Message":"Duplicate Name Exists Error","code":"6240"}]}}',
);

Deno.test('detects duplicate-name faults', () => {
  assertEquals(isDuplicateNameError(DUP), true);
  assertEquals(isDuplicateNameError(new Error('boom')), false);
});

Deno.test('reuses an existing active customer, case/space insensitive', async () => {
  const calls: string[] = [];
  const id = await findOrCreateCustomer(async (path) => {
    calls.push(path);
    return { QueryResponse: { Customer: [{ Id: '17', DisplayName: 'broximo  Prestige Steeds', Active: true }] } };
  }, { name: 'Broximo Prestige Steeds' });
  assertEquals(id, '17');
  assertEquals(calls.length, 1);
  assertStringIncludes(decodeURIComponent(calls[0]), 'Active in (true, false)');
});

Deno.test('reactivates an inactive customer instead of creating a duplicate', async () => {
  const methods: string[] = [];
  const id = await findOrCreateCustomer(async (path, init) => {
    methods.push(`${init?.method ?? 'GET'} ${path.split('?')[0]}`);
    if (!init) {
      return { QueryResponse: { Customer: [{ Id: '9', DisplayName: 'Jane Doe', Active: false, SyncToken: '3' }] } };
    }
    return { Customer: { Id: '9' } };
  }, { name: 'Jane Doe' });
  assertEquals(id, '9');
  assertEquals(methods, ['GET /query', 'POST /customer']);
});

Deno.test('re-queries after a 6240 race and uses the found customer', async () => {
  let queries = 0;
  const id = await findOrCreateCustomer(async (_path, init) => {
    if (init?.method === 'POST') throw DUP;
    queries++;
    return queries === 1
      ? { QueryResponse: {} }
      : { QueryResponse: { Customer: [{ Id: '42', DisplayName: 'Race Co', Active: true }] } };
  }, { name: 'Race Co' });
  assertEquals(id, '42');
});

Deno.test('falls back to a suffixed name when the name is taken by another record type', async () => {
  const created: string[] = [];
  const id = await findOrCreateCustomer(async (path, init) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      created.push(body.DisplayName);
      if (body.DisplayName === 'Ghost Ltd') throw DUP;
      return { Customer: { Id: '77' } };
    }
    return { QueryResponse: {} };
  }, { name: 'Ghost Ltd' });
  assertEquals(id, '77');
  assertEquals(created, ['Ghost Ltd', 'Ghost Ltd (VeloDealer)']);
});

Deno.test('creates the sales item when none exists', async () => {
  const id = await findOrCreateItem(async (_path, init) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      assertEquals(body.IncomeAccountRef.value, '4000');
      return { Item: { Id: '5' } };
    }
    return { QueryResponse: {} };
  }, '4000');
  assertEquals(id, '5');
});
