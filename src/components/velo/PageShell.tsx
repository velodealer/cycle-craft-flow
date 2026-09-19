import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Density = 'desk' | 'bench';

interface PageHeaderProps {
  title: string;
  reference?: string;
  description?: string;
  actions?: ReactNode;
  density?: Density;
  className?: string;
}

/** Standard page heading: display title, optional ID-style reference, right-aligned actions. */
export function PageHeader({
  title,
  reference,
  description,
  actions,
  density = 'desk',
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between',
        density === 'bench' ? 'mb-6' : 'mb-5',
        className,
      )}
    >
      <div className="min-w-0">
        <h1
          className={cn(
            'font-display font-bold leading-tight text-foreground',
            density === 'bench' ? 'text-[30px]' : 'text-[26px]',
          )}
        >
          {title}
          {reference ? <span className="id-text ml-3 align-middle text-base text-muted-foreground">{reference}</span> : null}
        </h1>
        {description ? (
          <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface PanelProps {
  title?: string;
  /** Question-led or supporting line under the panel title. */
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** A flat panel surface: 1px rule, no shadow, no gradient. */
export function Panel({ title, hint, actions, children, className, bodyClassName }: PanelProps) {
  return (
    <section className={cn('rounded-[4px] border border-border bg-card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title ? <h2 className="font-display text-base font-semibold text-foreground">{title}</h2> : null}
            {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Small uppercase label used above figures and in table heads. */
export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('label-text text-muted-foreground', className)}>{children}</span>;
}

interface QueueRowProps {
  children: ReactNode;
  density?: Density;
  onClick?: () => void;
  className?: string;
}

/** A ruled queue row — 56px desk, 72px bench. Rows over cards. */
export function QueueRow({ children, density = 'desk', onClick, className }: QueueRowProps) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 border-b border-border px-3 text-left last:border-b-0',
        density === 'bench' ? 'min-h-[72px] py-3' : 'min-h-[56px] py-2',
        onClick && 'transition-colors hover:bg-muted/40',
        className,
      )}
    >
      {children}
    </Comp>
  );
}

/** Empty state: state the fact, then the fix. */
export function EmptyState({ fact, fix, action }: { fact: string; fix?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{fact}</p>
      {fix ? <p className="max-w-[60ch] text-sm text-muted-foreground">{fix}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
