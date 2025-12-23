import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingHero } from '@/components/marketing/hero';
import { MarketingFeatures } from '@/components/marketing/features';
import { MarketingFooter } from '@/components/marketing/footer';
import { AccountDeletedHandler } from '@/components/marketing/account-deleted-handler';

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;

  // Show landing page for everyone - CTAs change based on auth state
  return (
    <div className="min-h-screen bg-background text-white overflow-y-auto">
      <Suspense fallback={null}>
        <AccountDeletedHandler />
      </Suspense>
      <MarketingNavbar isAuthenticated={isAuthenticated} />
      <MarketingHero isAuthenticated={isAuthenticated} />
      <MarketingFeatures />
      <MarketingFooter />
    </div>
  );
}
