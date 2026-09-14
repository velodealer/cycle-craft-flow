// Shared extraction of Typeform answers into submission columns.
// Used by the webhook receiver and the "fetch recent responses" recovery action.

export interface Answer {
  type?: string;
  field?: { id?: string; ref?: string };
  text?: string;
  email?: string;
  phone_number?: string;
  number?: number;
  choice?: { label?: string; other?: string; choices?: string[] };
  choices?: { labels?: string[]; other?: string };
  boolean?: boolean;
  date?: string;
  file_url?: string;
  url?: string;
  payment?: { amount?: number };
}

/** Picks the best string value from a Typeform answer. */
export function answerText(a: Answer | undefined): string {
  if (!a) return '';
  if (a.text) return a.text;
  if (a.email) return a.email;
  if (a.phone_number) return a.phone_number;
  if (a.choice) return a.choice.other || a.choice.label || (a.choice.choices ?? []).join(', ') || '';
  if (a.choices) return a.choices.other || (a.choices.labels ?? []).join(', ') || '';
  if (typeof a.number === 'number') return String(a.number);
  if (a.boolean !== undefined) return a.boolean ? 'Yes' : 'No';
  if (a.date) return a.date;
  if (a.file_url) return a.file_url;
  return '';
}

export interface Extracted {
  submission_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  postcode: string | null;
  bike_make: string | null;
  bike_model: string | null;
  bike_year: number | null;
  frame_number: string | null;
  asking_price: number | null;
  photo_urls: string[];
}

/** Maps a Typeform `form_response` object onto our submission columns. */
export function extractFromFormResponse(
  formResponse: any,
  fieldMap: Record<string, string>,
): Extracted {
  const answers: Answer[] = formResponse?.answers ?? [];
  const byFieldId = new Map<string, Answer>();
  for (const a of answers) {
    if (a.field?.ref) byFieldId.set(a.field.ref, a);
    if (a.field?.id) byFieldId.set(a.field.id, a);
  }
  const hidden: Record<string, string> = formResponse?.hidden ?? {};

  const get = (key: string): Answer | undefined => {
    const ref = fieldMap[key];
    return ref ? byFieldId.get(ref) : undefined;
  };
  const str = (key: string): string => answerText(get(key)) || (hidden[key] ?? '');

  const photoUrls: string[] = [];
  for (const a of answers) {
    const url = a.file_url || (a.type === 'file_url' ? a.url : undefined);
    if (url) photoUrls.push(url);
  }

  const yearRaw = str('bike_year');
  const year = yearRaw ? parseInt(yearRaw.replace(/[^0-9]/g, ''), 10) : NaN;
  const priceRaw = str('asking_price');
  const price = priceRaw ? parseFloat(priceRaw.replace(/[^0-9.]/g, '')) : NaN;

  const typeRaw = (str('submission_type') || '').toLowerCase();
  let submissionType: string | null = null;
  if (typeRaw.includes('part')) submissionType = 'part_exchange';
  else if (typeRaw.includes('sell') || typeRaw.includes('sale')) submissionType = 'sale';

  return {
    submission_type: submissionType,
    customer_name: str('customer_name') || null,
    customer_email: str('customer_email') || null,
    customer_phone: str('customer_phone') || null,
    postcode: str('postcode') || null,
    bike_make: str('bike_make') || null,
    bike_model: str('bike_model') || null,
    bike_year: Number.isFinite(year) && year > 1900 && year < 2200 ? year : null,
    frame_number: str('frame_number') || null,
    asking_price: Number.isFinite(price) && price > 0 ? price : null,
    photo_urls: photoUrls,
  };
}
