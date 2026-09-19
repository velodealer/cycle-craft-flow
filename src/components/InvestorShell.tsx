import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { VeloDealerLogo } from '@/components/brand/VeloDealerLogo';

/** Slim, read-only frame for investor screens — no sidebar, mobile first. */
export default function InvestorShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <Link to="/investor" aria-label="VeloDealer investor home">
            <VeloDealerLogo className="h-8" />
          </Link>
          <div className="flex items-center gap-3">
            {profile?.name ? (
              <span className="hidden text-sm text-muted-foreground sm:inline">{profile.name}</span>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 text-xs text-muted-foreground">
          Read-only investor view · VDMS Ltd
        </div>
      </footer>
    </div>
  );
}
