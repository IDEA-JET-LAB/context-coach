# Story 21.4: Prompt Complexity Metrics

Status: Complete

## Story

**As a** developer using Contextor,
**I want** each prompt analyzed for structural complexity (character count, word count, sentence count, code detection, file references),
**So that** I can understand the depth of my prompts and how complexity affects AI response quality.

## Acceptance Criteria

1. **Given** a prompt is captured
   **When** complexity analysis runs
   **Then** the prompt receives sentence_count, has_code, has_file_refs, code_block_count, file_ref_count, complexity_level, and complexity_score

2. **Given** a prompt contains fenced code blocks (```)
   **When** analyzed
   **Then** `has_code` is true and `code_block_count` reflects the number of blocks

3. **Given** a prompt contains file extensions (.ts, .tsx, .js, .py, etc.) or path patterns
   **When** analyzed
   **Then** `has_file_refs` is true and `file_ref_count` reflects the count

4. **Given** complexity scoring factors
   **When** calculated
   **Then** prompts >500 chars add 20 points, >3 sentences add 20 points, code adds 25 points, file refs add 15 points

5. **Given** a complexity score is calculated
   **When** level is determined
   **Then** score >=60 = "complex", >=30 = "moderate", <30 = "simple"

6. **Given** any prompt
   **When** complexity analysis runs
   **Then** it completes in under 2ms

7. **Given** `char_count` and `word_count` already exist in the prompts table
   **When** this story is implemented
   **Then** those existing fields are utilized (not duplicated)

## Tasks / Subtasks

- [x] **Task 1: Database Schema Updates** (AC: #1, #7)
  - [x] Add `sentence_count INTEGER` to prompts table
  - [x] Add `has_code BOOLEAN DEFAULT false` to prompts table
  - [x] Add `has_file_refs BOOLEAN DEFAULT false` to prompts table
  - [x] Add `code_block_count INTEGER DEFAULT 0` to prompts table
  - [x] Add `file_ref_count INTEGER DEFAULT 0` to prompts table
  - [x] Add `complexity_level VARCHAR(20)` to prompts table
  - [x] Add `complexity_score INTEGER` to prompts table
  - [x] Add CHECK constraint for valid complexity_level values
  - [x] Add index on complexity_level

- [x] **Task 2: Implement Complexity Analyzer** (AC: #1, #2, #3, #6)
  - [x] Create `/app/lib/analysis/complexity-analyzer.ts`
  - [x] Define `ComplexityMetrics` interface
  - [x] Implement sentence counting (split by .!?)
  - [x] Implement code detection (fenced blocks, inline code, keywords)
  - [x] Implement file reference detection (extensions, paths)
  - [x] Implement `analyzeComplexity(promptText)` function

- [x] **Task 3: Define Detection Patterns** (AC: #2, #3)
  - [x] Code patterns:
    - [x] Fenced code blocks: /```[\s\S]*?```/g
    - [x] Inline code: /`[^`]+`/g
    - [x] JS keywords: /\b(function|const|let|var|class|interface|type|import|export)\b/
    - [x] Operators: /=>|===|!==|\|\||&&/
  - [x] File reference patterns:
    - [x] Extensions: /\.(ts|tsx|js|jsx|py|go|rs|sql|md|json|yaml|yml|css|scss|html)\b/gi
    - [x] Path patterns: /\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_\-/.]+/g
    - [x] Absolute paths: /\/Users\/[^\s]+/g
    - [x] Relative paths: /\.\/[^\s]+/g

- [x] **Task 4: Implement Complexity Scoring** (AC: #4, #5)
  - [x] Length factors: >500 chars (+20), >200 chars (+10)
  - [x] Structure factors: >3 sentences (+20), >1 sentence (+10)
  - [x] Technical factors: has_code (+25), has_file_refs (+15)
  - [x] Code blocks: +5 per block (max +10)
  - [x] Word complexity: avg word length >6 (+10)
  - [x] Cap score at 100
  - [x] Determine level based on thresholds

- [x] **Task 5: Integrate into Capture Flow** (AC: #1, #7)
  - [x] Call complexity analyzer in prompt capture API
  - [x] Store all metrics in prompts table
  - [x] Use existing char_count and word_count values
  - [x] Run in parallel with other classifiers

- [x] **Task 6: Testing** (AC: #2, #3, #4, #5, #6)
  - [x] Write unit tests for sentence counting edge cases
  - [x] Write unit tests for code detection (fenced, inline, keyword)
  - [x] Write unit tests for file reference detection
  - [x] Write unit tests for complexity scoring
  - [x] Write performance tests ensuring <2ms
  - [x] Test with real prompts from transcript analysis

## Dev Notes

### ComplexityMetrics Interface

```typescript
export interface ComplexityMetrics {
  charCount: number;
  wordCount: number;
  sentenceCount: number;
  hasCode: boolean;
  hasFileRefs: boolean;
  codeBlockCount: number;
  fileRefCount: number;
  complexityLevel: 'simple' | 'moderate' | 'complex';
  complexityScore: number;  // 0-100
}
```

### Scoring Algorithm

```typescript
function calculateComplexityScore(metrics: Partial<ComplexityMetrics>): number {
  let score = 0;

  // Length factors
  if (metrics.charCount! > 500) score += 20;
  else if (metrics.charCount! > 200) score += 10;

  // Structure factors
  if (metrics.sentenceCount! > 3) score += 20;
  else if (metrics.sentenceCount! > 1) score += 10;

  // Technical factors
  if (metrics.hasCode) score += 25;
  if (metrics.hasFileRefs) score += 15;
  score += Math.min(10, metrics.codeBlockCount! * 5);

  // Word complexity
  const avgWordLength = metrics.charCount! / Math.max(1, metrics.wordCount!);
  if (avgWordLength > 6) score += 10;

  return Math.min(100, score);
}
```

### Level Thresholds

| Score Range | Level |
|-------------|-------|
| 60-100 | complex |
| 30-59 | moderate |
| 0-29 | simple |

### Database Migration

```sql
ALTER TABLE prompts ADD COLUMN sentence_count INTEGER;
ALTER TABLE prompts ADD COLUMN has_code BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN has_file_refs BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN code_block_count INTEGER DEFAULT 0;
ALTER TABLE prompts ADD COLUMN file_ref_count INTEGER DEFAULT 0;
ALTER TABLE prompts ADD COLUMN complexity_level VARCHAR(20);
ALTER TABLE prompts ADD COLUMN complexity_score INTEGER;

ALTER TABLE prompts ADD CONSTRAINT valid_complexity_level CHECK (
  complexity_level IS NULL OR complexity_level IN ('simple', 'moderate', 'complex')
);

CREATE INDEX idx_prompts_complexity ON prompts(complexity_level);
```

### Code Detection Patterns

```typescript
const CODE_PATTERNS = [
  /```[\s\S]*?```/g,           // Fenced code blocks
  /`[^`]+`/g,                  // Inline code
  /\b(function|const|let|var|class|interface|type|import|export)\b/,
  /=>|===|!==|\|\||&&/,        // JS operators
];

const FILE_REF_PATTERNS = [
  /\.(ts|tsx|js|jsx|py|go|rs|sql|md|json|yaml|yml|css|scss|html)\b/gi,
  /\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_\-/.]+/g,
  /\/Users\/[^\s]+/g,
  /\.\/[^\s]+/g,
];
```

### Performance Requirements

- Execution time: <2ms per prompt
- Pattern matching is O(n) where n = prompt length
- No external dependencies


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
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List
- Implemented ComplexityMetrics interface with all required fields
- Created sentence counting that properly excludes code blocks
- Code detection handles fenced blocks, inline code, and code patterns (keywords, operators)
- File reference detection handles extensions (.ts, .tsx, .py, etc.) and paths (absolute/relative)
- Scoring algorithm matches spec: length (+10/+20), sentences (+10/+20), code (+25), file refs (+15), blocks (+5 each max +10), word complexity (+10)
- Level thresholds: simple <30, moderate 30-59, complex 60+
- All 80 unit tests pass with performance tests confirming <2ms execution
- Integrated into store-prompt.ts to run synchronously with classification
- This is a backend-only story (no UI components needed) - complexity analysis runs during prompt capture

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2025-12-23 | Initial implementation of complexity analyzer | Claude Opus 4.5 |
| 2025-12-23 | Added 80 unit tests with performance verification | Claude Opus 4.5 |
| 2025-12-23 | Integrated into store-prompt flow | Claude Opus 4.5 |

### File List
**Created:**
- `/app/lib/analysis/complexity-analyzer.ts` - Main complexity analysis module
- `/app/lib/analysis/index.ts` - Module exports
- `/app/lib/analysis/__tests__/complexity-analyzer.test.ts` - 80 unit tests
- `/app/supabase/migrations/20251223170000_add_complexity_metrics.sql` - Database migration

**Modified:**
- `/app/lib/capture/store-prompt.ts` - Added complexity analysis integration
- `/app/lib/types/prompt.ts` - Added ComplexityLevel type and complexity fields to Prompt interface
