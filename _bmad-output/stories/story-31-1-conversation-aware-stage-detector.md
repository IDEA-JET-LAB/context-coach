# Story 31-1: Conversation-Aware Stage Detector

## Story Info
- **Epic:** 31 - Project Stage Analytics
- **Priority:** P0 (Foundation)
- **Points:** 5
- **Status:** Done

## Description

Create a service that analyzes an entire conversation to detect project stages and transitions, then assigns a stage to each prompt. The key insight is that stage detection requires conversation context - a single prompt like "yes" or "continue" can't be classified in isolation.

The detector works as a state machine: it tracks the current stage and propagates it forward until a strong signal triggers a transition to a new stage.

## Acceptance Criteria

- [x] Analyze prompts in sequence (not isolation)
- [x] Detect stage transitions based on signal prompts
- [x] Propagate stage forward until new stage detected
- [x] Handle ambiguous prompts (confirmations, selections) by inheriting previous stage
- [x] Return array of `{ promptId, detectedStage, confidence, isTransitionPoint }`
- [x] Support all ProjectStage values: planning, development, testing, debugging, refactoring, documentation, deployment, review, architecture, specification, enhancement, exploration, unknown
- [x] Unit tests with real conversation examples (>90% coverage)

## Technical Details

### File Structure

```
app/lib/analysis/
├── stage-detector.ts           # Main detector service
├── stage-patterns.ts           # Stage signal patterns
├── __tests__/
│   ├── stage-detector.test.ts
│   └── stage-patterns.test.ts
```

### Types

```typescript
// lib/analysis/stage-detector.ts

import type { ProjectStage } from '@/lib/types/conversations';

export interface StageDetectionResult {
  promptId: string;
  detectedStage: ProjectStage;
  confidence: number;           // 0-1, how confident we are
  isTransitionPoint: boolean;   // True if this prompt started a new stage
  signalPattern?: string;       // Pattern that triggered detection (for debugging)
}

export interface ConversationPromptInput {
  id: string;
  text: string;
  sequenceNumber: number;
  timestamp: string;
}

export interface StageDetectorOptions {
  defaultStage?: ProjectStage;  // Default: 'development'
  minConfidence?: number;       // Default: 0.6
}
```

### Stage Signal Patterns

```typescript
// lib/analysis/stage-patterns.ts

export const STAGE_PATTERNS: Record<ProjectStage, {
  patterns: RegExp[];
  priority: number;      // Higher = checked first
  minConfidence: number; // Minimum confidence when matched
}> = {
  planning: {
    patterns: [
      /\b(let'?s?\s+plan|how\s+should\s+we|what'?s?\s+the\s+approach)\b/i,
      /\b(architecture|design|strategy|roadmap)\b/i,
      /\b(before\s+we\s+start|first\s+let'?s?\s+think)\b/i,
    ],
    priority: 90,
    minConfidence: 0.85,
  },

  development: {
    patterns: [
      /\b(implement|create|add|build|write)\s+(a\s+|the\s+)?(feature|function|component|service)\b/i,
      /\b(let'?s?\s+build|start\s+coding|implement\s+this)\b/i,
      /\bcreate\s+(a\s+)?new\s+(file|component|function)\b/i,
    ],
    priority: 50,
    minConfidence: 0.75,
  },

  testing: {
    patterns: [
      /\b(add\s+)?tests?\b/i,
      /\b(write|run|add)\s+(unit\s+|e2e\s+|integration\s+)?tests?\b/i,
      /\b(playwright|jest|vitest|spec)\b/i,
      /\btest\s+coverage\b/i,
    ],
    priority: 70,
    minConfidence: 0.85,
  },

  debugging: {
    patterns: [
      /\b(fix|debug|broken|not\s+working|bug)\b/i,
      /\b(error|exception|crash|fail(ing|ed)?)\b/i,
      /\bwhy\s+(is|does|isn'?t|doesn'?t)\b/i,
      /\b(investigate|figure\s+out|what'?s?\s+wrong)\b/i,
    ],
    priority: 80,
    minConfidence: 0.80,
  },

  refactoring: {
    patterns: [
      /\brefactor\b/i,
      /\b(clean\s+up|improve|optimize|simplify)\b/i,
      /\b(rename|extract|move|reorganize)\b/i,
    ],
    priority: 60,
    minConfidence: 0.80,
  },

  documentation: {
    patterns: [
      /\b(document|docs?|readme|comment)\b/i,
      /\b(add|write|update)\s+(documentation|comments)\b/i,
      /\bexplain\s+(this|the|how)\b/i,
    ],
    priority: 55,
    minConfidence: 0.80,
  },

  deployment: {
    patterns: [
      /\b(deploy|release|publish|ship)\b/i,
      /\b(production|staging|ci\/?cd)\b/i,
      /\b(docker|kubernetes|cloud\s+run)\b/i,
    ],
    priority: 75,
    minConfidence: 0.85,
  },

  review: {
    patterns: [
      /\b(review|check|verify|validate)\b/i,
      /\b(lgtm|looks\s+good|approved)\b/i,
      /\b(pr|pull\s+request|code\s+review)\b/i,
    ],
    priority: 65,
    minConfidence: 0.75,
  },

  // ... other stages with similar structure
};
```

