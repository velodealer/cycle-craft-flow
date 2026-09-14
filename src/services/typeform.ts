import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface TypeformStatus {
  connected: boolean;
  account_name: string | null;
  connected_at: string | null;
  redirect_uri: string;
}

export interface TypeformForm {
  id: string;
  title: string;
  enabled: boolean;
  field_map: Record<string, string>;
}

export interface TypeformField {
  ref: string;
  title: string;
  type: string;
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let message = details;
    try {
      const parsed = JSON.parse(details);
      message = parsed.error || details;
    } catch { /* keep raw text */ }
    throw new Error(message);
  }
  return data as T;
}

export const getTypeformStatus = () => invoke<TypeformStatus>('typeform-oauth', { action: 'status' });
export const getTypeformAuthUrl = () =>
  invoke<{ url: string }>('typeform-oauth', { action: 'auth_url', app_origin: window.location.origin });
export const listTypeformForms = () => invoke<{ forms: TypeformForm[] }>('typeform-oauth', { action: 'forms' });
export const listTypeformFormFields = (formId: string) =>
  invoke<{ fields: TypeformField[] }>('typeform-oauth', { action: 'form_fields', form_id: formId });
export const setTypeformFormEnabled = (formId: string, title: string, enabled: boolean) =>
  invoke<{ ok: true }>('typeform-oauth', { action: 'set_form_enabled', form_id: formId, title, enabled });
export const saveTypeformFieldMap = (formId: string, title: string, fieldMap: Record<string, string>) =>
  invoke<{ ok: true }>('typeform-oauth', { action: 'save_field_map', form_id: formId, title, field_map: fieldMap });
export const disconnectTypeform = () => invoke<{ ok: true }>('typeform-oauth', { action: 'disconnect' });

export const TYPEFORM_FIELD_KEYS: { key: string; label: string; hint: string }[] = [
  { key: 'submission_type', label: 'Submission type', hint: 'Selling or part exchange — e.g. a choice question.' },
  { key: 'customer_name', label: 'Customer name', hint: 'Full name of the person submitting.' },
  { key: 'customer_email', label: 'Customer email', hint: 'Email address for follow-up.' },
  { key: 'customer_phone', label: 'Customer phone', hint: 'Phone number for follow-up.' },
  { key: 'postcode', label: 'Postcode', hint: 'Used when booking a collection.' },
  { key: 'bike_make', label: 'Bike make', hint: 'Brand of the bike, e.g. Trek.' },
  { key: 'bike_model', label: 'Bike model', hint: 'Model of the bike.' },
  { key: 'bike_year', label: 'Bike year', hint: 'Year of manufacture.' },
  { key: 'frame_number', label: 'Frame / serial number', hint: 'Frame number if the customer knows it.' },
  { key: 'asking_price', label: 'Asking price', hint: 'Price the customer wants for the bike.' },
];

export interface TypeformSubmission {
  id: string;
  form_id: string;
  response_id: string;
  submitted_at: string;
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
  status: string;
  bike_id: string | null;
  notes: string | null;
  raw_payload: any;
}

export async function listSubmissions(statusFilter: string, textFilter: string): Promise<TypeformSubmission[]> {
  let query = supabase
    .from('typeform_submissions')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(200);
  if (statusFilter !== 'all') query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as TypeformSubmission[];
  const term = textFilter.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((s) =>
    [s.customer_name, s.bike_make, s.bike_model, s.frame_number, s.customer_email]
      .some((v) => (v ?? '').toLowerCase().includes(term)),
  );
}

export const updateSubmissionStatus = async (id: string, status: string, notes?: string | null) => {
  const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', (await supabase.auth.getUser()).data.user!.id).maybeSingle();
  const update: Record<string, unknown> = { status };
  if (notes !== undefined) update.notes = notes;
  if (status !== 'new') update.reviewed_by = (profile as { id: string } | null)?.id ?? null;
  const { error } = await supabase.from('typeform_submissions').update(update).eq('id', id);
  if (error) throw error;
};

/** Creates an external owner for the customer, matching on email when available. */
async function ensureExternalOwner(sub: TypeformSubmission): Promise<string | null> {
  if (!sub.customer_name && !sub.customer_email) return null;

  if (sub.customer_email) {
    const { data: existing } = await supabase
      .from('external_owners')
      .select('id')
      .eq('email', sub.customer_email)
      .maybeSingle();
    if (existing) return (existing as { id: string }).id;
  }

  const { data, error } = await supabase
    .from('external_owners')
    .insert({
      name: sub.customer_name || sub.customer_email || 'Unknown',
      email: sub.customer_email || null,
      phone: sub.customer_phone || null,
      address: sub.postcode || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Creates a bike from a submission and links the submission to it. */
export async function convertSubmissionToBike(sub: TypeformSubmission): Promise<string> {
  if (!sub.bike_make || !sub.bike_model) {
    throw new Error('The submission is missing the bike make and model. Check the field mapping.');
  }

  const ownerId = await ensureExternalOwner(sub);

  const { data: bike, error } = await supabase
    .from('bikes')
    .insert({
      make: sub.bike_make,
      model: sub.bike_model,
      year: sub.bike_year,
      frame_number: sub.frame_number,
      serial_number: sub.frame_number,
      asking_price: sub.asking_price,
      photos: sub.photo_urls ?? [],
      source: 'owned',
      status: 'pending_intake',
      finance_scheme: 'margin_scheme',
      fulfillment_type: 'stocked_by_me',
      acquired_via: sub.submission_type === 'part_exchange' ? 'part_exchange' : 'sale',
      external_owner_id: ownerId,
      intake_date: new Date().toISOString(),
      description: sub.submission_type === 'part_exchange'
        ? 'Part exchange enquiry via Typeform'
        : 'Sale enquiry via Typeform',
    })
    .select('id')
    .single();
  if (error) throw error;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', (await supabase.auth.getUser()).data.user!.id)
    .maybeSingle();

  const { error: updateError } = await supabase
    .from('typeform_submissions')
    .update({
      status: 'converted',
      bike_id: (bike as { id: string }).id,
      reviewed_by: (profile as { id: string } | null)?.id ?? null,
    })
    .eq('id', sub.id);
  if (updateError) throw updateError;

  return (bike as { id: string }).id;
}
