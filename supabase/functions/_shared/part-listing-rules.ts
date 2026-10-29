// Pure rules for listing a stock part (no imports, so the app and tests share them).

export function partTitle(part: { listing_title?: string | null; brand?: string | null; description?: string | null }): string {
  const custom = String(part.listing_title ?? '').trim();
  if (custom) return custom;
  const brand = String(part.brand ?? '').trim();
  const desc = String(part.description ?? '').trim();
  // Don't repeat the brand when the description already starts with it.
  if (brand && desc.toLowerCase().startsWith(brand.toLowerCase())) return desc;
  return [brand, desc].filter(Boolean).join(' ');
}

export function partSku(part: { id: string }): string {
  return `PART-${String(part.id).replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

/** Reasons a part can't be listed yet. Empty = ready. */
export function partReadiness(part: {
  for_sale?: boolean | null; stock_status?: string | null; sale_price?: number | null;
  listing_photos?: string[] | null; listing_title?: string | null; brand?: string | null; description?: string | null;
}): string[] {
  const out: string[] = [];
  if (!part.for_sale) out.push('Tick "For sale online" on the part first.');
  if (part.stock_status !== 'in_stock') out.push('Only in-stock parts can be listed.');
  if (!(Number(part.sale_price) > 0)) out.push('Add a sale price.');
  if (!(part.listing_photos ?? []).length) out.push('Add at least one photo.');
  if (!partTitle(part)) out.push('Add a title or description.');
  return out;
}
