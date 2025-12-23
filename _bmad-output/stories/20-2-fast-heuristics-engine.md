# Story 20.2: Fast Heuristics Engine

Status: Ready

## PRD Alignment Note

This story is numbered 20-2 but corresponds to PRD Story 20.1 (Fast Heuristics Engine). The epic was reordered during implementation planning to make the blocking hook (Story 20-1) the foundation, with heuristics built on top. The content and requirements match the PRD exactly.

## Architecture Note

The PRD references `lib/heuristics/` but this story uses `packages/cli/src/lib/heuristics/`. This is correct because the heuristics engine runs in the CLI context (as part of the Claude Code hook), not in the web application. The CLI package is the appropriate location for this code.

## Story
**As a** system,
**I want** to analyze prompts using fast regex-based heuristics,
**So that** I can provide instant feedback without requiring network calls or AI processing.

## Dependencies
- None (foundational story for Epic 20)

## Acceptance Criteria

1. **Given** a prompt text input
   **When** the heuristics engine analyzes it
   **Then** analysis completes in under 50ms
   **And** returns a structured result with detected issues

2. **Given** a very short prompt (< 20 characters)
   **When** analyzed
   **Then** it is flagged as 'too_vague' with severity 'warning'
   **And** message suggests adding more context

3. **Given** a prompt without action verbs or questions
   **When** analyzed
   **Then** it is flagged as 'missing_goal' with severity 'improvement'
   **And** message asks what the user wants Claude to do

4. **Given** an all-caps prompt (> 10 characters)
   **When** analyzed
   **Then** it is flagged as 'ambiguous' with severity 'warning'
   **And** message suggests using normal case

5. **Given** a long prompt (> 500 chars) without structure (no newlines, bullets, or numbers)
   **When** analyzed
   **Then** it is flagged as 'too_long' with severity 'improvement'
   **And** message suggests using bullet points or numbered steps

6. **Given** a prompt that mentions files without providing file paths or content
   **When** analyzed (e.g., "fix that function", "in the file", "this code")
   **Then** it is flagged as 'missing_file_context' with severity 'warning'
   **And** message suggests specifying file paths or including relevant code

7. **Given** sensitivity level 'low'
   **When** analyzing prompts
   **Then** only 'warning' severity issues trigger suggestions
   **And** 'improvement' severity issues are ignored

8. **Given** sensitivity level 'high'
   **When** analyzing prompts
   **Then** all issues trigger suggestions regardless of severity

9. **Given** sensitivity level 'medium' (default)
   **When** analyzing prompts
   **Then** 'warning' issues always trigger
   **And** 'improvement' issues trigger if 2+ are detected

## Technical Context

### File Locations
| File | Purpose |
|------|---------|
| `packages/cli/src/lib/heuristics/fast-check.ts` | Core heuristics engine |
| `packages/cli/src/lib/heuristics/patterns.ts` | Regex patterns and rules |
| `packages/cli/src/lib/heuristics/suggestion-generator.ts` | Generate improved prompts |
| `packages/cli/src/bin/contextor-heuristics.ts` | CLI binary entry point |

### Heuristics Result Schema
```typescript
export interface HeuristicResult {
  shouldSuggest: boolean;
  issues: HeuristicIssue[];
  suggestion?: string;
  executionTimeMs: number;
}

export interface HeuristicIssue {
  type: 'too_vague' | 'no_context' | 'missing_goal' | 'ambiguous' | 'too_long' | 'missing_file_context';
  severity: 'warning' | 'improvement';
  message: string;
  pattern?: string;  // The pattern that matched (for debugging)
}

export type SensitivityLevel = 'low' | 'medium' | 'high';
```

### Heuristic Rules Matrix
| Type | Condition | Severity | Message |
|------|-----------|----------|---------|
| `too_vague` | length < 20 chars | warning | "Prompt is very short. Consider adding more context." |
| `missing_goal` | No action verb or question mark | improvement | "Prompt doesn't have a clear ask. What do you want Claude to do?" |
| `ambiguous` | All caps and length > 10 | warning | "All caps can be hard to parse. Consider normal case." |
| `too_long` | length > 500, no structure | improvement | "Long prompt without structure. Consider using bullet points or numbered steps." |
| `no_context` | Short prompt with pronouns only | warning | "Prompt uses pronouns without context. What is 'it' or 'this'?" |
| `missing_file_context` | Mentions files/code without paths | warning | "Prompt mentions files or code but doesn't specify paths. Include file paths or relevant code." |

