'use client';

import { use } from 'react';
import { usePrompt } from '@/lib/hooks/use-prompt';
import { PromptDetailView } from '@/components/prompt-detail/prompt-detail-view';
import { PromptDetailSkeleton } from '@/components/prompt-detail/prompt-detail-skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface PromptDetailPageProps {
  params: Promise<{ promptId: string }>;
}

export default function PromptDetailPage({ params }: PromptDetailPageProps) {
  const { promptId } = use(params);
  const { data: prompt, isPending, error } = usePrompt(promptId);

  if (isPending) {
    return <PromptDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12" data-testid="prompt-error">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-[#fafafa] mb-2">Failed to load prompt</h2>
        <p className="text-muted-foreground mb-6">{error.message}</p>
        <Button asChild variant="ghost">
          <Link href="/prompts">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to feed
          </Link>
        </Button>
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12" data-testid="prompt-not-found">
        <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-[#fafafa] mb-2">Prompt not found</h2>
        <p className="text-muted-foreground mb-6">
          This prompt may have been deleted or you don&apos;t have access to it.
        </p>
        <Button asChild variant="ghost">
          <Link href="/prompts">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to feed
          </Link>
        </Button>
      </div>
    );
  }

  return <PromptDetailView prompt={prompt} />;
}
