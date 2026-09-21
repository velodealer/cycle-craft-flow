/**
 * Read-only list of the extra manufacturer details held on a component
 * (everything the catalogue publishes beyond brand, model, MPN and weight).
 */

const humanise = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

const display = (value: any): string => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(display).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => `${humanise(k)}: ${display(v)}`)
      .filter(Boolean)
      .join(' · ');
  }
  return String(value);
};

interface Props {
  attributes?: any;
  className?: string;
}

export default function ComponentAttributes({ attributes, className }: Props) {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return null;
  const entries = Object.entries(attributes).filter(([, v]) => display(v) !== '');
  if (entries.length === 0) return null;

  return (
    <dl className={`grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs ${className || ''}`}>
      {entries.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-border/50 py-1">
          <dt className="text-muted-foreground">{humanise(k)}</dt>
          <dd className="text-right break-words">{display(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
