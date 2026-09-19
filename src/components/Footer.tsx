import { Link } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { VeloDealerLogo } from '@/components/brand/VeloDealerLogo';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Brand */}
          <div className="flex items-center">
            <VeloDealerLogo className="h-9" />
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center md:justify-end space-x-6 text-sm">
            <Link
              to="/contact"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Support
            </Link>
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              API documentation
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">Coming soon</span>
            </span>
            <Link
              to="/pricing"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              to="/privacy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              to="/cookies"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Cookie Policy
            </Link>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Copyright */}
        <div className="text-center text-sm text-muted-foreground">
          © {currentYear} VeloDealer. All rights reserved.
        </div>
      </div>
    </footer>
  );
}