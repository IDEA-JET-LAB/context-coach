# Story 5.2: 5-Dimension Scoring

Status: ✅ Done

## Story
**As a** system,
**I want** to score prompts on 5 dimensions using AI,
**So that** users get detailed feedback on prompt quality.

## Dependencies
- **Story 5.1**: Analysis Edge Function (provides `supabase/functions/analyze-prompt/index.ts` foundation)

## Acceptance Criteria

1. **Given** a prompt to analyze
   **When** the AI model is called via the Edge Function
   **Then** scores are returned for: Clarity, Context, Specificity, Goal, Constraints
   **And** each dimension score is an integer 1-10
   **And** the AI response follows the defined JSON schema

2. **Given** dimension scores from AI
   **When** the overall score is calculated
   **Then** it is a weighted average based on `analysis_dimensions.weight`
   **And** weights from active `analysis_configs` sum to 100
   **And** overall score is rounded to one decimal place

3. **Given** the AI response
   **When** parsing completes successfully
   **Then** structured scores are extracted and validated (1-10 range)
   **And** scores are stored in `prompt_analyses.dimension_scores` (JSONB)
   **And** `prompts.analysis_status` updates to 'complete'

4. **Given** an invalid AI response (malformed JSON, missing dimensions, out-of-range scores)
   **When** parsing fails
   **Then** error is logged: `[EDGE] analyze: parse failed for prompt {id} - {reason}`
   **And** `prompts.analysis_status` remains 'processing' for retry
   **And** retry logic from Story 5.5 handles the failure

## Technical Context

### File Locations
| File | Purpose |
|------|---------|
| `supabase/functions/analyze-prompt/index.ts` | Extend with scoring logic |
| `supabase/functions/analyze-prompt/scoring.ts` | Scoring module (create) |
| `supabase/functions/analyze-prompt/prompts.ts` | AI prompt templates (create) |

### Database Schema (from architecture)
```sql
-- prompt_analyses table (created in Story 5.4)
dimension_scores JSONB NOT NULL  -- {"clarity": 8, "context": 7, ...}

-- analysis_dimensions table (seed data)
-- Weight defaults: Clarity 25%, Context 25%, Specificity 20%, Goal 15%, Constraints 15%
```

### AI Response Schema
```typescript
interface DimensionScoreResponse {
  clarity: number;      // 1-10
  context: number;      // 1-10
  specificity: number;  // 1-10
  goal: number;         // 1-10
  constraints: number;  // 1-10
}

interface AIAnalysisResponse {
  scores: DimensionScoreResponse;
  reasoning?: Record<string, string>;  // Optional per-dimension reasoning
}
```

### Scoring Interfaces
```typescript
interface DimensionScore {
  name: string;
  score: number;
  weight: number;
}

interface ScoringResult {
  dimensionScores: DimensionScore[];
  overallScore: number;
  rawResponse: string;
}
```

### AI Prompt Template Structure
```typescript
const SCORING_SYSTEM_PROMPT = `You are a prompt quality analyst.
Score the following prompt on 5 dimensions (1-10 scale):
- Clarity: How clear and unambiguous is the request?
- Context: How much relevant background is provided?
- Specificity: How specific are the requirements?
- Goal: How clearly is the desired outcome stated?
- Constraints: How well are limitations/boundaries defined?

Respond ONLY with valid JSON matching this schema:
{
  "scores": {
    "clarity": <1-10>,
    "context": <1-10>,
    "specificity": <1-10>,
    "goal": <1-10>,
    "constraints": <1-10>
  }
}`;
```

## Tasks / Subtasks

- [ ] **Task 1: Create Scoring Module** (AC: #1, #3)
  - [ ] Create `supabase/functions/analyze-prompt/scoring.ts`
  - [ ] Define `DimensionScoreResponse` and `AIAnalysisResponse` interfaces
  - [ ] Implement `parseAIResponse(rawResponse: string): AIAnalysisResponse`
  - [ ] Validate each dimension score is integer 1-10
  - [ ] Throw typed error for invalid responses

- [ ] **Task 2: Create AI Prompt Templates** (AC: #1)
  - [ ] Create `supabase/functions/analyze-prompt/prompts.ts`
  - [ ] Define `SCORING_SYSTEM_PROMPT` constant
  - [ ] Implement `buildScoringPrompt(userPrompt: string): string`
  - [ ] Load dimension definitions from `analysis_dimensions` table
  - [ ] Use active config's `system_prompt` field

- [ ] **Task 3: Implement Weighted Average Calculation** (AC: #2)
  - [ ] Load weights from `analysis_dimensions` where `config_id` = active config
  - [ ] Validate weights sum to 100 (throw if not)
  - [ ] Implement `calculateOverallScore(scores: DimensionScore[]): number`
  - [ ] Formula: `sum(score * weight) / 100`, round to 1 decimal
  - [ ] Return both dimension scores and overall score

- [ ] **Task 4: Integrate with Edge Function** (AC: #1, #3, #4)
  - [ ] Import scoring module into `analyze-prompt/index.ts`
  - [ ] Call AI model with constructed prompt (model from `analysis_configs.model`)
  - [ ] Parse response using `parseAIResponse()`
  - [ ] Calculate overall score using weights
  - [ ] Store results: update `prompt_analyses.dimension_scores`
  - [ ] Log success: `[EDGE] analyze: scored prompt {id} - overall: {score}`
  - [ ] Log failures with reason for retry tracking

## Dev Notes

### Scoring Calculation Example
```typescript
// Given weights: Clarity 25%, Context 25%, Specificity 20%, Goal 15%, Constraints 15%
// Given scores: Clarity 8, Context 7, Specificity 9, Goal 6, Constraints 7
// Overall = (8*25 + 7*25 + 9*20 + 6*15 + 7*15) / 100
// Overall = (200 + 175 + 180 + 90 + 105) / 100 = 7.5
```

### Error Handling
- Invalid JSON: Log and trigger retry
- Missing dimension: Log and trigger retry
- Score out of range: Log and trigger retry
- All errors increment `analysis_attempts` (handled by retry logic in Story 5.5)

### AI Model Configuration
- Default model: `gpt-4o-mini` (from `analysis_configs.model`)
- Model selection happens in Edge Function based on active config
- Response timeout: 30 seconds (NFR-P3 requirement)

### Testing Approach
- Mock AI responses for unit tests
- Test score validation with edge cases (0, 11, floats, missing fields)
- Test weight calculation with various weight distributions
- Integration test with actual AI call in staging only
