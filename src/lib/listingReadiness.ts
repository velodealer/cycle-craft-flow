// What a bike needs before it can go on eBay, Shopify or Squarespace.
import { BIKE_TYPES } from '@/lib/bikeSpec';

export type ReadinessInput = 'select' | 'text' | 'textarea' | 'number' | 'photos';

export interface ReadinessField {
  key: string;
  label: string;
  input: ReadinessInput;
  options?: { value: string; label: string }[];
  optional?: boolean;
  hint?: string;
}

export const MIN_LISTING_PHOTOS = 4;

export const CONDITION_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'as_new', label: 'As New' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

export const FRAME_MATERIALS = ['Carbon', 'Aluminium', 'Steel', 'Titanium', 'Chromoly', 'Other'].map((v) => ({ value: v, label: v }));

export const READINESS_FIELDS: ReadinessField[] = [
  { key: 'bike_type', label: 'Bike type', input: 'select', options: BIKE_TYPES },
  { key: 'size', label: 'Frame size', input: 'text', hint: 'e.g. 56cm or M' },
  { key: 'colour', label: 'Colour', input: 'text' },
  { key: 'frame_material', label: 'Frame material', input: 'select', options: FRAME_MATERIALS },
  { key: 'condition', label: 'Condition', input: 'select', options: CONDITION_OPTIONS },
  { key: 'condition_notes', label: 'Condition notes', input: 'textarea', hint: 'Marks, wear, recent servicing — buyers trust honest notes.' },
  { key: 'asking_price', label: 'Asking price (£)', input: 'number' },
  { key: 'photos', label: `Photos (at least ${MIN_LISTING_PHOTOS})`, input: 'photos' },
  { key: 'mpn', label: 'Manufacturer part number (MPN)', input: 'text', optional: true },
];

const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

export function isFieldMissing(bike: Record<string, any>, key: string): boolean {
  if (key === 'photos') return (bike.photos?.length ?? 0) < MIN_LISTING_PHOTOS;
  if (key === 'asking_price') return !(Number(bike.asking_price) > 0);
  return blank(bike[key]);
}

/** Missing listing details (required ones only unless includeOptional). */
export function missingListingFields(bike: Record<string, any>, includeOptional = false): ReadinessField[] {
  return READINESS_FIELDS.filter((f) => (includeOptional || !f.optional) && isFieldMissing(bike, f.key));
}

export function readinessScore(bike: Record<string, any>) {
  const req = READINESS_FIELDS.filter((f) => !f.optional);
  const missing = req.filter((f) => isFieldMissing(bike, f.key));
  return { filled: req.length - missing.length, total: req.length, missing };
}
