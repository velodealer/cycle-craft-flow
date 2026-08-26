import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Mobile-first card shell used as the stacked alternative to table rows.
 * Everything is visible without horizontal scrolling.
 */
export function ListCard({
  className,
  onClick,
  children,
}: {
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        'rounded-lg border bg-card text-card-foreground p-4 space-y-3 shadow-sm',
        onClick && 'cursor-pointer active:bg-accent/40 transition-colors',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ListCardRow({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 text-sm', className)}>
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium break-words">{value}</span>
    </div>
  );
}

export function ListCardActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 pt-1">{children}</div>;
}

export function ListEmpty({ message }: { message: string }) {
  return <p className="text-center text-sm text-muted-foreground py-8">{message}</p>;
}
