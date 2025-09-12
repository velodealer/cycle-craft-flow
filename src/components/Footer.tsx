import { Separator } from '@/components/ui/separator';
import { Bike } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Brand */}
          <div className="flex items-center space-x-2">
            <Bike className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">BPS</span>
            <span className="text-sm text-muted-foreground">Bike Processing System</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center md:justify-end space-x-6 text-sm">
            <a 
              href="#" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Support
            </a>
            <a 
              href="#" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Documentation
            </a>
            <a 
              href="#" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
            <a 
              href="#" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Copyright */}
        <div className="text-center text-sm text-muted-foreground">
          © {currentYear} BPS - Bike Processing System. All rights reserved.
        </div>
      </div>
    </footer>
  );
}