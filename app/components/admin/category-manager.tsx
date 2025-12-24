'use client';

/**
 * Category Manager Component
 * Story 22-2: Classification Rule Editor - Task 3
 *
 * Dialog for managing classification categories.
 * Allows adding, editing, and archiving categories.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { showToast, ConfirmationModal } from '@/components/feedback';
import {
  Plus,
  Edit,
  Archive,
  Loader2,
  GripVertical,
  Check,
  X,
} from 'lucide-react';
import {
  createCategory,
  updateCategory,
  archiveCategory,
} from '@/lib/services/classification-rules';
import type { ClassificationCategory } from '@/lib/types/classification-rules';

// Validation schema for category form
const categoryFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name too long')
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase with underscores (e.g., bug_fix)'),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color'),
});

type CategoryFormData = z.infer<typeof categoryFormSchema>;

// Predefined color palette
const COLOR_PALETTE = [
  '#22c55e', // green
  '#ef4444', // red
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#84cc16', // lime
  '#f97316', // orange
];

interface CategoryManagerProps {
  categories: (ClassificationCategory & { rule_count: number })[];
  open: boolean;
  onClose: () => void;
}

export function CategoryManager({ categories, open, onClose }: CategoryManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<ClassificationCategory | null>(null);

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: '',
      description: '',
      color: COLOR_PALETTE[0],
    },
  });

  const startAdd = () => {
    form.reset({
      name: '',
      description: '',
      color: COLOR_PALETTE[categories.length % COLOR_PALETTE.length],
    });
    setEditingId(null);
    setIsAdding(true);
  };

  const startEdit = (category: ClassificationCategory) => {
    form.reset({
      name: category.name,
      description: category.description || '',
      color: category.color,
    });
    setIsAdding(false);
    setEditingId(category.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    form.reset();
  };

  const handleSubmit = async (data: CategoryFormData) => {
    setIsSubmitting(true);

    try {
      if (isAdding) {
        const result = await createCategory({
          name: data.name,
          description: data.description || null,
          color: data.color,
          sort_order: categories.length,
        });

        if (result.success) {
          showToast.success('Category created');
          cancelEdit();
        } else {
          showToast.error(result.error.message);
        }
      } else if (editingId) {
        const result = await updateCategory(editingId, {
          name: data.name,
          description: data.description || null,
          color: data.color,
        });

        if (result.success) {
          showToast.success('Category updated');
          cancelEdit();
        } else {
          showToast.error(result.error.message);
        }
      }
    } catch {
      showToast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;

    setIsSubmitting(true);
    try {
      const result = await archiveCategory(archiveTarget.id);
      if (result.success) {
        showToast.success('Category archived');
        setArchiveTarget(null);
      } else {
        showToast.error(result.error.message);
      }
    } catch {
      showToast.error('Failed to archive category');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>
              Create and organize classification categories for your rules.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* Category List */}
            {categories.map((category) => (
              <div
                key={category.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  editingId === category.id
                    ? 'border-border-accent bg-surface-accent/20'
                    : 'border-border bg-surface-secondary'
                )}
              >
                {editingId === category.id ? (
                  <CategoryForm
                    form={form}
                    onSubmit={handleSubmit}
                    onCancel={cancelEdit}
                    isSubmitting={isSubmitting}
                  />
                ) : (
                  <>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

                    <div
                      className="h-5 w-5 rounded-full shrink-0"
                      style={{ backgroundColor: category.color }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">
                          {category.name}
                        </span>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {category.rule_count} rules
                        </Badge>
                      </div>
                      {category.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {category.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setArchiveTarget(category)}
                        disabled={category.rule_count > 0}
                        title={
                          category.rule_count > 0
                            ? 'Cannot archive category with rules'
                            : 'Archive category'
                        }
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Add New Category */}
            {isAdding ? (
              <div className="p-3 rounded-lg border border-border-accent bg-surface-accent/20">
                <CategoryForm
                  form={form}
                  onSubmit={handleSubmit}
                  onCancel={cancelEdit}
                  isSubmitting={isSubmitting}
                />
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={startAdd}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <ConfirmationModal
        open={archiveTarget !== null}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title="Archive Category"
        description={`Are you sure you want to archive "${archiveTarget?.name}"? Archived categories cannot be assigned to new rules.`}
        variant="warning"
        confirmLabel="Archive"
        onConfirm={handleArchive}
        loading={isSubmitting}
      />
    </>
  );
}

// ============================================================================
// Category Form Component
// ============================================================================

interface CategoryFormProps {
  form: ReturnType<typeof useForm<CategoryFormData>>;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

function CategoryForm({ form, onSubmit, onCancel, isSubmitting }: CategoryFormProps) {
  const selectedColor = form.watch('color');

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex-1 space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="cat-name">Name</Label>
          <Input
            id="cat-name"
            {...form.register('name')}
            placeholder="e.g., bug_fix"
            className="bg-surface-primary font-mono"
          />
          {form.formState.errors.name && (
            <p className="text-xs text-status-error">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        {/* Color */}
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex items-center gap-1">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => form.setValue('color', color)}
                className={cn(
                  'h-7 w-7 rounded-full transition-transform hover:scale-110',
                  selectedColor === color && 'ring-2 ring-border-accent ring-offset-2 ring-offset-background'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="cat-description">Description</Label>
        <Input
          id="cat-description"
          {...form.register('description')}
          placeholder="What types of prompts belong in this category?"
          className="bg-surface-primary"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          <X className="mr-1 h-4 w-4" />
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-1 h-4 w-4" />
          )}
          Save
        </Button>
      </div>
    </form>
  );
}
