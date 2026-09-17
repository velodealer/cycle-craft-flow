import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bike, ArrowRight, Menu, User, LogOut } from 'lucide-react';
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
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-foreground">
            <Bike className="h-6 w-6 text-primary" />
            <span className="text-xl">VeloDealer</span>
          </Link>

          <nav className="order-last w-full overflow-x-auto md:order-none md:w-auto">
            <ul className="flex items-center gap-4 text-sm whitespace-nowrap">
              {PUBLIC_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      isActive
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground transition-colors hover:text-foreground'
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Button onClick={() => navigate('/dashboard')} size="sm">
                Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
                  Sign in
                </Button>
                <Button size="sm" onClick={() => navigate('/auth')}>
                  Get started
                </Button>
              </>
            )}
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
            <div className="mb-3 flex items-center gap-2">
              <Bike className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">VeloDealer</span>
            </div>
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
