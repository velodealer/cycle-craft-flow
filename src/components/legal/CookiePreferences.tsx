import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const SIDEBAR_COOKIE = 'sidebar:state';

function readSidebarCookie() {
  return document.cookie.split('; ').some((c) => c.startsWith(`${SIDEBAR_COOKIE}=`));
}

/** Working preference controls for the only two things VeloDealer stores on your device. */
export default function CookiePreferences() {
  const [menuStored, setMenuStored] = useState(false);

  useEffect(() => {
    setMenuStored(readSidebarCookie());
  }, []);

  const toggleMenu = (enabled: boolean) => {
    if (enabled) {
      document.cookie = `${SIDEBAR_COOKIE}=true; path=/; max-age=${60 * 60 * 24 * 7}`;
      setMenuStored(true);
      toast.success('Your menu preference will be remembered on this device.');
    } else {
      document.cookie = `${SIDEBAR_COOKIE}=; path=/; max-age=0`;
      setMenuStored(false);
      toast.success('Menu preference removed from this device.');
    }
  };

  const clearAll = () => {
    document.cookie = `${SIDEBAR_COOKIE}=; path=/; max-age=0`;
    setMenuStored(false);
    toast.success('Stored preferences cleared. You stay signed in.');
  };

  return (
    <div className="not-prose rounded-[4px] border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Sign-in session</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Strictly necessary. Removing it signs you out; use Sign out in the app.
          </p>
        </div>
        <span className="label-text text-muted-foreground">Always on</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Remember menu state</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Keeps the side menu expanded or collapsed the way you left it. No personal information.
          </p>
        </div>
        <Switch checked={menuStored} onCheckedChange={toggleMenu} aria-label="Remember menu state" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
        <p className="text-sm text-muted-foreground">Clear everything optional stored on this device.</p>
        <Button variant="outline" size="sm" onClick={clearAll}>
          Clear preferences
        </Button>
      </div>
    </div>
  );
}
