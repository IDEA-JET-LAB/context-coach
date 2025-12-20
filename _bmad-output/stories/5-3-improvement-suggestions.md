# Story 5.3: Improvement Suggestions

Status: ready-for-dev

**Dependency:** Requires Story 5.2 (5-Dimension Scoring) to be completed first.

## Story

**As a** system,
**I want** to generate improvement suggestions per dimension,
**So that** users know exactly how to improve.

## Acceptance Criteria

1. **Given** a dimension with score < 8
   **When** analysis completes
   **Then** a specific suggestion is generated for that dimension
   **And** the suggestion references the actual prompt text

2. **Given** a dimension with score >= 8
   **When** analysis completes
   **Then** a positive reinforcement message is included
   **And** optional "next level" suggestions may be provided

3. **Given** all suggestions
   **When** they are formatted
   **Then** they use coaching-positive language
   **And** they are actionable (not vague)

4. **Given** an AI response with missing or malformed suggestions
   **When** parsing occurs
   **Then** fallback suggestions are used gracefully
   **And** no error is exposed to the user

5. **Given** suggestions displayed to user
   **When** screen reader is active
   **Then** dimension names and suggestions are properly announced
   **And** ARIA labels provide context

## Tasks / Subtasks

- [ ] **Task 1: Extend AI prompt for suggestions** (AC: #1, #2)
  - [ ] Update `supabase/functions/analyze-prompt/lib/prompt-builder.ts` to request suggestions per dimension
  - [ ] Add instruction for scores < 8: provide specific improvement suggestion
  - [ ] Add instruction for scores >= 8: provide reinforcement message
  - [ ] Specify that suggestions must reference the actual prompt content
  - [ ] Require actionable, concrete language (not generic advice)

- [ ] **Task 2: Define suggestion response schema** (AC: #1, #4)
  - [ ] Extend `DimensionScore` type (from Story 5.2) to include `suggestion` field
  - [ ] Add `suggestionType` field: 'improvement' | 'reinforcement' | 'next_level'
  - [ ] Update Zod schema in `supabase/functions/analyze-prompt/lib/response-parser.ts`
  - [ ] Add optional `example` field for showing improved prompt snippets
  - [ ] Make suggestion validation lenient (allow fallback on missing)

- [ ] **Task 3: Update response parser for suggestions** (AC: #1, #2, #4)
  - [ ] Extend `parseAIResponse()` in `response-parser.ts` to extract suggestions
  - [ ] Validate suggestion is non-empty string or use fallback
  - [ ] Map suggestion type based on score threshold (1-7: improvement, 8-9: next_level, 10: reinforcement)
  - [ ] Handle malformed AI responses gracefully (try/catch with fallback)
  - [ ] Log parsing failures for debugging without exposing to user

- [ ] **Task 4: Create suggestion formatting utilities** (AC: #3, #5)
  - [ ] Create `supabase/functions/analyze-prompt/lib/suggestion-formatter.ts`
  - [ ] Implement `formatSuggestion()` for consistent output structure
  - [ ] Apply coaching-positive language patterns
  - [ ] Truncate overly long suggestions (max 500 chars)
  - [ ] Ensure output is screen-reader friendly (no special chars that break TTS)

- [ ] **Task 5: Create fallback suggestions library** (AC: #1, #2, #4)
  - [ ] Create `supabase/functions/analyze-prompt/lib/fallback-suggestions.ts`
  - [ ] Define generic improvement suggestions per dimension (5 dimensions)
  - [ ] Define generic reinforcement messages per dimension
  - [ ] Implement `getFallbackSuggestion(dimension, score)` function
  - [ ] Use when AI response lacks proper suggestion

- [ ] **Task 6: Integrate suggestions into analysis result** (AC: #1, #2, #3)
  - [ ] Update Edge Function `index.ts` to include suggestions in result
  - [ ] Structure suggestions as JSONB for `prompt_analyses.suggestions` column
  - [ ] Include both individual dimension suggestions and prioritized top 3
  - [ ] Order suggestions by score (lowest first for improvement priority)

## Dev Notes

### Dependency on Story 5.2

This story extends the `DimensionScore` type defined in Story 5.2. Ensure that story is complete and the following exist:
- `DimensionScoreSchema` Zod validator
- `parseAIResponse()` function
- Basic 5-dimension scoring working

### Suggestion Types by Score

| Score | Type | Purpose |
|-------|------|---------|
| 1-7 | improvement | Specific, actionable feedback |
| 8-9 | next_level | Optional advanced tips |
| 10 | reinforcement | Positive acknowledgment |

### Coaching-Positive Language Guidelines

| Instead of | Use |
|------------|-----|
| "You failed to..." | "Consider..." |
| "Missing..." | "Try adding..." |
| (for high scores) | "Great job on..." |

Focus on improvement, not criticism.

### Extended AI Response Schema

```typescript
// In response-parser.ts
const DimensionScoreSchema = z.object({
  name: z.string(),
  score: z.number().min(1).max(10),
  reasoning: z.string(),
  suggestion: z.string().min(1).optional(), // Optional - fallback if missing
  suggestionType: z.enum(['improvement', 'reinforcement', 'next_level']).optional(),
  example: z.string().optional(),
});

const AnalysisResponseSchema = z.object({
  dimensions: z.array(DimensionScoreSchema).length(5),
  prioritySuggestions: z.array(z.string()).max(3).optional(),
});
```

### AI Prompt Template Addition

Add to existing prompt in `prompt-builder.ts`:

```
For each dimension, provide a suggestion based on the score:
- Score 1-7: Give specific, actionable improvement referencing actual prompt content
- Score 8-9: Acknowledge what was done well, offer optional advanced tip
- Score 10: Positive reinforcement highlighting excellence

Language: coaching-positive, specific, actionable. Include brief example if helpful.
```

### Suggestion Formatter

```typescript
// lib/suggestion-formatter.ts
interface FormattedSuggestion {
  dimension: string;
  type: 'improvement' | 'reinforcement' | 'next_level';
  message: string;
  example?: string;
  priority: number;
}

function formatSuggestions(dimensionScores: DimensionScore[]): FormattedSuggestion[] {
  return dimensionScores
    .map((score) => ({
      dimension: score.name,
      type: score.suggestionType || getSuggestionType(score.score),
      message: truncate(score.suggestion || getFallback(score.name, score.score), 500),
      example: score.example,
      priority: score.score,
    }))
    .sort((a, b) => a.priority - b.priority);
}

function getSuggestionType(score: number): 'improvement' | 'next_level' | 'reinforcement' {
  if (score <= 7) return 'improvement';
  if (score <= 9) return 'next_level';
  return 'reinforcement';
}
```

### Fallback Suggestions

```typescript
// lib/fallback-suggestions.ts
const FALLBACK_IMPROVEMENTS: Record<string, string> = {
  Clarity: "Consider breaking down complex requests into clear, numbered steps.",
  Context: "Try adding background information about your project or constraints.",
  Specificity: "Include specific details like file names or expected formats.",
  Goal: "Clearly state what you want to achieve and how you'll know success.",
  Constraints: "Mention any limitations or preferences that should guide the response.",
};

const FALLBACK_REINFORCEMENTS: Record<string, string> = {
  Clarity: "Excellent clarity! Your request is easy to understand.",
  Context: "Great context provided! The background frames the problem well.",
  Specificity: "Impressive specificity! Detailed requirements make this actionable.",
  Goal: "Clear goal definition! Success criteria are obvious.",
  Constraints: "Well-defined constraints! Boundaries focus the response.",
};

function getFallbackSuggestion(dimension: string, score: number): string {
  return score >= 8
    ? FALLBACK_REINFORCEMENTS[dimension] || "Great job on this dimension!"
    : FALLBACK_IMPROVEMENTS[dimension] || "Consider adding more detail.";
}
```

### JSONB Storage Structure

```typescript
// Stored in prompt_analyses.suggestions column
interface StoredSuggestions {
  byDimension: Record<string, {
    type: 'improvement' | 'reinforcement' | 'next_level';
    message: string;
    example?: string;
  }>;
  prioritized: string[]; // Top 3 dimension names in priority order
  generatedAt: string;
}
```

### File Locations

| File | Purpose |
|------|---------|
| `supabase/functions/analyze-prompt/lib/suggestion-formatter.ts` | Format and truncate suggestions |
| `supabase/functions/analyze-prompt/lib/fallback-suggestions.ts` | Generic fallbacks per dimension |
| `supabase/functions/analyze-prompt/lib/prompt-builder.ts` | AI prompt with suggestion instructions |
| `supabase/functions/analyze-prompt/lib/response-parser.ts` | Parse AI response, apply fallbacks |
| `supabase/functions/analyze-prompt/index.ts` | Orchestrate and store results |

### Error Handling

- Wrap AI response parsing in try/catch
- On parse error: log error, apply fallback for all dimensions
- Never expose raw AI errors to user-facing suggestions
- Track fallback usage in logs for AI prompt improvement

### Common Pitfalls

1. DO NOT use negative language in suggestions
2. DO NOT give generic advice without examples
3. DO NOT forget fallback handling for missing suggestions
4. DO NOT expose raw AI reasoning in user-facing text
5. DO NOT make suggestions > 500 chars
6. DO NOT assume AI follows format - always validate

### Verification Checklist

After implementation, verify:
- [ ] Low-score dimensions (< 8) receive improvement suggestions
- [ ] High-score dimensions (>= 8) receive reinforcement or next-level
- [ ] Suggestions reference actual prompt content when AI provides them
- [ ] Suggestions use coaching-positive language
- [ ] Fallback suggestions work when AI response is incomplete
- [ ] Suggestions stored as JSONB in prompt_analyses table
- [ ] Priority ordering works (lowest scores first)
- [ ] Screen reader announces suggestions properly

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by dev agent - list all files created/modified*
