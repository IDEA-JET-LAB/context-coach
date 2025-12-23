'use client';

import { useRouter } from 'next/navigation';
import { Settings2 } from 'lucide-react';
import { ConfigVersionCard } from './config-version-card';
import { EmptyState } from '@/components/feedback';

interface Config {
  id: string;
  version: number;
  name: string;
  model: string;
  is_active: boolean;
  created_at: string;
  dimension_count: number;
}

interface ConfigListProps {
  configs: Config[];
}

export function ConfigList({ configs }: ConfigListProps) {
  const router = useRouter();

  if (configs.length === 0) {
    return (
      <EmptyState
        icon={Settings2}
        title="No Configurations"
        description="Create your first analysis configuration to start scoring prompts."
        action={{
          label: 'Create Configuration',
          onClick: () => router.push('/admin/config/new'),
        }}
      />
    );
  }

  // Sort configs: active first, then by created_at descending
  const sortedConfigs = [...configs].sort((a, b) => {
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-4">
      {sortedConfigs.map((config) => (
        <ConfigVersionCard key={config.id} config={config} />
      ))}
    </div>
  );
}
