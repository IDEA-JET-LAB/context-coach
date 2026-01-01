import { requireSuperAdmin } from '@/lib/auth/admin';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth - check admin status (middleware should have already checked)
  await requireSuperAdmin();

  return <>{children}</>;
}
