import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Providers } from '@/components/providers';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import './globals.css';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://127.0.0.1:3050';

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'Contextor - Prompt Journaling for AI Teams',
  description: 'Capture prompts to enable team learning, reflection, and improvement of prompting skills.',
};

const geistSans = Geist({
  variable: '--font-geist-sans',
  display: 'swap',
  subsets: ['latin'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <GoogleAnalytics />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
