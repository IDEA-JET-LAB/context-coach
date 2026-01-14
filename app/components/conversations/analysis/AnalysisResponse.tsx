"use client";

/**
 * AnalysisResponse - Story 30-7: Interactive Chat Interface
 *
 * Displays streaming analysis response with typing indicator.
 * Includes copy and enlarge functionality.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Check, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisResponseProps {
  response: string;
  isStreaming?: boolean;
  error?: string | null;
  /** External control for enlarged dialog (optional - if provided, component is controlled) */
  isEnlargedOpen?: boolean;
  /** Callback when enlarged dialog state changes */
  onEnlargedOpenChange?: (open: boolean) => void;
}

export function AnalysisResponse({
  response,
  isStreaming = false,
  error = null,
  isEnlargedOpen,
  onEnlargedOpenChange,
}: AnalysisResponseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [internalIsEnlarged, setInternalIsEnlarged] = useState(false);

  // Support both controlled and uncontrolled modes
  const isEnlarged = isEnlargedOpen !== undefined ? isEnlargedOpen : internalIsEnlarged;
  const setIsEnlarged = onEnlargedOpenChange || setInternalIsEnlarged;

  // Auto-scroll as response streams in
  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [response, isStreaming]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!response) return;

    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [response]);

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-4">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!response && !isStreaming) {
    return null;
  }

  return (
    <>
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          {/* Action buttons */}
          {response && !isStreaming && (
            <div className="flex justify-end gap-1 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEnlarged(true)}
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                title="Enlarge"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div
            ref={containerRef}
            className="max-h-[400px] overflow-y-auto"
          >
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-transparent p-0 m-0 text-foreground">
                {response}
                {isStreaming && <TypingCursor />}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enlarged view dialog */}
      <Dialog open={isEnlarged} onOpenChange={setIsEnlarged}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle>Analysis Result</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 px-3"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-transparent p-0 m-0 text-foreground">
                {response}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * TypingCursor - Animated cursor shown while streaming
 */
function TypingCursor() {
  return (
    <span className="inline-block w-2 h-4 bg-primary ml-0.5 animate-pulse" />
  );
}
