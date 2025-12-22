import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAnalysisConfig } from '@/lib/services/admin-config';
import { ConfigDetailView } from '@/components/admin/config-detail-view';

interface ConfigDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}

export async function generateMetadata({ params }: ConfigDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getAnalysisConfig(id);

  if (!result.success) {
    return { title: 'Config Not Found | Admin | Contextor' };
  }

  return {
    title: `${result.data.name} | Admin | Contextor`,
    description: `Analysis configuration version ${result.data.version}`,
  };
}

export default async function ConfigDetailPage({ params, searchParams }: ConfigDetailPageProps) {
  const { id } = await params;
  const { edit } = await searchParams;
  const isEditMode = edit === 'true';

  const result = await getAnalysisConfig(id);

  if (!result.success) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <ConfigDetailView config={result.data} initialEditMode={isEditMode} />
    </div>
  );
}
