/**
 * Human-readable bike reference helpers.
 * Format: PREFIX-BRA-1234 (account prefix, 3 letters of brand, last 4 of serial).
 */

export const DEFAULT_BIKE_REFERENCE_PREFIX = 'BWC';

export function buildBikeReference(
  prefix: string,
  make?: string | null,
  serial?: string | null,
  bikeId?: string | null,
): string {
  let p = (prefix || DEFAULT_BIKE_REFERENCE_PREFIX).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!p) p = DEFAULT_BIKE_REFERENCE_PREFIX;
  p = p.slice(0, 6);

  const brand = ((make || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) + 'XXX').slice(0, 3);

  const raw = (serial || '').trim() || (bikeId || '').replace(/-/g, '');
  const suffix = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-4).padStart(4, '0');

  return `${p}-${brand}-${suffix}`;
}

/** Display reference for a bike, falling back to a short id when not yet generated. */
export function bikeRef(bike: { reference?: string | null; id: string }): string {
  return bike.reference || bike.id.slice(0, 8).toUpperCase();
}
