# Story 21.3: Sentiment Analysis

Status: Ready

## Story

**As a** developer using Contextor,
**I want** my prompts analyzed for sentiment (polite, frustrated, neutral, directive, collaborative),
**So that** I can understand my communication patterns and identify when frustration affects my prompting quality.

## Acceptance Criteria

1. **Given** a prompt is captured
   **When** sentiment analysis runs
   **Then** the prompt is assigned one of five sentiments: polite, frustrated, neutral, directive, or collaborative

2. **Given** a prompt contains "please", "thank you", "appreciate", "great"
   **When** analyzed
   **Then** it is classified as `polite` with confidence proportional to pattern matches

3. **Given** a prompt contains "still not working", "why isn't this", "frustrating", "wtf"
   **When** analyzed
   **Then** it is classified as `frustrated` with high confidence (>0.7)

4. **Given** a prompt starts with imperative verbs like "do", "make", "create", "fix"
   **When** analyzed
   **Then** it is classified as `directive`

5. **Given** a prompt contains "let's", "we could", "shall we", "together", "how about we"
   **When** analyzed
   **Then** it is classified as `collaborative` with confidence proportional to pattern matches

6. **Given** any prompt
   **When** sentiment analysis runs
   **Then** it returns individual scores for polite, frustrated, directive, and collaborative (0-1 each)

7. **Given** any prompt
   **When** analysis runs
   **Then** it completes in under 2ms

8. **Given** sentiment scores are saved
   **When** queried
   **Then** both the final sentiment and the individual scores are available

9. **Given** multiple prompts in a session
   **When** sentiment analysis runs
   **Then** frustration trend is tracked (increasing, decreasing, stable) within the session

10. **Given** a session with rising frustration (3+ consecutive frustrated prompts or frustration score increase > 0.3)
    **When** session is analyzed
    **Then** the session is flagged with `frustration_rising: true` for review

11. **Given** sentiment scores for a session
    **When** session metrics are calculated
    **Then** politeness ratio is computed as `polite_count / (polite_count + frustrated_count)`

## Tasks / Subtasks

