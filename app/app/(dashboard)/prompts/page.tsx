import { PromptFeed } from '@/components/feed/prompt-feed';

export default function PromptsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#fafafa]">Prompt Feed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your team's recent prompts and their analysis scores
        </p>
      </div>
      <PromptFeed />
    </div>
  );
}
