import { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfigList } from '@/components/admin/config-list';
import { InlineAlert } from '@/components/feedback';
import { getAnalysisConfigs } from '@/lib/services/admin-config';

export const metadata: Metadata = {
  title: 'Analysis Config | Admin | Contextor',
  description: 'Manage analysis configurations for prompt scoring',
};

export default async function AdminConfigPage() {
  const result = await getAnalysisConfigs();

  return (
    <div data-testid="config-list-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analysis Configuration</h2>
          <p className="text-muted-foreground">
            Manage AI analysis configurations for prompt scoring
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/config/new">
            <Plus className="mr-2 h-4 w-4" />
            Create New Version
          </Link>
        </Button>
      </div>

      {result.success ? (
        <ConfigList configs={result.data} />
      ) : (
        <InlineAlert
          variant="error"
          title="Failed to load configurations"
          message={result.error.message}
        />
      )}
    </div>
  );
}
