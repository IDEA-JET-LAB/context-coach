'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Check, Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { Project } from '@/types/project';

interface ProjectSuccessContentProps {
  project: Project;
}

interface CreatedData {
  apiKey: string;
  installToken: string;
}

export function ProjectSuccessContent({ project }: ProjectSuccessContentProps) {
  const router = useRouter();
  const [createdData, setCreatedData] = useState<CreatedData | null>(null);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  useEffect(() => {
    // Small delay to ensure sessionStorage is fully written before reading
    // This handles race conditions where the navigation happens very quickly
    const checkSessionStorage = () => {
      const storedData = sessionStorage.getItem(`project-created-${project.id}`);

      if (storedData) {
        try {
          const data = JSON.parse(storedData) as CreatedData;
          setCreatedData(data);
          // Clear immediately after reading for security
          sessionStorage.removeItem(`project-created-${project.id}`);
        } catch {
          // Invalid data, redirect to project page
          router.push(`/projects/${project.id}`);
        }
      } else {
        // No data found, redirect to project page
        router.push(`/projects/${project.id}`);
      }
    };

    // Use requestAnimationFrame to ensure we're in a stable state after navigation
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(checkSessionStorage);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [project.id, router]);

  const copyToClipboard = async (text: string, type: 'apiKey' | 'token' | 'command') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'apiKey') {
        setCopiedApiKey(true);
        setTimeout(() => setCopiedApiKey(false), 2000);
      } else if (type === 'token') {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      } else {
        setCopiedCommand(true);
        setTimeout(() => setCopiedCommand(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!createdData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const installCommand = `npx @contextor/cli init "${createdData.installToken}"`;

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
          <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-3xl font-bold">Project Created!</h1>
        <p className="text-muted-foreground mt-2">
          Your project &quot;{project.name}&quot; is ready. Save your API key now!
        </p>
      </div>

      {/* Warning Banner */}
      <Alert variant="destructive" className="bg-yellow-50 border-yellow-300 dark:bg-yellow-950 dark:border-yellow-800">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200">Save your API key now!</AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300">
          This is the only time your API key will be displayed. Copy it and store it securely.
          You will not be able to retrieve it again.
        </AlertDescription>
      </Alert>

      {/* API Key Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Key</CardTitle>
          <CardDescription>
            Use this key to authenticate API requests from your project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted p-3 rounded-md font-mono text-sm break-all">
              {createdData.apiKey}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(createdData.apiKey, 'apiKey')}
              aria-label="Copy API key"
            >
              {copiedApiKey ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          {copiedApiKey && (
            <p className="text-sm text-green-600 mt-2">Copied!</p>
          )}
        </CardContent>
      </Card>

      {/* Install Token Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Install Token</CardTitle>
          <CardDescription>
            Use this token with the CLI installer to set up Contextor in your repository.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted p-3 rounded-md font-mono text-xs break-all max-h-20 overflow-auto">
              {createdData.installToken}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(createdData.installToken, 'token')}
              aria-label="Copy install token"
            >
              {copiedToken ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          {copiedToken && (
            <p className="text-sm text-green-600">Copied!</p>
          )}
        </CardContent>
      </Card>

      {/* Installation Command Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Install Command</CardTitle>
          <CardDescription>
            Run this command in your project directory to install Contextor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-slate-900 text-slate-100 p-3 rounded-md font-mono text-sm overflow-x-auto">
              <span className="text-green-400">$</span> {installCommand}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(installCommand, 'command')}
              aria-label="Copy install command"
            >
              {copiedCommand ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          {copiedCommand && (
            <p className="text-sm text-green-600 mt-2">Copied!</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <Button asChild className="flex-1">
          <Link href={`/projects/${project.id}`}>
            Go to Project Dashboard
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" asChild className="flex-1">
          <Link href="/projects">View All Projects</Link>
        </Button>
      </div>
    </div>
  );
}
