import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { VeloDealerLogo } from '@/components/brand/VeloDealerLogo';

export const PUBLIC_NAV = [
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/updates', label: 'Updates' },
  { to: '/blog', label: 'Blog' },
  { to: '/about', label: 'About' },
  { to: '/careers', label: 'Careers' },
  { to: '/contact', label: 'Contact' },
];

function setMeta(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | VeloDealer`;
    setMeta('description', description);
    return () => {
      document.title = previousTitle;
    };
  }, [title, description]);
}

export function PublicHeader() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const homePath = profile?.role === 'investor' ? '/investor' : '/dashboard';

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex shrink-0 items-center" aria-label="VeloDealer home">
            <VeloDealerLogo variant="symbol" className="size-8 sm:hidden" />
            <VeloDealerLogo className="hidden h-9 sm:block" />
          </Link>

          <nav className="hidden flex-1 justify-center md:flex">
            <ul className="flex items-center gap-5 whitespace-nowrap text-sm lg:gap-6">
              {PUBLIC_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      isActive
                        ? 'font-medium text-foreground underline decoration-primary decoration-2 underline-offset-8'
                        : 'text-muted-foreground transition-colors hover:text-foreground'
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <Button size="sm" className="hidden sm:inline-flex" onClick={() => go(homePath)}>
                  Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {profile?.name?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{profile?.name}</p>
                        <p className="text-xs text-muted-foreground">{profile?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => go(homePath)}>
                      <User className="mr-2 h-4 w-4" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => signOut()}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={() => go('/auth')}
                >
                  Sign in
                </Button>
                <Button size="sm" onClick={() => go('/auth')}>
                  Get started
                </Button>
              </>
            )}

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <nav className="mt-8 flex flex-col gap-1">
                  {PUBLIC_NAV.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `rounded-md px-3 py-2 text-base ${
                          isActive
                            ? 'bg-muted font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>

                <Separator className="my-6" />

                <div className="flex flex-col gap-2">
                  {user ? (
                    <>
                      <Button onClick={() => go(homePath)}>
                        Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setOpen(false);
                          signOut();
                        }}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => go('/auth')}>Get started</Button>
                      <Button variant="outline" onClick={() => go('/auth')}>
                        Sign in
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  const year = new Date().getFullYear();

  const columns: { heading: string; links: { to?: string; label: string; note?: string }[] }[] = [
    {
      heading: 'Product',
      links: [
        { to: '/features', label: 'Features' },
        { to: '/pricing', label: 'Pricing' },
        { to: '/updates', label: 'Updates & roadmap' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { to: '/about', label: 'About' },
        { to: '/blog', label: 'Blog' },
        { to: '/careers', label: 'Careers' },
        { to: '/contact', label: 'Contact' },
      ],
    },
    {
      heading: 'Support',
      links: [
        { label: 'API documentation', note: 'Coming soon' },
        { to: '/privacy', label: 'Privacy Policy' },
        { to: '/terms', label: 'Terms of Service' },
        { to: '/cookies', label: 'Cookie Policy' },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8 grid gap-8 md:grid-cols-4">
          <div>
            <VeloDealerLogo className="mb-3 h-10" />
            <p className="text-sm text-muted-foreground">
              The complete bicycle dealer management system.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              VDMS Ltd, 30 Wake Green Road, Birmingham, B13 9PB
              <br />
              info@velodealer.com
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <h2 className="mb-4 font-semibold">{column.heading}</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to} className="transition-colors hover:text-foreground">
                        {link.label}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        {link.label}
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{link.note}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-6" />

        <p className="text-center text-sm text-muted-foreground">
          © {year} VeloDealer. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

interface PublicLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

export default function PublicLayout({ title, description, children }: PublicLayoutProps) {
  usePageMeta(title, description);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
