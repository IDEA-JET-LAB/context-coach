import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MarketingNavbarProps {
  isAuthenticated?: boolean;
}

export function MarketingNavbar({ isAuthenticated = false }: MarketingNavbarProps) {
  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-16 max-w-7xl mx-auto px-6 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold tracking-tight text-white">
            Contextor
          </span>
        </Link>

        {/* Navigation Links - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#pricing" className="hover:text-white transition-colors">
            Pricing
          </a>
          <a href="/docs" className="hover:text-white transition-colors">
            Docs
          </a>
        </div>

        {/* Auth Buttons - Show different options based on auth state */}
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <Button asChild className="bg-primary hover:bg-primary/80 text-white">
              <Link href="/prompts">Go to Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild className="text-muted-foreground hover:text-white">
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild className="bg-primary hover:bg-primary/80 text-white">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
