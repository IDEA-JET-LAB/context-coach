'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Eye, Settings2, Copy, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { deleteConfig, duplicateConfig } from '@/lib/services/admin-config';
import { useRouter } from 'next/navigation';
import { showToast, ConfirmationModal } from '@/components/feedback';
import { useState, useTransition } from 'react';

interface ConfigVersionCardProps {
  config: {
    id: string;
    version: number;
    name: string;
    model: string;
    is_active: boolean;
    created_at: string;
    dimension_count: number;
  };
}

export function ConfigVersionCard({ config }: ConfigVersionCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDuplicate = () => {
    startTransition(async () => {
      const result = await duplicateConfig(config.id);
      if (result.success) {
        showToast.success('Config duplicated successfully');
        router.push(`/admin/config/${result.data.id}`);
      } else {
        showToast.error(result.error.message);
      }
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteConfig(config.id);
    setIsDeleting(false);

    if (result.success) {
      showToast.success('Config deleted successfully');
      router.refresh();
    } else {
      showToast.error(result.error.message);
    }
  };

  return (
    <Card
      data-testid="config-version-card"
      className="border-border bg-background"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              data-testid="config-name"
              className="text-lg font-semibold text-foreground"
            >
              {config.name}
            </span>
            {config.is_active ? (
              <Badge
                data-testid="active-badge"
                className="bg-green-500/20 text-green-500 hover:bg-green-500/30"
              >
                Active
              </Badge>
            ) : (
              <Badge
                data-testid="inactive-badge"
                variant="secondary"
                className="bg-muted/50"
              >
                Inactive
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Version {config.version} &middot; {config.model}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {config.dimension_count} dimension{config.dimension_count !== 1 ? 's' : ''}
            </p>
            <p
              data-testid="config-created-date"
              className="text-xs text-muted-foreground"
            >
              Created {formatDistanceToNow(new Date(config.created_at), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/config/${config.id}`}>
                <Eye className="mr-1 h-3.5 w-3.5" />
                View
              </Link>
            </Button>

            {!config.is_active && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/config/${config.id}?edit=true`}>
                    <Settings2 className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDuplicate}
                  disabled={isPending}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  {isPending ? 'Duplicating...' : 'Duplicate'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>

                <ConfirmationModal
                  open={isDeleteDialogOpen}
                  onOpenChange={setIsDeleteDialogOpen}
                  title="Delete Configuration"
                  description={`Are you sure you want to delete "${config.name}"? This action cannot be undone.`}
                  variant="destructive"
                  confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
                  onConfirm={handleDelete}
                  loading={isDeleting}
                  icon={Trash2}
                />
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
