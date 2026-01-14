import { Suspense } from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { ProjectTabs } from '@/components/layout/project-tabs';
import { AccessDeniedHandler } from '@/components/auth/access-denied-handler';
import { getAdminStatus } from '@/lib/auth/admin';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await getAdminStatus();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isAdmin={isAdmin ?? false} />
      <div className="flex flex-1 flex-col">
        <Header />
        {/* Project tabs - shown when a project is selected */}
        <Suspense fallback={null}>
          <ProjectTabs />
        </Suspense>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      {/* Handle access denied redirects */}
      <Suspense fallback={null}>
        <AccessDeniedHandler />
      </Suspense>
    </div>
  );
}
