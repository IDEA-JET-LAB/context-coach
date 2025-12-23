import { Metadata } from 'next';
import { TemplateForm } from '@/components/admin/templates/template-form';

export const metadata: Metadata = {
  title: 'Create Template | Admin | Contextor',
  description: 'Create a new LLM prompt template',
};

export default function NewTemplatePage() {
  return <TemplateForm mode="create" />;
}
