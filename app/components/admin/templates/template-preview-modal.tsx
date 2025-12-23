'use client';

import { useState, useTransition } from 'react';
import { Eye, Play, Loader2, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { showToast } from '@/components/feedback';
import {
  previewTemplate,
  testTemplateWithLLM,
  getSampleData,
} from '@/lib/services/prompt-template-preview';
import type {
  PromptTemplateType,
  TemplatePreviewResult,
  TemplateSampleData,
} from '@/lib/types/prompt-templates';

/**
 * Template Preview Modal
 *
 * Allows previewing a template with:
 * - Sample data (auto-generated)
 * - Custom data input
 * - LLM test execution (rate limited)
 */

interface TemplatePreviewModalProps {
  templateBody: string;
  templateType: PromptTemplateType;
  disabled?: boolean;
}

export function TemplatePreviewModal({
  templateBody,
  templateType,
  disabled = false,
}: TemplatePreviewModalProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'test'>('preview');
  const [isPending, startTransition] = useTransition();

  const [sampleData, setSampleData] = useState<TemplateSampleData | null>(null);
  const [customData, setCustomData] = useState<string>('');
  const [previewResult, setPreviewResult] = useState<TemplatePreviewResult | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Load sample data when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !sampleData) {
      startTransition(async () => {
        const result = await getSampleData(templateType);
        if (result.success) {
          setSampleData(result.data);
          setCustomData(JSON.stringify(result.data, null, 2));
          // Auto-preview with sample data
          handlePreview(result.data);
        }
      });
    }
  };

  // Preview with current data
  const handlePreview = async (data?: TemplateSampleData) => {
    const dataToUse = data || parseCustomData();
    if (!dataToUse) return;

    startTransition(async () => {
      const result = await previewTemplate(templateBody, templateType, dataToUse);
      if (result.success) {
        setPreviewResult(result.data);
      } else {
        showToast.error(result.error.message);
      }
    });
  };

  // Parse custom data JSON
  const parseCustomData = (): TemplateSampleData | null => {
    try {
      return JSON.parse(customData);
    } catch {
      showToast.error('Invalid JSON in custom data');
      return null;
    }
  };

  // Test with LLM
  const handleTestWithLLM = async () => {
    const dataToUse = parseCustomData();
    if (!dataToUse) return;

    startTransition(async () => {
      const result = await testTemplateWithLLM(templateBody, templateType, dataToUse);
      if (result.success) {
        setPreviewResult({
          rendered: result.data.rendered,
          variables_used: [],
          missing_required: [],
          unknown_variables: [],
          is_valid: true,
        });
        setTestResult(result.data.testResult);
        setActiveTab('test');
      } else {
        showToast.error(result.error.message);
      }
    });
  };

  // Reset custom data to sample
  const resetToSample = () => {
    if (sampleData) {
      setCustomData(JSON.stringify(sampleData, null, 2));
      handlePreview(sampleData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled || !templateBody}>
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Template Preview</DialogTitle>
          <DialogDescription>
            Preview how your template will look with sample or custom data
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'preview' | 'test')}
          className="flex-1 overflow-hidden flex flex-col"
        >
          <TabsList className="mb-4">
            <TabsTrigger value="preview">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="test">
              <Play className="mr-2 h-4 w-4" />
              Test with LLM
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="preview"
            className="flex-1 overflow-auto space-y-4 mt-0"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Custom Data Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Variable Data (JSON)</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetToSample}
                    className="h-7 text-xs"
                  >
                    Reset to sample
                  </Button>
                </div>
                <Textarea
                  value={customData}
                  onChange={(e) => setCustomData(e.target.value)}
                  className="h-48 font-mono text-xs bg-card"
                  placeholder="Enter JSON data for preview..."
                />
                <Button
                  onClick={() => handlePreview()}
                  disabled={isPending}
                  className="w-full"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rendering...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Update Preview
                    </>
                  )}
                </Button>
              </div>

              {/* Preview Result */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Rendered Template</Label>
                  {previewResult && (
                    <div className="flex items-center gap-2">
                      {previewResult.is_valid ? (
                        <Badge className="bg-status-success-subtle text-status-success">
                          <Check className="mr-1 h-3 w-3" />
                          Valid
                        </Badge>
                      ) : (
                        <Badge className="bg-status-warning-subtle text-status-warning">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Issues
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div
                  className={cn(
                    'h-48 overflow-auto rounded-lg border p-3 font-mono text-xs',
                    'bg-card text-foreground',
                    previewResult?.is_valid === false && 'border-status-warning'
                  )}
                >
                  {isPending ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rendering...
                    </div>
                  ) : previewResult ? (
                    <pre className="whitespace-pre-wrap">{previewResult.rendered}</pre>
                  ) : (
                    <p className="text-muted-foreground">
                      Click "Update Preview" to see the rendered template
                    </p>
                  )}
                </div>

                {/* Validation Info */}
                {previewResult && (
                  <div className="space-y-1 text-xs">
                    {previewResult.variables_used.length > 0 && (
                      <p className="text-muted-foreground">
                        Variables used: {previewResult.variables_used.join(', ')}
                      </p>
                    )}
                    {previewResult.missing_required.length > 0 && (
                      <p className="text-status-warning">
                        Missing values: {previewResult.missing_required.join(', ')}
                      </p>
                    )}
                    {previewResult.unknown_variables.length > 0 && (
                      <p className="text-status-warning">
                        Unknown variables: {previewResult.unknown_variables.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="test"
            className="flex-1 overflow-auto space-y-4 mt-0"
          >
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  Test your template by running it through the LLM. This will
                  use your configured analysis model and is rate limited to 5
                  tests per minute.
                </p>
              </div>

              <Button
                onClick={handleTestWithLLM}
                disabled={isPending || !customData}
                className="w-full"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Test...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run LLM Test
                  </>
                )}
              </Button>

              {/* Test Result */}
              {testResult && (
                <div className="space-y-2">
                  <Label>LLM Response</Label>
                  <div className="max-h-96 overflow-auto rounded-lg border border-status-success/30 bg-status-success-subtle p-4">
                    <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                      {testResult}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
