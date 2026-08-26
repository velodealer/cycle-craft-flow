// Duplicate-safe "find or create" helpers for QuickBooks named records
// (customers, items). QuickBooks rejects a create when the display name
// collides with ANY existing record — including inactive ones — with
// validation error 6240 "Duplicate Name Exists Error".

export type QboFetcher = (path: string, init?: RequestInit) => Promise<any>;

export interface QboCustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export function isDuplicateNameError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /"code"\s*:\s*"?6240"?/.test(message) || /Duplicate Name Exists/i.test(message);
}

/** Strips characters that would break a QBO query string literal. */
export function escapeQueryLiteral(value: string): string {
  return value.replace(/['\\]/g, '').trim();
}

export function normaliseName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Candidate display names to try when the preferred one is already taken. */
export function fallbackNames(name: string): string[] {
  const base = name.trim();
  return [`${base} (VeloDealer)`, `${base} (VeloDealer 2)`];
}

async function queryByName(
  fetcher: QboFetcher,
  entity: 'Customer' | 'Item',
  nameField: 'DisplayName' | 'Name',
  name: string,
) {
  const literal = escapeQueryLiteral(name);
  if (!literal) return [];
  const query = encodeURIComponent(
    `select * from ${entity} where ${nameField} like '%${literal}%' and Active in (true, false) maxresults 50`,
  );
  const found = await fetcher(`/query?query=${query}&minorversion=70`);
  const rows: any[] = found?.QueryResponse?.[entity] ?? [];
  const target = normaliseName(name);
  return rows.filter((row) => normaliseName(String(row?.[nameField] ?? '')) === target);
}

async function reactivate(
  fetcher: QboFetcher,
  entity: 'customer' | 'item',
  record: any,
): Promise<string> {
  const key = entity === 'customer' ? 'Customer' : 'Item';
  const updated = await fetcher(`/${entity}?minorversion=70`, {
    method: 'POST',
    body: JSON.stringify({
      Id: record.Id,
      SyncToken: record.SyncToken ?? '0',
      sparse: true,
      Active: true,
    }),
  });
  return String(updated?.[key]?.Id ?? record.Id);
}

export async function findOrCreateCustomer(
  fetcher: QboFetcher,
  customer: QboCustomerInput,
): Promise<string> {
  const matches = await queryByName(fetcher, 'Customer', 'DisplayName', customer.name);
  const active = matches.find((row) => row.Active !== false);
  if (active) return String(active.Id);
  if (matches.length > 0) return await reactivate(fetcher, 'customer', matches[0]);

  const payload = (displayName: string) => ({
    DisplayName: displayName,
    ...(customer.email ? { PrimaryEmailAddr: { Address: customer.email } } : {}),
    ...(customer.phone ? { PrimaryPhone: { FreeFormNumber: customer.phone } } : {}),
    ...(customer.address ? { BillAddr: { Line1: customer.address } } : {}),
  });

  const names = [customer.name, ...fallbackNames(customer.name)];
  let lastError: unknown;
  for (let i = 0; i < names.length; i++) {
    try {
      const created = await fetcher('/customer?minorversion=70', {
        method: 'POST',
        body: JSON.stringify(payload(names[i])),
      });
      const id = created?.Customer?.Id;
      if (id) return String(id);
      throw new Error('QuickBooks did not return a customer id');
    } catch (error) {
      lastError = error;
      if (!isDuplicateNameError(error)) throw error;
      // A concurrent/hidden record owns this name — re-query before falling back.
      const retry = await queryByName(fetcher, 'Customer', 'DisplayName', names[i]);
      const found = retry.find((row) => row.Active !== false);
      if (found) return String(found.Id);
      if (retry.length > 0) return await reactivate(fetcher, 'customer', retry[0]);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function findOrCreateItem(
  fetcher: QboFetcher,
  incomeAccountId: string,
  name = 'Bicycle sale',
): Promise<string> {
  const matches = await queryByName(fetcher, 'Item', 'Name', name);
  const active = matches.find((row) => row.Active !== false);
  if (active) return String(active.Id);
  if (matches.length > 0) return await reactivate(fetcher, 'item', matches[0]);

  const names = [name, ...fallbackNames(name)];
  let lastError: unknown;
  for (let i = 0; i < names.length; i++) {
    try {
      const created = await fetcher('/item?minorversion=70', {
        method: 'POST',
        body: JSON.stringify({
          Name: names[i],
          Type: 'Service',
          IncomeAccountRef: { value: incomeAccountId },
        }),
      });
      const id = created?.Item?.Id;
      if (id) return String(id);
      throw new Error('QuickBooks did not return an item id');
    } catch (error) {
      lastError = error;
      if (!isDuplicateNameError(error)) throw error;
      const retry = await queryByName(fetcher, 'Item', 'Name', names[i]);
      const found = retry.find((row) => row.Active !== false);
      if (found) return String(found.Id);
      if (retry.length > 0) return await reactivate(fetcher, 'item', retry[0]);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
