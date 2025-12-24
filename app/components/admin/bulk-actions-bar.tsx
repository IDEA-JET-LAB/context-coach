'use client';

/**
 * Bulk Actions Bar Component
 * Story 22-2: Classification Rule Editor - Task 14
 *
 * Sticky action bar for bulk operations on selected rules.
 * Slides up from bottom when rules are selected.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmationModal } from '@/components/feedback';
import { CheckCircle2, XCircle, FolderInput } from 'lucide-react';
import type { ClassificationCategory } from '@/lib/types/classification-rules';

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkEnable: () => Promise<void>;
  onBulkDisable: () => Promise<void>;
  onBulkChangeCategory: (categoryId: string) => Promise<void>;
  categories: ClassificationCategory[];
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkEnable,
  onBulkDisable,
  onBulkChangeCategory,
  categories,
}: BulkActionsBarProps) {
  const [confirmAction, setConfirmAction] = useState<{
    type: 'enable' | 'disable' | 'category';
    categoryId?: string;
    categoryName?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    if (!confirmAction) return;

    setIsProcessing(true);
    try {
      switch (confirmAction.type) {
        case 'enable':
          await onBulkEnable();
          break;
        case 'disable':
          await onBulkDisable();
          break;
        case 'category':
          if (confirmAction.categoryId) {
            await onBulkChangeCategory(confirmAction.categoryId);
          }
          break;
      }
    } finally {
      setIsProcessing(false);
      setConfirmAction(null);
    }
  };

  const getConfirmationDetails = () => {
    if (!confirmAction) return { title: '', description: '', variant: 'warning' as const };

    switch (confirmAction.type) {
      case 'enable':
        return {
          title: 'Enable Rules',
          description: `Are you sure you want to enable ${selectedCount} selected rule${selectedCount > 1 ? 's' : ''}? They will immediately start matching prompts.`,
          variant: 'warning' as const,
        };
      case 'disable':
        return {
          title: 'Disable Rules',
          description: `Are you sure you want to disable ${selectedCount} selected rule${selectedCount > 1 ? 's' : ''}? They will stop matching prompts until re-enabled.`,
          variant: 'warning' as const,
        };
      case 'category':
        return {
          title: 'Change Category',
          description: `Are you sure you want to move ${selectedCount} selected rule${selectedCount > 1 ? 's' : ''} to the "${confirmAction.categoryName}" category?`,
          variant: 'warning' as const,
        };
    }
  };

  const confirmDetails = getConfirmationDetails();

  return (
    <>
      {/* Sliding Action Bar */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 bg-surface-secondary border-t border-border shadow-lg',
          'transform transition-transform duration-200 ease-out',
          selectedCount > 0 ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Selection Info */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground">
                {selectedCount} of {totalCount} rules selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="link" size="sm" onClick={onSelectAll}>
                  Select All
                </Button>
                <span className="text-muted-foreground">|</span>
                <Button variant="link" size="sm" onClick={onDeselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction({ type: 'enable' })}
                disabled={isProcessing}
              >
                <CheckCircle2 className="mr-2 h-4 w-4 text-status-success" />
                Enable All
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction({ type: 'disable' })}
                disabled={isProcessing}
              >
                <XCircle className="mr-2 h-4 w-4 text-status-error" />
                Disable All
              </Button>

              <Select
                onValueChange={(id) => {
                  const cat = categories.find((c) => c.id === id);
                  if (cat) {
                    setConfirmAction({
                      type: 'category',
                      categoryId: id,
                      categoryName: cat.name,
                    });
                  }
                }}
                disabled={isProcessing}
              >
                <SelectTrigger className="w-[180px] bg-surface-primary">
                  <div className="flex items-center gap-2">
                    <FolderInput className="h-4 w-4" />
                    <SelectValue placeholder="Change Category" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name.replace(/_/g, ' ')}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmDetails.title}
        description={confirmDetails.description}
        variant={confirmDetails.variant}
        confirmLabel="Confirm"
        onConfirm={handleConfirm}
        loading={isProcessing}
      />
    </>
  );
}
