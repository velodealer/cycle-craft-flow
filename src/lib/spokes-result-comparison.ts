export interface ComparableSpokesResult {
  maker?: string | null;
  model?: string | null;
  family?: string | null;
  year?: number | null;
  brakes?: string | null;
  cassette?: string | null;
  colours?: string[] | null;
}

function clean(value?: string | null): string {
  return String(value ?? '').trim();
}

export function spokesModelName(result: ComparableSpokesResult): string {
  const family = clean(result.family);
  const model = clean(result.model);
  if (!family || model.toLocaleLowerCase().startsWith(`${family.toLocaleLowerCase()} `)) return model || family;
  return `${family} ${model}`.trim();
}

export function spokesResultTitle(result: ComparableSpokesResult): string {
  return [result.year, clean(result.maker), spokesModelName(result)].filter(Boolean).join(' ');
}

export function similarSpokesKey(result: ComparableSpokesResult): string {
  const model = spokesModelName(result)
    .toLocaleLowerCase()
    .replace(/\bdisc\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return [result.year ?? '', clean(result.maker).toLocaleLowerCase(), model].join('|');
}

function normalised(value?: string | null): string {
  return clean(value).toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function differingDetails(group: ComparableSpokesResult[]) {
  const differs = (field: 'brakes' | 'cassette') => new Set(group.map((item) => normalised(item[field]))).size > 1;
  return {
    brakes: group.length > 1 && differs('brakes'),
    cassette: group.length > 1 && differs('cassette'),
    showColour: group.length > 1,
  };
}

export function colourSummary(colours?: string[] | null): string {
  const values = (colours ?? []).map(clean).filter(Boolean);
  return values.length ? values.join(', ') : 'Colour not supplied';
}