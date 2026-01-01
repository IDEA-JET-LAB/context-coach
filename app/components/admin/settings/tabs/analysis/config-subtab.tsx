import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfigList } from '@/components/admin/config-list';
import { InlineAlert } from '@/components/feedback';
import { getAnalysisConfigs } from '@/lib/services/admin-config';

/**
 * Config Subtab
 *
 * Analysis configuration management.
 */
export async function ConfigSubtab() {
  const result = await getAnalysisConfigs();

  return (
    <div data-testid="config-subtab" className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Manage AI analysis configurations for prompt scoring.
        </p>
        <Button asChild size="sm">
          <Link href="/admin/settings/config/new">
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
