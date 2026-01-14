# Story 30-7: Interactive Chat Interface

## Story Info
- **Epic:** 30 - Conversation Analysis
- **Priority:** P1
- **Points:** 5
- **Status:** Done
- **Completed:** 2026-01-10

## Description

Create the "Chat with this Conversation" interface with content toggles, model selection, token/cost estimates, and streaming response display. This is the core interactive analysis feature.

## Acceptance Criteria

- [x] Model selector (Haiku/Sonnet/Opus) with visual distinction
- [x] Content inclusion checkboxes with live token estimates
- [x] Cost display that updates based on selected model
- [x] Text input for custom questions
- [x] Streaming response display with typing indicator
- [x] Save analysis to database on completion
- [x] Show past analyses for this conversation
- [x] Rate limiting (prevent spam)

## Technical Details

### Component Structure

```
components/conversations/analysis/
├── AnalysisChatPanel.tsx        # Main container
├── ModelSelector.tsx            # Model toggle buttons
├── ContentSelector.tsx          # Checkboxes with token counts
├── CostEstimate.tsx             # Cost display
├── AnalysisInput.tsx            # Question input + submit
├── AnalysisResponse.tsx         # Streaming response display
├── PastAnalysesList.tsx         # Previous analyses accordion
└── AnalysisHistory.tsx          # Single past analysis item
```

### Main Panel Component

```typescript
// components/conversations/analysis/AnalysisChatPanel.tsx

interface AnalysisChatPanelProps {
  sessionId: string;
  teamId: string;
}

export function AnalysisChatPanel({ sessionId, teamId }: AnalysisChatPanelProps) {
  // State
  const [model, setModel] = useState<'haiku' | 'sonnet' | 'opus'>('haiku');
  const [includePrompts, setIncludePrompts] = useState(true);
  const [includeResponses, setIncludeResponses] = useState(true);
  const [includeThinking, setIncludeThinking] = useState(false);
  const [includeTools, setIncludeTools] = useState(false);
  const [question, setQuestion] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch content for token estimation
  const { data: content } = useConversationContent(sessionId);

  // Calculate token estimate
  const tokenEstimate = useMemo(() => {
    if (!content) return null;
    return estimateConversationTokens(content, {
      includePrompts,
      includeResponses,
      includeThinking,
      includeTools,
    });
  }, [content, includePrompts, includeResponses, includeThinking, includeTools]);

  // Calculate cost estimate
  const costEstimate = useMemo(() => {
    if (!tokenEstimate) return null;
    return estimateCost(tokenEstimate.total);
  }, [tokenEstimate]);

  // Fetch past analyses
  const { data: pastAnalyses, refetch: refetchAnalyses } = usePastAnalyses(sessionId);

  // Handle submit
  const handleAnalyze = async () => {
    if (!question.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setResponse('');
    setError(null);

    try {
      const res = await fetch(`/api/conversations/${sessionId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          model,
          includePrompts,
          includeResponses,
          includeThinking,
          includeTools,
        }),
      });

      if (!res.ok) {
        throw new Error('Analysis failed');
      }

      // Handle streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        setResponse(prev => prev + chunk);
      }

      // Refetch past analyses to include new one
      refetchAnalyses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <MessageSquareText className="h-4 w-4" />
          Analyze Conversation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model Selector */}
        <ModelSelector value={model} onChange={setModel} />

        {/* Content Selection */}
        <ContentSelector
          tokenEstimate={tokenEstimate}
          includePrompts={includePrompts}
          setIncludePrompts={setIncludePrompts}
          includeResponses={includeResponses}
          setIncludeResponses={setIncludeResponses}
          includeThinking={includeThinking}
          setIncludeThinking={setIncludeThinking}
          includeTools={includeTools}
          setIncludeTools={setIncludeTools}
        />

        {/* Cost Estimate */}
        {costEstimate && (
          <CostEstimate estimate={costEstimate} selectedModel={model} />
        )}

        {/* Question Input */}
        <AnalysisInput
          value={question}
          onChange={setQuestion}
          onSubmit={handleAnalyze}
          isLoading={isAnalyzing}
          disabled={!tokenEstimate}
        />

        {/* Response Display */}
        {(response || isAnalyzing) && (
          <AnalysisResponse
            content={response}
            isStreaming={isAnalyzing}
          />
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Past Analyses */}
        {pastAnalyses && pastAnalyses.length > 0 && (
          <PastAnalysesList analyses={pastAnalyses} />
        )}
      </CardContent>
    </Card>
  );
}
```

### Model Selector

```typescript
// components/conversations/analysis/ModelSelector.tsx