## Tasks / Subtasks

- [ ] **Task 1: Create Patterns Module** (AC: #2, #3, #4, #5, #6)
  - [ ] Create `packages/cli/src/lib/heuristics/patterns.ts`
  - [ ] Define regex patterns for each heuristic type
  - [ ] Define action verbs list: `please|help|show|create|fix|add|update|remove|explain|build|implement|write|delete|change|modify|refactor|test|debug`
  - [ ] Define structure indicators: newlines, `-`, `*`, numbered lists `1.`
  - [ ] Define pronoun-only pattern for no_context detection
  - [ ] Define file reference pattern for missing_file_context: `in the file`, `that function`, `this code`, `the component` without file paths

- [ ] **Task 2: Create Core Heuristics Engine** (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Create `packages/cli/src/lib/heuristics/fast-check.ts`
  - [ ] Implement `HeuristicChecker` class
  - [ ] Implement array of check functions
  - [ ] Measure execution time and include in result
  - [ ] Return all issues detected (not just first match)
  - [ ] Ensure total execution < 50ms

- [ ] **Task 3: Implement Sensitivity Filtering** (AC: #7, #8, #9)
  - [ ] Add `filterBySensitivity(issues, level)` function
  - [ ] Low: only return warnings
  - [ ] High: return all issues
  - [ ] Medium: warnings + improvements if 2+ improvements
  - [ ] Calculate `shouldSuggest` based on filtered issues

- [ ] **Task 4: Create Suggestion Generator** (AC: #2, #3, #4, #5, #6)
  - [ ] Create `packages/cli/src/lib/heuristics/suggestion-generator.ts`
  - [ ] Implement `generateSuggestion(prompt, issues)` function
  - [ ] Add structure to long prompts (bullets)
  - [ ] Add question if missing goal
  - [ ] Lowercase all-caps text
  - [ ] Suggest adding file paths for missing_file_context issues
  - [ ] Return null if no meaningful improvement can be made

- [ ] **Task 5: Create CLI Binary** (AC: #1, #7, #8)
  - [ ] Create `packages/cli/src/bin/contextor-heuristics.ts`
  - [ ] Accept prompt as command-line argument
  - [ ] Accept `--sensitivity` flag (default: medium)
  - [ ] Output JSON result to stdout
  - [ ] Exit 0 on success, 1 on error
  - [ ] Configure in package.json bin section

- [ ] **Task 6: Add Unit Tests** (AC: #1, #2, #3, #4, #5, #6, #7, #8, #9)
  - [ ] Test each heuristic rule individually
  - [ ] Test missing_file_context detection
  - [ ] Test sensitivity filtering
  - [ ] Test execution time < 50ms with performance test
  - [ ] Test edge cases (empty, very long, unicode)
  - [ ] Test suggestion generation

## Dev Notes

### Core Heuristics Implementation
```typescript
// packages/cli/src/lib/heuristics/fast-check.ts

export interface HeuristicResult {
  shouldSuggest: boolean;
  issues: HeuristicIssue[];
  suggestion?: string;
  executionTimeMs: number;
}

export interface HeuristicIssue {
  type: 'too_vague' | 'no_context' | 'missing_goal' | 'ambiguous' | 'too_long' | 'missing_file_context';
  severity: 'warning' | 'improvement';
  message: string;
}

const ACTION_VERBS_PATTERN = /\b(please|help|show|create|fix|add|update|remove|explain|build|implement|write|delete|change|modify|refactor|test|debug|find|search|list|get|set|run|check|verify)\b/i;
const HAS_QUESTION = /\?/;
const HAS_STRUCTURE = /[\n]|^[-*]|^\d+\./m;
const PRONOUN_ONLY = /^(it|this|that)\s/i;
// Pattern to detect file/code references without actual paths
const FILE_REFERENCE_PATTERN = /\b(in the file|that function|this code|the component|that file|this file|the function|that method|this method|the class|that class)\b/i;
// Pattern to detect actual file paths (if present, don't flag)
const HAS_FILE_PATH = /[\/\\][\w.-]+\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|c|cpp|h|css|scss|html|json|yaml|yml|md|sql)/i;

type HeuristicCheck = (prompt: string) => HeuristicIssue | null;

const HEURISTICS: HeuristicCheck[] = [
  // Too short / vague
  (p) => p.trim().length < 20 ? {
    type: 'too_vague',
    severity: 'warning',
    message: 'Prompt is very short. Consider adding more context.'
  } : null,

  // No question or action verb
  (p) => (!ACTION_VERBS_PATTERN.test(p) && !HAS_QUESTION.test(p)) ? {
    type: 'missing_goal',
    severity: 'improvement',
    message: "Prompt doesn't have a clear ask. What do you want Claude to do?"
  } : null,

  // All caps (shouting)
  (p) => (p === p.toUpperCase() && p.length > 10 && /[A-Z]/.test(p)) ? {
    type: 'ambiguous',
    severity: 'warning',
    message: 'All caps can be hard to parse. Consider normal case.'
  } : null,

  // Very long without structure
  (p) => (p.length > 500 && !HAS_STRUCTURE.test(p)) ? {
    type: 'too_long',
    severity: 'improvement',
    message: 'Long prompt without structure. Consider using bullet points or numbered steps.'
  } : null,

  // Pronoun without context
  (p) => (p.trim().length < 50 && PRONOUN_ONLY.test(p.trim())) ? {
    type: 'no_context',
    severity: 'warning',
    message: "Prompt uses pronouns without context. What is 'it' or 'this'?"
  } : null,

  // File/code references without actual paths
  (p) => (FILE_REFERENCE_PATTERN.test(p) && !HAS_FILE_PATH.test(p)) ? {
    type: 'missing_file_context',
    severity: 'warning',
    message: "Prompt mentions files or code but doesn't specify paths. Include file paths or relevant code."
  } : null,
];

export function runHeuristics(
  prompt: string,
  sensitivity: SensitivityLevel = 'medium'
): HeuristicResult {
  const startTime = performance.now();
  const issues: HeuristicIssue[] = [];

  for (const check of HEURISTICS) {
    const issue = check(prompt);
    if (issue) issues.push(issue);
  }

  const filteredIssues = filterBySensitivity(issues, sensitivity);
  const executionTimeMs = performance.now() - startTime;

  return {
    shouldSuggest: filteredIssues.length > 0,
    issues: filteredIssues,
    suggestion: filteredIssues.length > 0 ? generateSuggestion(prompt, filteredIssues) : undefined,
    executionTimeMs
  };
}

function filterBySensitivity(
  issues: HeuristicIssue[],
  sensitivity: SensitivityLevel
): HeuristicIssue[] {
  switch (sensitivity) {
    case 'low':
      return issues.filter(i => i.severity === 'warning');
    case 'high':
      return issues;
    case 'medium':
    default:
      const warnings = issues.filter(i => i.severity === 'warning');
      const improvements = issues.filter(i => i.severity === 'improvement');
      // Include improvements only if 2+ found
      if (improvements.length >= 2) {
        return issues;
      }
      return warnings;
  }
}
```

### CLI Binary Implementation
```typescript
// packages/cli/src/bin/contextor-heuristics.ts
#!/usr/bin/env node

import { runHeuristics, SensitivityLevel } from '../lib/heuristics/fast-check';

const args = process.argv.slice(2);
let sensitivity: SensitivityLevel = 'medium';
let prompt = '';

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--sensitivity=')) {
    sensitivity = args[i].split('=')[1] as SensitivityLevel;
  } else {
    prompt = args[i];
  }
}

if (!prompt) {
  console.error('Usage: contextor-heuristics [--sensitivity=low|medium|high] "<prompt>"');
  process.exit(1);
}

try {
  const result = runHeuristics(prompt, sensitivity);

  if (result.shouldSuggest) {
    console.log(JSON.stringify({
      version: "1.0",
      timestamp: new Date().toISOString(),
      original_prompt: prompt,
      issues: result.issues,
      suggested_prompt: result.suggestion
    }));
  }
  // Output nothing if no suggestions (handled by hook script)
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
```

### Package.json Update
```json
{
  "bin": {
    "contextor": "./dist/bin/contextor.js",
    "contextor-heuristics": "./dist/bin/contextor-heuristics.js"
  }
}
```

### Performance Considerations
- All checks are regex-based (no network calls)
- Single pass through prompt for most checks
- Compiled regex patterns (defined as constants)
- No file I/O during analysis
- Target: < 50ms for any prompt length

### Testing Performance
```typescript
describe('Heuristics Performance', () => {
  it('completes analysis in under 50ms', () => {
    const longPrompt = 'a'.repeat(10000);
    const start = performance.now();
    runHeuristics(longPrompt);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
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
