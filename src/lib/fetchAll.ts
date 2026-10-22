/** Fetches every row in batches so lists never stop silently at the 1,000-row server limit. */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  batch = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += batch) {
    const { data, error } = await build(from, from + batch - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < batch) break;
  }
  return out;
}
