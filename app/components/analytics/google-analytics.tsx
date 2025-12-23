'use client';

import Script from 'next/script';

/**
 * Google Analytics 4 component using Next.js Script for optimal loading.
 *
 * Features:
 * - Only loads in production environment (prevents test data pollution)
 * - Uses afterInteractive strategy for optimal page load performance
 * - Reads tracking ID from NEXT_PUBLIC_GA_MEASUREMENT_ID environment variable
 *
 * Usage:
 * Add to root layout:
 * ```tsx
 * import { GoogleAnalytics } from '@/components/analytics/google-analytics';
 * // Then in body: <GoogleAnalytics />
 * ```
 */
export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  // Don't load in development or if no ID configured
  if (!gaId || process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
