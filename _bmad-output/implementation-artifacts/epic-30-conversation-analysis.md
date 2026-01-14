# Epic 30: Conversation Analysis

## Table of Contents

- [Overview](#overview) (Line 10)
- [Goals](#goals) (Line 20)
- [Architecture Decisions](#architecture-decisions) (Line 30)
- [Story 30-1: Anthropic API Integration](#story-30-1-anthropic-api-integration) (Line 55)
- [Story 30-2: Deterministic Stats Service](#story-30-2-deterministic-stats-service) (Line 95)
- [Story 30-3: Analysis Storage Schema](#story-30-3-analysis-storage-schema) (Line 145)
- [Story 30-4: Token Estimation Service](#story-30-4-token-estimation-service) (Line 190)
- [Story 30-5: Conversation Content Extraction](#story-30-5-conversation-content-extraction) (Line 235)
- [Story 30-6: Analysis Panel UI](#story-30-6-analysis-panel-ui) (Line 285)
- [Story 30-7: Interactive Chat Interface](#story-30-7-interactive-chat-interface) (Line 355)
- [Story 30-8: Quick Analysis Buttons](#story-30-8-quick-analysis-buttons) (Line 415)
- [Future Considerations](#future-considerations) (Line 465)

---

## Overview

Enable users to analyze individual conversations to understand their context-engineering effectiveness. This epic provides both instant deterministic statistics and interactive LLM-powered analysis with model selection.

**Primary Use Case:** User opens a conversation, sees instant stats (tokens, tools, duration), and can ask questions about their performance via a chat interface powered by Anthropic models.

**Discovery Phase:** This is explicitly a learning/discovery feature. The goal is to understand what analysis questions provide the most value before committing to fixed KPIs for automated analysis.

---

## Goals

1. Provide instant, free deterministic statistics for every conversation
2. Enable interactive "chat with this conversation" analysis
3. Allow users to compare outputs across Anthropic models (Haiku/Sonnet/Opus)
4. Show token costs before analysis to educate users
5. Store analysis results for later review
6. Build foundation for future project-level analysis

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **UI Location** | Right sidebar panel | Existing sidebar has space, maintains conversation context |
| **LLM Provider** | Anthropic (Claude) | Analyzing Claude Code usage with Claude is coherent |
| **Model Selection** | User-selectable (Haiku/Sonnet/Opus) | Discovery phase - compare quality vs cost |
| **Storage** | Database (`conversation_analyses` table) | Review past analyses, track what questions work |
| **Token Display** | Live estimation with checkboxes | Educates users about token costs |
| **Content Selection** | Checkboxes for inclusion | User controls cost vs completeness tradeoff |

### API Key Configuration

```
ANTHROPIC_API_KEY=sk-ant-api03-REDACTED
```

Add to: `.env`, `app/.env.local`, GCP Secret Manager (production)

---

## Story 30-1: Anthropic API Integration

### Description
Create a reusable Anthropic client service for conversation analysis with support for all three Claude models.

### Acceptance Criteria
- [ ] Create `lib/analysis/anthropic-client.ts` with typed client
- [ ] Support model selection: `claude-3-haiku-20240307`, `claude-3-sonnet-20240229`, `claude-3-opus-20240229`
- [ ] Implement streaming support for better UX on long responses
- [ ] Handle rate limits with exponential backoff
- [ ] Timeout handling (30s default, configurable)
- [ ] Error handling with user-friendly messages

### Technical Details

```typescript
// lib/analysis/anthropic-client.ts
interface AnthropicConfig {
  model: 'haiku' | 'sonnet' | 'opus';
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface AnalysisRequest {
  systemPrompt: string;
  userPrompt: string;
  config: AnthropicConfig;
}

interface AnalysisResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}
```

### Model Mapping
| UI Name | API Model ID | Input $/1M | Output $/1M |
|---------|--------------|------------|-------------|
| Haiku | claude-3-haiku-20240307 | $0.25 | $1.25 |
| Sonnet | claude-3-sonnet-20240229 | $3.00 | $15.00 |
| Opus | claude-3-opus-20240229 | $15.00 | $75.00 |

### Tests
- Unit tests for client initialization
- Mock API response handling
- Error scenarios (timeout, rate limit, invalid key)
- Streaming response handling

---

## Story 30-2: Deterministic Stats Service

### Description
Create a service that calculates instant, free statistics for any conversation without LLM calls.

### Acceptance Criteria
- [ ] Create `lib/analysis/conversation-stats.ts`
- [ ] Calculate all metrics from existing database data
- [ ] Return results in <100ms
- [ ] Handle edge cases (empty conversations, missing data)

### Metrics to Calculate

| Metric | Source | Calculation |
|--------|--------|-------------|
| Turn count | Messages table | Count user messages |
| Duration | Session timestamps | `ended_at - started_at` |
| Total tokens in | Responses table | Sum `input_tokens` |
| Total tokens out | Responses table | Sum `output_tokens` |
| Tool usage breakdown | Responses table | Parse `tool_calls`, group by tool name |
| Agent usage | Responses table | Parse `tool_calls` for Task tool, extract agent types |
| Context window peak % | Cumulative tokens | Max(cumulative_tokens / 200000) |
| Outcome | Session metadata | Detect git commit, file writes in tool results |
| Category | Existing classification | From session or first prompt classification |

### Response Type

```typescript
interface ConversationStats {
  turnCount: number;
  durationMinutes: number | null;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  tools: Record<string, number>; // tool_name -> count
  agents: Record<string, number>; // agent_type -> count
  contextWindowPeak: number; // 0-100 percentage
  outcome: 'completed' | 'abandoned' | 'ongoing' | 'unknown';
  category: string | null;
}
```

### Tests
- Calculate stats for conversation with all data
- Handle missing responses
- Handle ongoing (no end time) conversations
- Performance test (<100ms for 100-message conversation)

---

## Story 30-3: Analysis Storage Schema

### Description
Create database schema to store conversation analysis results for later review.

### Acceptance Criteria
- [ ] Create migration for `conversation_analyses` table
- [ ] Support multiple analyses per conversation
- [ ] Track model used, tokens consumed, cost
- [ ] Enable querying past analyses
- [ ] RLS policies for team-based access

### Schema

```sql
CREATE TABLE conversation_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(session_id),
  team_id UUID NOT NULL REFERENCES teams(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Analysis details
  question TEXT NOT NULL,
  response TEXT NOT NULL,
  model TEXT NOT NULL, -- 'haiku', 'sonnet', 'opus'

  -- Token tracking
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost_cents NUMERIC(10,4) NOT NULL,

  -- Content selection (what was included)
  included_prompts BOOLEAN DEFAULT true,
  included_responses BOOLEAN DEFAULT true,
  included_thinking BOOLEAN DEFAULT false,
  included_tools BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_conversation_analyses_session ON conversation_analyses(session_id);
CREATE INDEX idx_conversation_analyses_team ON conversation_analyses(team_id);
CREATE INDEX idx_conversation_analyses_created ON conversation_analyses(created_at DESC);

-- RLS
ALTER TABLE conversation_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team analyses" ON conversation_analyses
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create analyses for their team" ON conversation_analyses
  FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );
```

### Tests
- Insert and retrieve analysis
- RLS policy enforcement
- Query analyses by session
- Query analyses by team

---

## Story 30-4: Token Estimation Service

### Description
Create a service that estimates token counts for conversation content before sending to LLM.

### Acceptance Criteria
- [ ] Create `lib/analysis/token-estimator.ts`
- [ ] Estimate tokens for each content type
- [ ] Calculate cost based on selected model
- [ ] Update estimates in real-time as checkboxes change
- [ ] Accuracy within 10% of actual token count

### Token Estimation Approach

Use character-based estimation (Claude averages ~4 chars per token for English):

```typescript
function estimateTokens(text: string): number {
  // Claude tokenization averages ~4 characters per token
  // Add 10% buffer for safety
  return Math.ceil(text.length / 4 * 1.1);
}
```

### Response Type

```typescript
interface TokenEstimate {
  prompts: number;
  responses: number;
  thinking: number;
  tools: number;
  total: number;
  cost: {
    haiku: number;   // in cents
    sonnet: number;
    opus: number;
  };
}
```

### Tests
- Estimate accuracy vs actual (within 10%)
- Cost calculation for each model
- Handle empty content
- Handle very long content (>100k chars)

---

## Story 30-5: Conversation Content Extraction

### Description
Create a service that extracts and formats conversation content for LLM analysis based on user-selected options.

### Acceptance Criteria
- [ ] Create `lib/analysis/content-extractor.ts`
- [ ] Extract user prompts with timestamps
- [ ] Extract AI text responses (excluding tool results)
- [ ] Extract thinking blocks (optional)
- [ ] Extract tool calls with summarized params (optional)
- [ ] Format as clean conversation transcript

### Content Hierarchy

| Content Type | Default | Priority | Notes |
|--------------|---------|----------|-------|
| User prompts | ON | 1 (always) | Core of analysis |
| AI text responses | ON | 2 | Essential context |
| Error messages in prompts | ON | - | Already in prompts |
| Tool calls (summarized) | OFF | 3 | Name + brief params only |
| Thinking blocks | OFF | 4 | Expensive, rarely needed |
| Tool results | OFF | 5 | Very expensive, usually noise |

### Output Format

```typescript
interface ExtractedContent {
  transcript: string;  // Formatted conversation
  metadata: {
    promptCount: number;
    responseCount: number;
    includedThinking: boolean;
    includedTools: boolean;
  };
  tokenEstimate: number;
}
```

### Transcript Format Example

```
[Turn 1 - 10:23 AM]
USER: Add a dark mode toggle to the settings page

ASSISTANT: I'll help you add a dark mode toggle. Let me first examine the current settings page structure.
[Used tools: Read(2), Grep(1)]

[Turn 2 - 10:25 AM]
USER: Yes, please proceed

ASSISTANT: I've added the dark mode toggle component...
```

### Tests
- Extract prompts only
- Extract with responses
- Extract with thinking (verify proper formatting)
- Extract with tools (verify summarization)
- Handle missing data gracefully

---

## Story 30-6: Analysis Panel UI

### Description
Add the analysis panel to the conversation detail page's right sidebar.

### Acceptance Criteria
- [ ] Add collapsible "Analysis" section to right sidebar
- [ ] Display deterministic stats (from Story 30-2)
- [ ] Show stats immediately on page load
- [ ] Use existing design system components
- [ ] Mobile responsive (panel becomes bottom sheet or hidden)

### UI Components

```
┌─────────────────────────────────────────┐
│ 📊 Conversation Stats                   │
├─────────────────────────────────────────┤
│ Duration        47 minutes              │
│ Turns           23                      │
│ Tokens In       45,230                  │
│ Tokens Out      128,450                 │
│ Context Peak    78%                     │
├─────────────────────────────────────────┤
│ Tools Used                              │
│ ├─ Read         12                      │
│ ├─ Edit         8                       │
│ ├─ Bash         5                       │
│ └─ Grep         3                       │
├─────────────────────────────────────────┤
│ Agents Used                             │
│ ├─ Explore      2                       │
│ └─ general      1                       │
├─────────────────────────────────────────┤
│ Outcome: ✓ Completed (commit detected)  │
└─────────────────────────────────────────┘
```

### Design System Components
- Card, CardHeader, CardContent
- Collapsible (for expandable sections)
- Badge (for counts)
- Progress (for context window %)

### Tests
- Stats display correctly
- Loading state
- Error state
- Empty conversation state
- Responsive behavior

---

## Story 30-7: Interactive Chat Interface

### Description
Create the "Chat with this Conversation" interface with content toggles and model selection.

### Acceptance Criteria
- [ ] Model selector (Haiku/Sonnet/Opus)
- [ ] Content inclusion checkboxes with live token estimates
- [ ] Cost display based on selected model
- [ ] Text input for custom questions
- [ ] Streaming response display
- [ ] Save analysis to database on completion
- [ ] Show past analyses for this conversation

### UI Layout

```
┌─────────────────────────────────────────┐
│ 💬 Analyze Conversation                 │
├─────────────────────────────────────────┤
│ Model: [Haiku ▼] [Sonnet] [Opus]        │
├─────────────────────────────────────────┤
│ Include in context:                     │
│ ☑ User prompts           (~4,200 tokens)│
│ ☑ AI responses          (~18,500 tokens)│
│ ☐ Thinking blocks       (~45,000 tokens)│
│ ☐ Tool calls (summary)   (~2,100 tokens)│
├─────────────────────────────────────────┤
│ Estimated: 22,700 tokens │ ~$0.02       │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Ask a question about this           │ │
│ │ conversation...                     │ │
│ └─────────────────────────────────────┘ │
│                            [Analyze →]  │
├─────────────────────────────────────────┤
│ Response:                               │
│ ┌─────────────────────────────────────┐ │
│ │ (Streaming response appears here)   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### API Endpoint

```typescript
// POST /api/conversations/[sessionId]/analyze
interface AnalyzeRequest {
  question: string;
  model: 'haiku' | 'sonnet' | 'opus';
  includePrompts: boolean;
  includeResponses: boolean;
  includeThinking: boolean;
  includeTools: boolean;
}

// Response: Server-Sent Events (streaming)
```

### Tests
- Model selection persists
- Token estimate updates on checkbox change
- Cost updates on model change
- Streaming response renders
- Analysis saved to database
- Error handling (API failure, timeout)

---

## Story 30-8: Quick Analysis Buttons

### Description
Add pre-built analysis prompts for common questions.

### Acceptance Criteria
- [ ] Add quick action buttons above custom question input
- [ ] Each button uses optimized prompt and content selection
- [ ] Track which quick analyses are most used (for future optimization)

### Quick Analysis Options

| Button | Prompt | Content |
|--------|--------|---------|
| **Summarize** | "Summarize this conversation in 2-3 sentences. What was the goal and was it achieved?" | Prompts + Responses |
| **Find Issues** | "Identify 3-5 issues with how the user approached this conversation. Focus on context-engineering mistakes." | Prompts + Responses |
| **Suggestions** | "What could the user have done differently to achieve their goal more efficiently?" | Prompts + Responses |
| **Deep Dive** | "Analyze the AI's reasoning and decision-making. Were there any suboptimal paths taken?" | All (including thinking) |

### UI

```
┌─────────────────────────────────────────┐
│ Quick Analysis:                         │
│ [Summarize] [Find Issues] [Suggestions] │
│ [Deep Dive ⚠️ High tokens]              │
└─────────────────────────────────────────┘
```

### Tests
- Each button triggers correct prompt
- Content selection matches button type
- Deep Dive warning displays
- Analytics tracking fires

---

## Future Considerations

### Phase 2: Project-Level Analysis

Once conversation-level analysis is validated, extend to project-level:

1. **Hierarchical Summarization**
   - Summarize each conversation (~500 tokens stored)
   - Project analysis operates on summaries
   - 100 conversations = ~50K tokens

2. **Pre-Computed Analysis (Recommended)**
   - Analyze each conversation on completion
   - Store structured results
   - Project view = pure aggregation (no LLM needed)

3. **Cross-Conversation Patterns**
   - Repeated mistakes across conversations
   - Learning progression tracking
   - Tool usage trends

### Metrics Discovery

Track which questions users ask most frequently:
- Store all custom questions
- Analyze patterns after 100+ analyses
- Promote common questions to Quick Analysis buttons
- Remove unused Quick Analysis options

### Cost Controls

Consider adding:
- Daily/monthly spending limits per user
- Team-level budget alerts
- Auto-downgrade to Haiku when budget exceeded

---

## Dependencies

- **Story 25-5**: Conversation Thread UI (existing - sidebar to extend)
- **Story 16-x**: Sessions table (existing - session_id reference)
- **Story 15-x**: Responses table (existing - token data source)

## Risks

| Risk | Mitigation |
|------|------------|
| Token costs could be high for long conversations | Show estimates upfront, default to cheaper content selection |
| Users may not know what questions to ask | Provide Quick Analysis buttons, learn from usage |
| Anthropic rate limits | Implement exponential backoff, queue system if needed |
| Analysis quality varies by model | Let users compare, guide toward appropriate model for question type |

---

## Success Metrics

1. **Usage:** >50% of conversation views include at least one analysis
2. **Discovery:** Identify top 5 most valuable analysis questions within 30 days
3. **Cost efficiency:** Average analysis cost <$0.10
4. **User satisfaction:** Positive feedback on analysis usefulness

---

*Epic created: 2026-01-09*
*Status: Ready for implementation*
