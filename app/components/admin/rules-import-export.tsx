'use client';

/**
 * Rules Import/Export Component
 * Story 22-2: Classification Rule Editor - Task 12
 *
 * Provides import/export functionality for classification rules.
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { showToast } from '@/components/feedback';
import {
  Download,
  Upload,
  MoreVertical,
  Loader2,
  Check,
  X,
  AlertTriangle,
  FileJson,
} from 'lucide-react';
import {
  exportRules,
  previewImport,
  importRules,
} from '@/lib/services/classification-rules-io';
import type { ImportPreview, ImportResult } from '@/lib/types/classification-rules-io';

export function RulesImportExport() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [jsonContent, setJsonContent] = useState<string | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const result = await exportRules();

      if (result.success) {
        // Download as file
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `classification-rules-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showToast.success(`Exported ${result.data.rules.length} rules`);
      } else {
        showToast.error(result.error.message);
      }
    } catch {
      showToast.error('Failed to export rules');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setJsonContent(content);

      // Preview the import
      setIsImporting(true);
      const result = await previewImport(content);

      if (result.success) {
        setImportPreview(result.data);
        setShowImportDialog(true);
      } else {
        showToast.error(result.error.message);
      }
    } catch {
      showToast.error('Failed to read file');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImport = async () => {
    if (!jsonContent) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await importRules(jsonContent, {
        updateExisting,
        skipConflicting: !updateExisting,
      });

      if (result.success) {
        setImportResult(result.data);
        showToast.success(
          `Imported ${result.data.summary.rulesCreated} rules, updated ${result.data.summary.rulesUpdated}`
        );
      } else {
        showToast.error(result.error.message);
      }
    } catch {
      showToast.error('Failed to import rules');
    } finally {
      setIsImporting(false);
    }
  };

  const closeDialog = () => {
    setShowImportDialog(false);
    setImportPreview(null);
    setImportResult(null);
    setJsonContent(null);
    setUpdateExisting(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export Rules
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Import Rules
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Import Classification Rules
            </DialogTitle>
            <DialogDescription>
              Review the import before applying changes.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {importPreview && !importResult && (
              <ImportPreviewView preview={importPreview} />
            )}

            {importResult && <ImportResultView result={importResult} />}
          </div>

          <DialogFooter className="gap-2">
            {!importResult && importPreview?.valid && (
              <div className="flex items-center gap-2 mr-auto">
                <Checkbox
                  id="update-existing"
                  checked={updateExisting}
                  onCheckedChange={(checked) => setUpdateExisting(!!checked)}
                />
                <Label htmlFor="update-existing" className="text-sm">
                  Update existing rules
                </Label>
              </div>
            )}

            <Button variant="outline" onClick={closeDialog}>
              {importResult ? 'Close' : 'Cancel'}
            </Button>

            {!importResult && importPreview?.valid && (
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// Import Preview Component
// ============================================================================

function ImportPreviewView({ preview }: { preview: ImportPreview }) {
  if (!preview.valid) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-status-error-subtle border border-status-error/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-status-error shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-status-error">Invalid import file</p>
              <ul className="text-sm text-foreground mt-2 space-y-1">
                {preview.errors.map((error, i) => (
                  <li key={i}>- {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const createCount = preview.rules.filter((r) => r.action === 'create').length;
  const updateCount = preview.rules.filter((r) => r.action === 'update').length;
  const skipCount = preview.rules.filter((r) => r.action === 'skip').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-status-success-subtle text-center">
          <p className="text-2xl font-bold text-status-success">{createCount}</p>
          <p className="text-xs text-muted-foreground">To Create</p>
        </div>
        <div className="p-3 rounded-lg bg-status-warning-subtle text-center">
          <p className="text-2xl font-bold text-status-warning">{updateCount}</p>
          <p className="text-xs text-muted-foreground">To Update</p>
        </div>
        <div className="p-3 rounded-lg bg-surface-tertiary text-center">
          <p className="text-2xl font-bold text-muted-foreground">{skipCount}</p>
          <p className="text-xs text-muted-foreground">To Skip</p>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">Categories</h4>
        <div className="border border-border rounded-lg divide-y divide-border">
          {preview.categories.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between p-2">
              <span className="text-sm">{cat.name}</span>
              <ActionBadge action={cat.action} />
            </div>
          ))}
        </div>
      </div>

      {/* Rules */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">Rules</h4>
        <div className="border border-border rounded-lg divide-y divide-border max-h-[300px] overflow-y-auto">
          {preview.rules.map((rule) => (
            <div key={rule.name} className="flex items-center justify-between p-2">
              <div className="min-w-0">
                <p className="text-sm truncate">{rule.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {rule.categoryName}
                </p>
              </div>
              <ActionBadge action={rule.action} />
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {preview.errors.length > 0 && (
        <div className="p-3 rounded-lg bg-status-warning-subtle">
          <p className="text-sm font-medium text-status-warning mb-1">Warnings:</p>
          <ul className="text-sm text-foreground space-y-1">
            {preview.errors.map((error, i) => (
              <li key={i}>- {error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Import Result Component
// ============================================================================

function ImportResultView({ result }: { result: ImportResult }) {
  const { summary } = result;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="p-4 rounded-lg bg-status-success-subtle border border-status-success/20">
        <div className="flex items-center gap-2 mb-2">
          <Check className="h-5 w-5 text-status-success" />
          <span className="font-medium text-status-success">Import Complete</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Categories created: {summary.categoriesCreated}</div>
          <div>Categories skipped: {summary.categoriesSkipped}</div>
          <div>Rules created: {summary.rulesCreated}</div>
          <div>Rules updated: {summary.rulesUpdated}</div>
          <div>Rules skipped: {summary.rulesSkipped}</div>
          <div>Errors: {summary.errors}</div>
        </div>
      </div>

      {/* Details */}
      {result.details.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Details</h4>
          <div className="border border-border rounded-lg divide-y divide-border max-h-[300px] overflow-y-auto">
            {result.details.map((detail, i) => (
              <div key={i} className="flex items-center justify-between p-2">
                <div className="min-w-0">
                  <p className="text-sm truncate">{detail.ruleName}</p>
                  {detail.reason && (
                    <p className="text-xs text-muted-foreground">{detail.reason}</p>
                  )}
                </div>
                <StatusBadge status={detail.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function ActionBadge({ action }: { action: 'create' | 'update' | 'skip' }) {
  const config = {
    create: { icon: Check, className: 'bg-status-success-subtle text-status-success' },
    update: { icon: AlertTriangle, className: 'bg-status-warning-subtle text-status-warning' },
    skip: { icon: X, className: 'bg-surface-tertiary text-muted-foreground' },
  };

  const Icon = config[action].icon;

  return (
    <Badge variant="outline" className={config[action].className}>
      <Icon className="h-3 w-3 mr-1" />
      {action}
    </Badge>
  );
}

function StatusBadge({ status }: { status: 'created' | 'updated' | 'skipped' | 'error' }) {
  const config = {
    created: { icon: Check, className: 'bg-status-success-subtle text-status-success' },
    updated: { icon: Check, className: 'bg-status-warning-subtle text-status-warning' },
    skipped: { icon: X, className: 'bg-surface-tertiary text-muted-foreground' },
    error: { icon: AlertTriangle, className: 'bg-status-error-subtle text-status-error' },
  };

  const Icon = config[status].icon;

  return (
    <Badge variant="outline" className={config[status].className}>
      <Icon className="h-3 w-3 mr-1" />
      {status}
    </Badge>
  );
}