- [ ] **Task 1: Database Schema Updates** (AC: #1, #8, #9, #10, #11)
  - [ ] Add `sentiment VARCHAR(20)` to prompts table
  - [ ] Add `sentiment_confidence DECIMAL(3,2)` to prompts table
  - [ ] Add `sentiment_scores JSONB` to prompts table
  - [ ] Add CHECK constraint for valid sentiment values (including 'collaborative')
  - [ ] Add index on `sentiment` for filtering
  - [ ] Add `frustration_trend VARCHAR(20)` to sessions table (increasing, decreasing, stable)
  - [ ] Add `frustration_rising BOOLEAN DEFAULT false` to sessions table
  - [ ] Add `politeness_ratio DECIMAL(3,2)` to sessions table

- [ ] **Task 2: Implement Sentiment Analyzer** (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Create `/app/lib/analysis/sentiment-classifier.ts`
  - [ ] Define `Sentiment` type: 'polite' | 'frustrated' | 'neutral' | 'directive' | 'collaborative'
  - [ ] Define weighted pattern arrays for each sentiment (including collaborative)
  - [ ] Implement `analyzeSentiment(promptText)` returning sentiment, confidence, and scores
  - [ ] Normalize scores to 0-1 range

- [ ] **Task 3: Define Sentiment Patterns** (AC: #2, #3, #4, #5)
  - [ ] Polite patterns with weights:
    - [ ] "please" (0.3), "thank you/thanks" (0.4), "could you/would you" (0.25)
    - [ ] "great/awesome/excellent/perfect" (0.3), "appreciate" (0.35), "kindly" (0.2)
  - [ ] Frustrated patterns with weights:
    - [ ] "why is/does/doesn't/isn't this" (0.3), "still not/wrong/broken/failing" (0.5)
    - [ ] "what the/wtf" (0.7), "frustrat/annoy/irritat" (0.6), "again?!" (0.4)
  - [ ] Directive patterns with weights:
    - [ ] Imperative start "^do/make/create/add/remove/fix/update/delete" (0.4)
    - [ ] Commands without punctuation (0.2)
  - [ ] Collaborative patterns with weights:
    - [ ] "let's" (0.4), "we could/we can/we should" (0.35), "shall we" (0.3)
    - [ ] "together" (0.3), "how about we" (0.35), "what if we" (0.3)
    - [ ] "help me understand" (0.25), "work with me" (0.35)

- [ ] **Task 4: Implement Decision Logic** (AC: #1)
  - [ ] Calculate cumulative scores for each sentiment type
  - [ ] Cap scores at 1.0
  - [ ] Priority: frustrated (>0.4) > collaborative (>0.35) > polite (>0.3) > directive (>0.3) > neutral
  - [ ] Calculate confidence based on winning score

- [ ] **Task 5: Integrate into Capture Flow** (AC: #1, #8)
  - [ ] Call sentiment analyzer in prompt capture API
  - [ ] Store sentiment, confidence, and scores JSONB
  - [ ] Run in parallel with work style classifier

- [ ] **Task 6: Session-Level Frustration Tracking** (AC: #9, #10, #11)
  - [ ] Create `/app/lib/analysis/session-sentiment-tracker.ts`
  - [ ] Implement `calculateFrustrationTrend(sessionPrompts)` returning 'increasing' | 'decreasing' | 'stable'
  - [ ] Implement `detectRisingFrustration(sessionPrompts)` returning boolean
    - [ ] Flag if 3+ consecutive frustrated prompts
    - [ ] Flag if frustration score increases by >0.3 from session start to end
  - [ ] Implement `calculatePolitenessRatio(sessionPrompts)` returning ratio (0-1)
  - [ ] Update session record after each prompt with new metrics
  - [ ] Create session-level sentiment summary on session close

- [ ] **Task 7: Testing** (AC: #2, #3, #4, #5, #7)
  - [ ] Write unit tests for polite detection
  - [ ] Write unit tests for frustrated detection
  - [ ] Write unit tests for directive detection
  - [ ] Write unit tests for collaborative detection
  - [ ] Write unit tests for neutral fallback
  - [ ] Write unit tests for frustration trend calculation
  - [ ] Write unit tests for rising frustration detection
  - [ ] Write unit tests for politeness ratio calculation
  - [ ] Write performance tests ensuring <2ms execution
  - [ ] Create validation dataset and measure 80% target accuracy

## Dev Notes

### Pattern Definitions

```typescript
const POLITE_PATTERNS = [
  { pattern: /please/i, weight: 0.3 },
  { pattern: /thank you|thanks/i, weight: 0.4 },
  { pattern: /could you|would you/i, weight: 0.25 },
  { pattern: /great|awesome|excellent|perfect/i, weight: 0.3 },
  { pattern: /appreciate/i, weight: 0.35 },
  { pattern: /kindly/i, weight: 0.2 },
];

const FRUSTRATED_PATTERNS = [
  { pattern: /why (is|does|doesn't|isn't) (this|it)/i, weight: 0.3 },
  { pattern: /still (not|wrong|broken|failing)/i, weight: 0.5 },
  { pattern: /this (cannot|can't|shouldn't) be/i, weight: 0.4 },
  { pattern: /what the|wtf/i, weight: 0.7 },
  { pattern: /frustrat|annoy|irritat/i, weight: 0.6 },
  { pattern: /again\?!?|another error/i, weight: 0.4 },
  { pattern: /i (don't|cant) understand why/i, weight: 0.35 },
];

const DIRECTIVE_PATTERNS = [
  { pattern: /^(do|make|create|add|remove|fix|update|delete)/i, weight: 0.4 },
  { pattern: /^[A-Z][^.?!]*[^.?!]$/m, weight: 0.2 },
];

const COLLABORATIVE_PATTERNS = [
  { pattern: /let's/i, weight: 0.4 },
  { pattern: /we (could|can|should)/i, weight: 0.35 },
  { pattern: /shall we/i, weight: 0.3 },
  { pattern: /together/i, weight: 0.3 },
  { pattern: /how about we/i, weight: 0.35 },
  { pattern: /what if we/i, weight: 0.3 },
  { pattern: /help me understand/i, weight: 0.25 },
  { pattern: /work with me/i, weight: 0.35 },
];
```

### Result Interface

```typescript
interface SentimentResult {
  sentiment: 'polite' | 'frustrated' | 'neutral' | 'directive' | 'collaborative';
  confidence: number;
  politeScore: number;
  frustratedScore: number;
  directiveScore: number;
  collaborativeScore: number;
}

interface SessionSentimentMetrics {
  frustrationTrend: 'increasing' | 'decreasing' | 'stable';
  frustrationRising: boolean;
  politenessRatio: number; // 0-1, polite_count / (polite_count + frustrated_count)
  sentimentBreakdown: {
    polite: number;
    frustrated: number;
    neutral: number;
    directive: number;
    collaborative: number;
  };
}
```

### Decision Algorithm

```typescript
// Determine sentiment based on thresholds
if (frustratedScore > 0.4) {
  sentiment = 'frustrated';
  confidence = Math.min(0.95, frustratedScore + 0.3);
} else if (collaborativeScore > 0.35) {
  sentiment = 'collaborative';
  confidence = Math.min(0.90, collaborativeScore + 0.25);
} else if (politeScore > 0.3) {
  sentiment = 'polite';
  confidence = Math.min(0.95, politeScore + 0.2);
} else if (directiveScore > 0.3) {
  sentiment = 'directive';
  confidence = Math.min(0.85, directiveScore + 0.2);
} else {
  sentiment = 'neutral';
  confidence = 0.7;
}
```

### Database Migration

```sql
-- Prompt-level sentiment columns
ALTER TABLE prompts ADD COLUMN sentiment VARCHAR(20);
ALTER TABLE prompts ADD COLUMN sentiment_confidence DECIMAL(3,2);
ALTER TABLE prompts ADD COLUMN sentiment_scores JSONB;

ALTER TABLE prompts ADD CONSTRAINT valid_sentiment CHECK (
  sentiment IS NULL OR sentiment IN ('polite', 'frustrated', 'neutral', 'directive', 'collaborative')
);

CREATE INDEX idx_prompts_sentiment ON prompts(sentiment);

-- Session-level sentiment tracking columns
ALTER TABLE sessions ADD COLUMN frustration_trend VARCHAR(20);
ALTER TABLE sessions ADD COLUMN frustration_rising BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN politeness_ratio DECIMAL(3,2);

ALTER TABLE sessions ADD CONSTRAINT valid_frustration_trend CHECK (
  frustration_trend IS NULL OR frustration_trend IN ('increasing', 'decreasing', 'stable')
);

CREATE INDEX idx_sessions_frustration_rising ON sessions(frustration_rising) WHERE frustration_rising = true;
```

### JSONB Storage Format

```json
{
  "polite": 0.35,
  "frustrated": 0.1,
  "directive": 0.2,
  "collaborative": 0.15
}
```

### Performance Requirements

- Execution time: <2ms per prompt
- No external API calls
- Weighted accumulation is O(n) where n = number of patterns

### Session-Level Frustration Tracking Logic

```typescript
// Calculate frustration trend based on session prompts
function calculateFrustrationTrend(prompts: PromptWithSentiment[]): 'increasing' | 'decreasing' | 'stable' {
  if (prompts.length < 3) return 'stable';

  const scores = prompts.map(p => p.sentiment_scores?.frustrated ?? 0);
  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;
  if (diff > 0.1) return 'increasing';
  if (diff < -0.1) return 'decreasing';
  return 'stable';
}

// Detect rising frustration for flagging
function detectRisingFrustration(prompts: PromptWithSentiment[]): boolean {
  if (prompts.length < 3) return false;

  // Check for 3+ consecutive frustrated prompts
  let consecutiveFrustrated = 0;
  for (const prompt of prompts) {
    if (prompt.sentiment === 'frustrated') {
      consecutiveFrustrated++;
      if (consecutiveFrustrated >= 3) return true;
    } else {
      consecutiveFrustrated = 0;
    }
  }

  // Check for frustration score increase > 0.3
  const firstScore = prompts[0].sentiment_scores?.frustrated ?? 0;
  const lastScore = prompts[prompts.length - 1].sentiment_scores?.frustrated ?? 0;
  if (lastScore - firstScore > 0.3) return true;

  return false;
}

// Calculate politeness ratio
function calculatePolitenessRatio(prompts: PromptWithSentiment[]): number {
  const politeCount = prompts.filter(p => p.sentiment === 'polite').length;
  const frustratedCount = prompts.filter(p => p.sentiment === 'frustrated').length;

  if (politeCount + frustratedCount === 0) return 0.5; // neutral default
  return politeCount / (politeCount + frustratedCount);
}
```


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [ ] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [ ] Checked `/design` route for component examples
- [ ] Identified required components from the inventory below
- [ ] Confirmed no hardcoded colors - using semantic tokens only
- [ ] No new UI patterns needed (or Design Epic story created)

### Required Components
<!-- Dev agent: Fill in specific components needed from DESIGN-SYSTEM-MANDATE.md -->
- Review `/design` route and `components/` directory before implementation
- Use semantic tokens: `bg-surface-*`, `text-content-*`, `border-border-*`

### Styling Rules
- NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- Use existing components from `components/` directory
- Extend existing components before creating new ones

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
