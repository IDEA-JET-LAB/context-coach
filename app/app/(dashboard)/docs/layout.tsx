import { DocsSidebar } from '@/components/docs/docs-sidebar';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
      <DocsSidebar />
      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}
