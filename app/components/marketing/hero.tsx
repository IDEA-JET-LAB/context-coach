import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface MarketingHeroProps {
  isAuthenticated?: boolean;
}

export function MarketingHero({ isAuthenticated = false }: MarketingHeroProps) {
  return (
    <section className="text-center pt-24 px-6 pb-12">
      {/* Headline */}
      <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500">
        Your Context Tutor
      </h1>

      {/* Subheadline */}
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
        Help your team master AI prompting. Capture, analyze, and improve
        every prompt with real-time feedback and scoring.
      </p>

      {/* CTAs - Show different options based on auth state */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {isAuthenticated ? (
          <Button
            asChild
            size="lg"
            className="bg-primary hover:bg-primary/80 text-white px-8 py-6 text-base font-medium transition-all transform hover:scale-105"
          >
            <Link href="/prompts">Go to Dashboard</Link>
          </Button>
        ) : (
          <Button
            asChild
            size="lg"
            className="bg-primary hover:bg-primary/80 text-white px-8 py-6 text-base font-medium transition-all transform hover:scale-105"
          >
            <Link href="/signup">Get Started Free</Link>
          </Button>
        )}
        <Button
          variant="outline"
          size="lg"
          className="bg-transparent border-border text-white px-8 py-6 text-base font-medium hover:bg-white/5"
        >
          See Demo
        </Button>
      </div>

      {/* Dashboard Preview Mockup */}
      <div className="mt-20 max-w-5xl mx-auto border border-border rounded-xl overflow-hidden shadow-2xl shadow-primary/10 bg-card p-2">
        <div className="rounded-lg bg-card aspect-video flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-2xl font-medium mb-2">Dashboard Preview</p>
            <p className="text-sm">Your prompts and analytics will appear here</p>
          </div>
        </div>
      </div>
    </section>
  );
}
