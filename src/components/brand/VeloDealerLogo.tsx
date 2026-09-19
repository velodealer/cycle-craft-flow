import { cn } from '@/lib/utils';
import iconDark from '@/assets/brand/icon-dark-512.png.asset.json';
import lockupDark from '@/assets/brand/lockup-horizontal-dark.png.asset.json';
import lockupLight from '@/assets/brand/lockup-horizontal-light.png.asset.json';

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
  const asset = variant === 'symbol' ? iconDark : surface === 'light' ? lockupLight : lockupDark;

  return (
    <img
      src={asset.url}
      alt="VeloDealer"
      className={cn(
        'block shrink-0 object-contain',
        variant === 'symbol' ? 'size-7' : 'h-8 w-auto min-w-[120px]',
        className,
      )}
    />
  );
}