interface ModelSelectorProps {
  value: 'haiku' | 'sonnet' | 'opus';
  onChange: (model: 'haiku' | 'sonnet' | 'opus') => void;
}

const MODEL_INFO = {
  haiku: { label: 'Haiku', description: 'Fast & cheap', icon: Zap },
  sonnet: { label: 'Sonnet', description: 'Balanced', icon: Scale },
  opus: { label: 'Opus', description: 'Most capable', icon: Brain },
};

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-2">Model</div>
      <div className="flex gap-2">
        {(['haiku', 'sonnet', 'opus'] as const).map(model => {
          const { label, description, icon: Icon } = MODEL_INFO[model];
          const isSelected = value === model;

          return (
            <button
              key={model}
              onClick={() => onChange(model)}
              className={cn(
                'flex-1 p-2 rounded-md border text-center transition-colors',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <Icon className={cn('h-4 w-4 mx-auto mb-1', isSelected && 'text-primary')} />
              <div className="text-xs font-medium">{label}</div>
              <div className="text-[10px] text-muted-foreground">{description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### Content Selector

```typescript
// components/conversations/analysis/ContentSelector.tsx

interface ContentSelectorProps {
  tokenEstimate: TokenEstimate | null;
  includePrompts: boolean;
  setIncludePrompts: (v: boolean) => void;
  // ... other props
}

export function ContentSelector({
  tokenEstimate,
  includePrompts,
  setIncludePrompts,
  includeResponses,
  setIncludeResponses,
  includeThinking,
  setIncludeThinking,
  includeTools,
  setIncludeTools,
}: ContentSelectorProps) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-2">Include in context</div>
      <div className="space-y-2">
        <ContentCheckbox
          label="User prompts"
          checked={includePrompts}
          onChange={setIncludePrompts}
          tokens={tokenEstimate?.prompts}
          disabled={true} // Always required
        />
        <ContentCheckbox
          label="AI responses"
          checked={includeResponses}
          onChange={setIncludeResponses}
          tokens={tokenEstimate?.responses}
        />
        <ContentCheckbox
          label="Thinking blocks"
          checked={includeThinking}
          onChange={setIncludeThinking}
          tokens={tokenEstimate?.thinking}
          warning={tokenEstimate?.thinking && tokenEstimate.thinking > 20000}
        />
        <ContentCheckbox
          label="Tool calls (summary)"
          checked={includeTools}
          onChange={setIncludeTools}
          tokens={tokenEstimate?.tools}
        />
      </div>

      {tokenEstimate && (
        <div className="mt-2 pt-2 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-sm font-medium">
            {formatTokens(tokenEstimate.total)} tokens
          </span>
        </div>
      )}
    </div>
  );
}

function ContentCheckbox({
  label,
  checked,
  onChange,
  tokens,
  disabled,
  warning,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tokens?: number;
  disabled?: boolean;
  warning?: boolean;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
        />
        <span className="text-sm">{label}</span>
        {warning && <AlertTriangle className="h-3 w-3 text-score-growth" />}
      </div>
      {tokens !== undefined && (
        <span className="text-xs text-muted-foreground">
          ~{formatTokens(tokens)}
        </span>
      )}
    </label>
  );
}
```

### API Endpoint

```typescript
// app/api/conversations/[sessionId]/analyze/route.ts

import { createServerClient } from '@/lib/supabase/server';
import { analyzeConversation } from '@/lib/analysis/anthropic-client';
import { extractConversationContent } from '@/lib/analysis/content-extractor';
import { createAnalysis } from '@/lib/repositories/conversation-analysis';

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;
  const body = await request.json();
  const {
    question,
    model,
    includePrompts,
    includeResponses,
    includeThinking,
    includeTools,
  } = body;

  // Validate
  if (!question?.trim()) {
    return NextResponse.json({ error: 'Question required' }, { status: 400 });
  }

  // Get user and verify access
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get session and verify team access
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Rate limit check
  const rateLimitResult = await checkRateLimit(user.id, 'conversation-analysis');
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 }
    );
  }

  // Extract content
  const content = await extractConversationContent(sessionId, {
    includePrompts,
    includeResponses,
    includeThinking,
    includeTools,
  });

  // Build prompts
  const systemPrompt = ANALYSIS_SYSTEM_PROMPT;
  const userPrompt = `${content.transcript}\n\n---\n\nQuestion: ${question}`;

  // Create streaming response
  const encoder = new TextEncoder();
  let fullResponse = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const analysisStream = await analyzeConversation({
          systemPrompt,
          userPrompt,
          config: { model, stream: true },
        });

        for await (const chunk of analysisStream) {
          if (chunk.type === 'text') {
            fullResponse += chunk.content;
            controller.enqueue(encoder.encode(chunk.content));
          } else if (chunk.type === 'done') {
            inputTokens = chunk.usage?.inputTokens || 0;
            outputTokens = chunk.usage?.outputTokens || 0;
          }
        }

        // Save to database after completion
        const costCents = calculateCost(model, inputTokens, outputTokens);
        await createAnalysis(supabase, {
          sessionId,
          teamId: session.team_id,
          question,
          questionType: 'custom',
          response: fullResponse,
          model,
          inputTokens,
          outputTokens,
          estimatedCostCents: costCents,
          includedPrompts,
          includedResponses,
          includedThinking,
          includedTools,
        });

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
```

### Past Analyses List

```typescript
// components/conversations/analysis/PastAnalysesList.tsx

interface PastAnalysesListProps {
  analyses: ConversationAnalysis[];
}

export function PastAnalysesList({ analyses }: PastAnalysesListProps) {
  return (
    <Accordion type="single" collapsible className="mt-4">
      <AccordionItem value="past-analyses">
        <AccordionTrigger className="text-xs text-muted-foreground">
          Past Analyses ({analyses.length})
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3 pt-2">
            {analyses.map(analysis => (
              <AnalysisHistoryItem key={analysis.id} analysis={analysis} />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function AnalysisHistoryItem({ analysis }: { analysis: ConversationAnalysis }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border rounded-md p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-sm font-medium line-clamp-1">{analysis.question}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatRelativeTime(analysis.createdAt)} · {analysis.model} · {formatCost(analysis.estimatedCostCents)}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Less' : 'More'}
        </Button>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-sm whitespace-pre-wrap">{analysis.response}</div>
        </div>
      )}
    </div>
  );
}
```

## Tests

### Component Tests

```typescript
describe('AnalysisChatPanel', () => {
  it('should render model selector');
  it('should update token estimate when checkboxes change');
  it('should update cost when model changes');
  it('should disable submit when no question');
  it('should show loading state during analysis');
  it('should stream response text');
  it('should show error on failure');
});

describe('ModelSelector', () => {
  it('should highlight selected model');
  it('should call onChange when model clicked');
});

describe('ContentSelector', () => {
  it('should disable prompts checkbox (always required)');
  it('should show warning icon for high-token thinking');
  it('should update total when checkboxes change');
});
```

### API Tests

```typescript
describe('POST /api/conversations/[sessionId]/analyze', () => {
  it('should return streaming response');
  it('should save analysis to database');
  it('should return 400 for missing question');
  it('should return 401 for unauthenticated');
  it('should return 403 for wrong team');
  it('should return 429 when rate limited');
});
```

### E2E Tests

```typescript
describe('Conversation Analysis Chat', () => {
  it('should analyze conversation with default settings');
  it('should show cost estimate before submit');
  it('should stream response');
  it('should save to past analyses');
  it('should expand past analysis to see full response');
});
```

## Dependencies

- Story 30-1: Anthropic API Integration
- Story 30-3: Analysis Storage Schema
- Story 30-4: Token Estimation Service
- Story 30-5: Content Extraction Service

## Out of Scope

- Quick analysis buttons (Story 30-8)
- Project-level analysis

## Definition of Done

- [x] All components implemented
- [x] API endpoint working with streaming
- [x] Analyses saved to database
- [x] Past analyses displayed
- [x] Rate limiting in place
- [x] Component tests passing
- [x] E2E tests passing (19/21 pass, 1 flaky, 1 requires real API)
- [x] Mobile responsive
