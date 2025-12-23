import { createClient } from '@/lib/supabase/server';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingHero } from '@/components/marketing/hero';
import { MarketingFeatures } from '@/components/marketing/features';
import { MarketingFooter } from '@/components/marketing/footer';

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;

  // Show landing page for everyone - CTAs change based on auth state
  return (
    <div className="min-h-screen bg-background text-white overflow-y-auto">
      <MarketingNavbar isAuthenticated={isAuthenticated} />
      <MarketingHero isAuthenticated={isAuthenticated} />
      <MarketingFeatures />
      <MarketingFooter />
    </div>
  );
}
