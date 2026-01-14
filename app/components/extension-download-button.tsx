"use client";

/**
 * ExtensionDownloadButton - VS Code Extension Download
 *
 * A button that triggers download of the latest VS Code extension.
 * Shows loading state during download and handles errors gracefully.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Download, Loader2, Check, AlertCircle } from "lucide-react";

interface ExtensionInfo {
  version: string;
  filename: string;
  downloadUrl: string;
  size: number;
  updatedAt: string;
}

type DownloadState = "idle" | "loading" | "success" | "error";

// VS Code icon as SVG
function VSCodeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16.5 2.25l5.25 4.5v10.5l-5.25 4.5L3 15l13.5 6.75V2.25z" />
      <path d="M3 9l13.5-6.75v19.5L3 15V9z" />
      <path d="M16.5 2.25L8.25 9l8.25 6" />
    </svg>
  );
}

export function ExtensionDownloadButton() {
  const [state, setState] = useState<DownloadState>("idle");
  const [extensionInfo, setExtensionInfo] = useState<ExtensionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch extension info on mount
  useEffect(() => {
    async function fetchInfo() {
      try {
        const response = await fetch("/api/extension/info");
        if (response.ok) {
          const data = await response.json();
          setExtensionInfo(data.data);
        }
      } catch {
        // Silently fail - button will still work but won't show version
      }
    }
    fetchInfo();
  }, []);

  const handleDownload = async () => {
    setState("loading");
    setError(null);

    try {
      // Trigger download by navigating to the download endpoint
      const link = document.createElement("a");
      link.href = "/api/extension/download";
      link.download = extensionInfo?.filename || "contextor-vscode.vsix";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setState("success");
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Download failed");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  const getButtonIcon = () => {
    switch (state) {
      case "loading":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "success":
        return <Check className="h-4 w-4" />;
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Download className="h-4 w-4" />;
    }
  };

  const getTooltipContent = () => {
    if (state === "error" && error) {
      return error;
    }
    if (state === "success") {
      return "Download started!";
    }
    if (extensionInfo) {
      return `Download VS Code Extension v${extensionInfo.version}`;
    }
    return "Download VS Code Extension";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={state === "loading"}
            className="gap-2"
          >
            <VSCodeIcon className="h-4 w-4" />
            {getButtonIcon()}
            {extensionInfo && (
              <span className="text-xs text-muted-foreground">
                v{extensionInfo.version}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