### Detection Algorithm

```typescript
/**
 * Analyzes a conversation and detects stages for each prompt.
 * Works as a state machine - tracks current stage and propagates forward.
 */
export function detectConversationStages(
  prompts: ConversationPromptInput[],
  options: StageDetectorOptions = {}
): StageDetectionResult[] {
  const { defaultStage = 'development', minConfidence = 0.6 } = options;

  const results: StageDetectionResult[] = [];
  let currentStage: ProjectStage = defaultStage;
  let currentConfidence = 0.5;

  // Sort by sequence number to ensure order
  const sortedPrompts = [...prompts].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  for (const prompt of sortedPrompts) {
    const detection = detectStageFromPrompt(prompt.text, minConfidence);

    if (detection) {
      // Strong signal - transition to new stage
      results.push({
        promptId: prompt.id,
        detectedStage: detection.stage,
        confidence: detection.confidence,
        isTransitionPoint: detection.stage !== currentStage,
        signalPattern: detection.matchedPattern,
      });
      currentStage = detection.stage;
      currentConfidence = detection.confidence;
    } else {
      // No strong signal - inherit previous stage
      results.push({
        promptId: prompt.id,
        detectedStage: currentStage,
        confidence: currentConfidence * 0.9, // Slightly decay confidence
        isTransitionPoint: false,
      });
    }
  }

  return results;
}

/**
 * Attempts to detect stage from a single prompt.
 * Returns null if no strong signal found.
 */
function detectStageFromPrompt(
  text: string,
  minConfidence: number
): { stage: ProjectStage; confidence: number; matchedPattern: string } | null {
  // Check patterns in priority order
  const stagesByPriority = Object.entries(STAGE_PATTERNS)
    .sort((a, b) => b[1].priority - a[1].priority);

  for (const [stage, config] of stagesByPriority) {
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        if (config.minConfidence >= minConfidence) {
          return {
            stage: stage as ProjectStage,
            confidence: config.minConfidence,
            matchedPattern: pattern.source,
          };
        }
      }
    }
  }

  return null;
}
```

### Handling Edge Cases

1. **First prompt**: Use signal detection, fallback to default stage
2. **Slash commands**: Map to stages (e.g., `/commit` → development, `/test` → testing)
3. **Confirmations** ("yes", "ok"): Inherit previous stage (no transition)
4. **Mixed signals**: Use highest priority pattern match
5. **Very short prompts** (<10 chars): Inherit previous stage

## Tests

### Unit Tests

```typescript
describe('StageDetector', () => {
  describe('detectConversationStages', () => {
    it('should detect development stage from "implement auth feature"');
    it('should detect debugging stage from "fix this bug"');
    it('should detect testing stage from "add unit tests"');
    it('should propagate stage through confirmation prompts');
    it('should detect stage transitions within conversation');
    it('should handle empty conversation');
    it('should handle single prompt conversation');
  });

  describe('detectStageFromPrompt', () => {
    it('should return null for confirmation prompts like "yes"');
    it('should detect debugging from error descriptions');
    it('should detect testing from test-related keywords');
    it('should respect pattern priority');
    it('should handle case-insensitive matching');
  });

  describe('slash command handling', () => {
    it('should map /commit to development');
    it('should map /test to testing');
    it('should map /deploy to deployment');
  });
});
```

### Integration Tests

```typescript
describe('Stage detection with real conversations', () => {
  it('should correctly classify a development → debugging → testing flow');
  it('should handle long conversations (50+ prompts)');
  it('should maintain accuracy >85% on labeled test set');
});
```

## Dependencies

- None (foundation story)

## Definition of Done

- [x] `detectConversationStages()` function implemented
- [x] All stage patterns defined and tested
- [x] Slash command mapping implemented
- [x] Unit tests passing (>90% coverage)
- [x] Integration tests with real conversation examples
- [x] Performance: <100ms for 100-prompt conversation
