import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TemplateForm } from '@/components/admin/templates/template-form';
import { InlineAlert } from '@/components/feedback';
import { getPromptTemplate } from '@/lib/services/prompt-templates';

export const metadata: Metadata = {
  title: 'Template Details | Admin | Contextor',
  description: 'View and edit LLM prompt template',
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TemplateDetailPage({ params }: PageProps) {
  const { id } = await params;

  const result = await getPromptTemplate(id);

  if (!result.success) {
    if (result.error.code === 'NOT_FOUND') {
      notFound();
    }
    return (
      <InlineAlert
        variant="error"
        title="Failed to load template"
        message={result.error.message}
      />
    );
  }

  const template = result.data;
  const mode = template.status === 'draft' ? 'edit' : 'view';

  return <TemplateForm template={template} mode={mode} />;
}
