import { requireSuperAdmin } from '@/lib/auth/admin';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth - check admin status (middleware should have already checked)
  await requireSuperAdmin();

  // Admin layout just adds the admin context header
  // The sidebar is handled by the parent dashboard layout
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-500">
          ADMIN
        </span>
        <h1 className="text-lg font-semibold text-foreground">Platform Administration</h1>
      </div>
      {children}
    </div>
  );
}
