import { cn } from '@/lib/utils';

type VeloDealerLogoProps = {
  variant?: 'symbol' | 'horizontal';
  surface?: 'dark' | 'light';
  className?: string;
};

export function VeloDealerLogo({
  variant = 'horizontal',
  surface = 'dark',
  className,
}: VeloDealerLogoProps) {
  if (variant === 'symbol') {
    return (
      <svg
        viewBox="0 0 128 128"
        role="img"
        aria-label="VeloDealer"
        className={cn('block size-7 shrink-0', className)}
      >
        <rect width="128" height="128" rx="6" className="fill-board" />
        <path d="M24 28H104V58H24Z" className="fill-chalk" />
        <path d="M24 66H104L98 102H30Z" className="fill-amber" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 560 128"
      role="img"
      aria-label="VeloDealer"
      className={cn(
        'block h-8 w-auto min-w-[120px] shrink-0',
        className,
      )}
    >
      {surface === 'dark' ? <rect width="560" height="128" className="fill-board" /> : null}
      <rect width="128" height="128" rx="6" className="fill-board" />
      <path d="M24 28H104V58H24Z" className="fill-chalk" />
      <path d="M24 66H104L98 102H30Z" className="fill-amber" />
      <text
        x="160"
        y="66"
        className={surface === 'light' ? 'fill-board font-display' : 'fill-chalk font-display'}
        fontSize="46"
        fontWeight="700"
      >
        VeloDealer
      </text>
      <text
        x="162"
        y="93"
        className={surface === 'light' ? 'fill-muted-foreground font-sans' : 'fill-chalk-dim font-sans'}
        fontSize="13"
        fontWeight="500"
        letterSpacing="2.2"
      >
        VELO DEALER MANAGEMENT SYSTEM
      </text>
    </svg>
  );
}