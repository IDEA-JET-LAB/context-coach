'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ImportHistoryItem } from './import-history-item';
import { RollbackDialog } from '@/components/import/rollback-dialog';
import { InlineAlert } from '@/components/feedback/inline-alert';
import type { ImportRecord } from '@/lib/import/types';

interface ImportHistoryListProps {
  imports: ImportRecord[];
}

export function ImportHistoryList({ imports }: ImportHistoryListProps) {
  const router = useRouter();
  const [rollbackTarget, setRollbackTarget] = useState<ImportRecord | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRollback = useCallback(async (importRecord: ImportRecord) => {
    setRollingBackId(importRecord.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/import/${importRecord.id}/rollback`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Rollback failed');
      }

      setSuccess(`Successfully rolled back ${data.deletedCount?.toLocaleString() || 0} prompts.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setRollingBackId(null);
      setRollbackTarget(null);
    }
  }, [router]);

  // Calculate summary stats
  const activeImports = imports.filter(i => i.status !== 'rolled_back' && i.status !== 'partially_rolled_back');
  const totalPrompts = activeImports.reduce((sum, i) => sum + i.promptsImported, 0);
  const totalSkipped = activeImports.reduce((sum, i) => sum + i.promptsSkipped, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg border border-border">
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">{imports.length}</p>
          <p className="text-xs text-muted-foreground">Total Imports</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">{totalPrompts.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Prompts Imported</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">{totalSkipped.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Duplicates Skipped</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <InlineAlert
          variant="error"
          title="Rollback Failed"
          message={error}
          dismissible
          onDismiss={() => setError(null)}
        />
      )}
      {success && (
        <InlineAlert
          variant="success"
          title="Rollback Complete"
          message={success}
          dismissible
          onDismiss={() => setSuccess(null)}
        />
      )}

      {/* Import List */}
      <div className="space-y-3">
        {imports.map((importRecord) => (
          <ImportHistoryItem
            key={importRecord.id}
            importRecord={importRecord}
            onRollback={() => setRollbackTarget(importRecord)}
            isRollingBack={rollingBackId === importRecord.id}
          />
        ))}
      </div>

      {/* Rollback Confirmation Dialog */}
      <RollbackDialog
        open={!!rollbackTarget}
        onOpenChange={(open) => !open && setRollbackTarget(null)}
        promptCount={rollbackTarget?.promptsImported || 0}
        onConfirm={() => rollbackTarget && handleRollback(rollbackTarget)}
        loading={!!rollingBackId}
      />
    </div>
  );
}
