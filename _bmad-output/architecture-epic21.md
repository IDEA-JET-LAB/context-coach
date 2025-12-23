# Epic 21: Enhanced Analysis Framework - Architecture Design

**Status:** Design Phase
**Date:** 2025-12-23
**Author:** Architecture Agent
**Dependencies:** Epic 16 (Sessions), Epic 15 (Response Context)
**Research Reference:** `_bmad-output/research/transcript-analysis-findings.md`

---

## Table of Contents

- [Executive Summary](#executive-summary) (Line 25)
- [Architecture Overview](#architecture-overview) (Line 45)
  - [Data Flow Diagram](#data-flow-diagram) (Line 47)
  - [Component Architecture](#component-architecture) (Line 85)
- [Analysis Dimensions Implementation](#analysis-dimensions-implementation) (Line 110)
  - [Story 21.1: Context Window Management](#story-211-context-window-management) (Line 112)
  - [Story 21.2: Work Style Categorization](#story-212-work-style-categorization) (Line 155)
  - [Story 21.3: Sentiment Analysis](#story-213-sentiment-analysis) (Line 230)
  - [Story 21.4: Prompt Complexity](#story-214-prompt-complexity) (Line 290)
  - [Story 21.5: Interaction Timing](#story-215-interaction-timing) (Line 340)
  - [Story 21.6: Tool Usage Profiling](#story-216-tool-usage-profiling) (Line 390)
  - [Story 21.7: Session Health Score](#story-217-session-health-score) (Line 440)
  - [Story 21.8: Technical Depth Profile](#story-218-technical-depth-profile) (Line 510)
  - [Story 21.9: Learning Progression](#story-219-learning-progression) (Line 560)
  - [Story 21.10: Workflow Efficiency](#story-2110-workflow-efficiency) (Line 610)
  - [Story 21.11: Interactive Insights Dashboard](#story-2111-interactive-insights-dashboard) (Line 650)
  - [Story 21.12: Team Intelligence](#story-2112-team-intelligence) (Line 700)
- [Classification Algorithms](#classification-algorithms) (Line 750)
  - [Algorithm Selection Matrix](#algorithm-selection-matrix) (Line 752)
  - [Regex-Based Classifiers](#regex-based-classifiers) (Line 785)
  - [Heuristic Classifiers](#heuristic-classifiers) (Line 850)
  - [Performance Requirements](#performance-requirements) (Line 890)
- [Aggregation Pipelines](#aggregation-pipelines) (Line 920)
  - [Real-time Per-Prompt Analysis](#real-time-per-prompt-analysis) (Line 922)
  - [Daily Aggregation Pipeline](#daily-aggregation-pipeline) (Line 980)
  - [Weekly/Monthly Trend Calculations](#weeklymonthly-trend-calculations) (Line 1040)
  - [Team-Level Rollups](#team-level-rollups) (Line 1090)
- [Database Schema](#database-schema) (Line 1140)
  - [Schema Overview](#schema-overview) (Line 1142)
  - [Complete SQL Migration](#complete-sql-migration) (Line 1160)
  - [RLS Policies](#rls-policies) (Line 1400)
  - [Indexes for Performance](#indexes-for-performance) (Line 1480)
- [API Endpoints](#api-endpoints) (Line 1530)
  - [Individual Prompt Analysis](#individual-prompt-analysis) (Line 1532)
  - [User Insights Dashboard](#user-insights-dashboard) (Line 1580)
  - [Team Intelligence](#team-intelligence-api) (Line 1650)
  - [Learning Progression](#learning-progression-api) (Line 1710)
- [TypeScript Interfaces](#typescript-interfaces) (Line 1760)
- [Performance Considerations](#performance-considerations) (Line 1950)
- [Implementation Phases](#implementation-phases) (Line 2020)

---

## Executive Summary

Epic 21 transforms Contextor from basic prompt scoring into a **comprehensive behavioral intelligence platform**. Based on analysis of 2,498 real user prompts, this architecture implements 25+ feedback dimensions across four tiers:

1. **Per-Prompt Analysis** - Enhanced with work style, sentiment, and complexity
2. **Per-Session Analysis** - Health score, efficiency, context management
3. **Per-User Profiling** - Technical depth, learning progression, workflow efficiency
4. **Team Intelligence** - Best practices, common struggles, style distribution

**Key Design Decisions:**
- **Regex-based classifiers** for deterministic, fast (<5ms) analysis
- **Postgres aggregation functions** for real-time dashboards
- **Materialized views** for expensive trend calculations
- **Incremental daily aggregation** to avoid full table scans
- **RLS-protected** multi-tenant access

---

## Architecture Overview

### Data Flow Diagram

```
                         CAPTURE FLOW
                         ============

┌─────────────┐    ┌──────────────┐    ┌──────────────────┐
│ Claude Code │───>│ Capture Hook │───>│ /api/prompts/    │
│   Prompt    │    │  (CLI)       │    │   capture        │
└─────────────┘    └──────────────┘    └────────┬─────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────┐
│                    PROMPT INSERT                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 1. Store prompt with enhanced fields                │ │
│  │    - work_style_category (sync)                     │ │
│  │    - sentiment (sync)                               │ │
│  │    - complexity metrics (sync)                      │ │
│  │ 2. Update session metrics                           │ │
│  │ 3. Trigger async AI analysis                        │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │ Sync       │  │ Session    │  │ Async AI   │
   │ Classifiers│  │ Update     │  │ Analysis   │
   │ (<5ms)     │  │ Trigger    │  │ Edge Fn    │
   └────────────┘  └────────────┘  └────────────┘
          │               │               │
          ▼               ▼               ▼
   ┌─────────────────────────────────────────────┐
   │              AGGREGATION JOBS               │
   │  ┌────────────────────────────────────────┐ │
   │  │ 1. user_daily_analytics (daily cron)   │ │
   │  │ 2. team_daily_analytics (daily cron)   │ │
   │  │ 3. session_health refresh (on session) │ │
   │  │ 4. learning_progression (weekly cron)  │ │
   │  └────────────────────────────────────────┘ │
   └─────────────────────────────────────────────┘
                          │
                          ▼
   ┌─────────────────────────────────────────────┐
   │              DASHBOARD APIS                 │
   │  - /api/analytics/personal                  │
   │  - /api/analytics/team                      │
   │  - /api/analytics/insights                  │
   │  - /api/analytics/learning                  │
   └─────────────────────────────────────────────┘
```

### Component Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Insights        │  │ Team            │  │ Learning        │  │
│  │ Dashboard       │  │ Intelligence    │  │ Progression     │  │
│  │ (Story 21.11)   │  │ (Story 21.12)   │  │ (Story 21.9)    │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │            │
│  ┌────────┴────────────────────┴────────────────────┴────────┐  │
│  │                    React Query Hooks                       │  │
│  │  - useEnhancedPersonalAnalytics                           │  │
│  │  - useTeamIntelligence                                    │  │
│  │  - useLearningProgression                                 │  │
│  │  - useSessionHealth                                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│                         API LAYER                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Next.js API Routes                                          │ │
│  │  POST /api/prompts/capture      → Enhanced prompt storage   │ │
│  │  GET  /api/analytics/personal   → Personal insights         │ │
│  │  GET  /api/analytics/team       → Team intelligence         │ │
│  │  GET  /api/analytics/learning   → Learning progression      │ │
│  │  GET  /api/analytics/session/:id → Session health           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│                     ANALYSIS ENGINE                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐                      │
│  │ Sync Classifiers │  │ Async AI Engine  │                      │
│  │ (< 5ms/prompt)   │  │ (Edge Function)  │                      │
│  │                  │  │                  │                      │
│  │ - WorkStyle      │  │ - Clarity score  │                      │
│  │ - Sentiment      │  │ - Context score  │                      │
│  │ - Complexity     │  │ - Constraints    │                      │
│  │ - Timing         │  │ - Suggestions    │                      │
│  └──────────────────┘  └──────────────────┘                      │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│                      DATA LAYER                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐   │
│  │ prompts      │  │ sessions       │  │ user_daily_        │   │
│  │ (enhanced)   │  │ (new)          │  │ analytics          │   │
│  └──────────────┘  └────────────────┘  └────────────────────┘   │
│                                                                   │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐   │
│  │ session_     │  │ team_daily_    │  │ learning_          │   │
│  │ tool_usage   │  │ analytics      │  │ progression        │   │
│  └──────────────┘  └────────────────┘  └────────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Analysis Dimensions Implementation

### Story 21.1: Context Window Management

**Objective:** Detect context exhaustion patterns and provide optimization feedback.

**Implementation Approach:**

```typescript
// lib/analysis/context-management.ts

interface ContextExhaustionResult {
  isExhausted: boolean;
  confidence: number;
  detectionMethod: 'keyword' | 'session_duration' | 'pattern';
}

const EXHAUSTION_PATTERNS = [
  /continued from a previous conversation/i,
  /ran out of context/i,
  /context limit/i,
  /start fresh/i,
  /new conversation/i,
  /let me summarize where we were/i,
  /picking up from/i,
];

const EXHAUSTION_THRESHOLD_MINUTES = 90;

function detectContextExhaustion(
  promptText: string,
  sessionDurationMinutes: number
): ContextExhaustionResult {
  // Method 1: Keyword detection (highest confidence)
  for (const pattern of EXHAUSTION_PATTERNS) {
    if (pattern.test(promptText)) {
      return { isExhausted: true, confidence: 0.95, detectionMethod: 'keyword' };
    }
  }

  // Method 2: Session duration heuristic (moderate confidence)
  if (sessionDurationMinutes > EXHAUSTION_THRESHOLD_MINUTES) {
    return { isExhausted: false, confidence: 0.6, detectionMethod: 'session_duration' };
  }

  return { isExhausted: false, confidence: 0, detectionMethod: 'pattern' };
}
```

**Database Additions:**

```sql
-- Added to sessions table
ALTER TABLE sessions ADD COLUMN context_exhausted BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN exhaustion_detected_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN context_usage_estimate DECIMAL(3,2); -- 0.00 to 1.00
```

**Performance:**
- Pattern matching: <1ms per prompt
- No external API calls required
- Runs synchronously on prompt insert

---

### Story 21.2: Work Style Categorization

**Objective:** Classify each prompt into one of 10 work style categories.

**Classification Algorithm:**

```typescript
// lib/analysis/work-style-classifier.ts

export type WorkStyleCategory =
  | 'architecture_questions'
  | 'file_operations'
  | 'debugging'
  | 'agent_delegation'
  | 'testing'
  | 'deployment'
  | 'design_iteration'
  | 'context_recovery'
  | 'quick_commands'
  | 'business_discussion';

interface CategoryRule {
  patterns: RegExp[];
  priority: number; // Higher = checked first
  minConfidence: number;
}

const CATEGORY_RULES: Record<WorkStyleCategory, CategoryRule> = {
  quick_commands: {
    patterns: [
      /^(yes|no|ok|okay|y|n|1|2|3|continue|proceed|done|next)$/i,
      /^(go ahead|looks good|lgtm|perfect|great)$/i,
    ],
    priority: 100, // Check first - very specific
    minConfidence: 0.95,
  },
  context_recovery: {
    patterns: [
      /continued from.*previous/i,
      /picking up from/i,
      /where we left off/i,
      /context.*(limit|ran out|exhausted)/i,
      /let me summarize/i,
    ],
    priority: 90,
    minConfidence: 0.90,
  },
  debugging: {
    patterns: [
      /not working/i,
      /error|bug|issue|problem|broken/i,
      /fix|debug|troubleshoot/i,
      /why (is|does|doesn't|isn't)/i,
      /still (wrong|broken|failing)/i,
      /doesn't (work|compile|run)/i,
    ],
    priority: 80,
    minConfidence: 0.75,
  },
  testing: {
    patterns: [
      /test|spec|e2e|playwright|jest|vitest/i,
      /unit test|integration test/i,
      /test coverage|assertion/i,
      /mock|stub|spy/i,
    ],
    priority: 70,
    minConfidence: 0.80,
  },
  deployment: {
    patterns: [
      /deploy|build|production|staging/i,
      /docker|kubernetes|k8s|cloud run/i,
      /ci\/cd|github actions|pipeline/i,
      /release|publish|npm publish/i,
    ],
    priority: 70,
    minConfidence: 0.80,
  },
  agent_delegation: {
    patterns: [
      /you are (a|an|the)/i,
      /act as/i,
      /your role is/i,
      /as a.*agent/i,
      /bmad|workflow|persona/i,
    ],
    priority: 60,
    minConfidence: 0.75,
  },
  architecture_questions: {
    patterns: [
      /how should (i|we)/i,
      /what approach/i,
      /best (way|practice|pattern)/i,
      /design|architect|structure/i,
      /should (i|we) use/i,
      /trade-?offs?/i,
    ],
    priority: 50,
    minConfidence: 0.70,
  },
  file_operations: {
    patterns: [
      /\.(ts|tsx|js|jsx|py|go|rs|sql|md|json|yaml|yml)(\s|$)/i,
      /\/[a-zA-Z0-9_-]+\/.*\.(ts|tsx|js)/i,
      /create|modify|update|delete|edit.*file/i,
      /add.*to.*file/i,
    ],
    priority: 40,
    minConfidence: 0.65,
  },
  design_iteration: {
    patterns: [
      /make (it|this|that) (larger|smaller|bigger)/i,
      /change.*color/i,
      /move.*to/i,
      /add (padding|margin|spacing)/i,
      /looks (too|a bit|slightly)/i,
      /ui|ux|design|layout|style/i,
    ],
    priority: 40,
    minConfidence: 0.70,
  },
  business_discussion: {
    patterns: [
      /pricing|cost|budget|revenue/i,
      /user(s)?|customer(s)?|market/i,
      /strategy|roadmap|milestone/i,
      /feature request|requirement/i,
    ],
    priority: 30,
    minConfidence: 0.60,
  },
};

export function classifyWorkStyle(promptText: string): {
  category: WorkStyleCategory;
  confidence: number;
} {
  // Sort rules by priority (descending)
  const sortedCategories = Object.entries(CATEGORY_RULES)
    .sort(([, a], [, b]) => b.priority - a.priority);

  for (const [category, rule] of sortedCategories) {
    for (const pattern of rule.patterns) {
      if (pattern.test(promptText)) {
        return {
          category: category as WorkStyleCategory,
          confidence: rule.minConfidence,
        };
      }
    }
  }

  // Default fallback
  return { category: 'file_operations', confidence: 0.3 };
}
```

**Performance:**
- Average: <3ms per prompt
- Worst case: <5ms (all patterns checked)
- No external dependencies

---

### Story 21.3: Sentiment Analysis

**Objective:** Detect polite, frustrated, and neutral communication styles.

**Implementation:**

```typescript
// lib/analysis/sentiment-classifier.ts

export type Sentiment = 'polite' | 'frustrated' | 'neutral' | 'directive';

interface SentimentResult {
  sentiment: Sentiment;
  confidence: number;
  politeScore: number;      // 0-1
  frustratedScore: number;  // 0-1
  directiveScore: number;   // 0-1
}

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
  { pattern: /^[A-Z][^.?!]*[^.?!]$/m, weight: 0.2 }, // Commands without punctuation
];

export function analyzeSentiment(promptText: string): SentimentResult {
  let politeScore = 0;
  let frustratedScore = 0;
  let directiveScore = 0;

  // Calculate polite score
  for (const { pattern, weight } of POLITE_PATTERNS) {
    if (pattern.test(promptText)) {
      politeScore += weight;
    }
  }

  // Calculate frustrated score
  for (const { pattern, weight } of FRUSTRATED_PATTERNS) {
    if (pattern.test(promptText)) {
      frustratedScore += weight;
    }
  }

  // Calculate directive score
  for (const { pattern, weight } of DIRECTIVE_PATTERNS) {
    if (pattern.test(promptText)) {
      directiveScore += weight;
    }
  }

  // Normalize scores
  politeScore = Math.min(1, politeScore);
  frustratedScore = Math.min(1, frustratedScore);
  directiveScore = Math.min(1, directiveScore);

  // Determine sentiment
  let sentiment: Sentiment;
  let confidence: number;

  if (frustratedScore > 0.4) {
    sentiment = 'frustrated';
    confidence = Math.min(0.95, frustratedScore + 0.3);
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

  return {
    sentiment,
    confidence,
    politeScore,
    frustratedScore,
    directiveScore,
  };
}
```

**Database Schema:**

```sql
ALTER TABLE prompts ADD COLUMN sentiment VARCHAR(20);  -- 'polite', 'frustrated', 'neutral', 'directive'
ALTER TABLE prompts ADD COLUMN sentiment_confidence DECIMAL(3,2);
ALTER TABLE prompts ADD COLUMN sentiment_scores JSONB;  -- { polite: 0.4, frustrated: 0.1, directive: 0.2 }
```

---

### Story 21.4: Prompt Complexity

**Objective:** Measure prompt structure and complexity metrics.

**Implementation:**

```typescript
// lib/analysis/complexity-analyzer.ts

export interface ComplexityMetrics {
  charCount: number;
  wordCount: number;
  sentenceCount: number;
  hasCode: boolean;
  hasFileRefs: boolean;
  codeBlockCount: number;
  fileRefCount: number;
  complexityLevel: 'simple' | 'moderate' | 'complex';
  complexityScore: number; // 0-100
}

const CODE_PATTERNS = [
  /```[\s\S]*?```/g,           // Fenced code blocks
  /`[^`]+`/g,                  // Inline code
  /\b(function|const|let|var|class|interface|type|import|export)\b/,
  /=>|===|!==|\|\||&&/,        // JS operators
];

const FILE_REF_PATTERNS = [
  /\.(ts|tsx|js|jsx|py|go|rs|sql|md|json|yaml|yml|css|scss|html)\b/gi,
  /\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_\-/.]+/g,  // Path patterns
  /\/Users\/[^\s]+/g,                       // Absolute paths
  /\.\/[^\s]+/g,                            // Relative paths
];

export function analyzeComplexity(promptText: string): ComplexityMetrics {
  const charCount = promptText.length;
  const wordCount = promptText.split(/\s+/).filter(Boolean).length;

  // Sentence detection (handles common edge cases)
  const sentences = promptText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);

  // Code detection
  let hasCode = false;
  let codeBlockCount = 0;
  const codeBlockMatches = promptText.match(/```[\s\S]*?```/g);
  if (codeBlockMatches) {
    codeBlockCount = codeBlockMatches.length;
    hasCode = true;
  }
  if (!hasCode) {
    hasCode = CODE_PATTERNS.some(p => p.test(promptText));
  }

  // File reference detection
  let fileRefCount = 0;
  for (const pattern of FILE_REF_PATTERNS) {
    const matches = promptText.match(pattern);
    if (matches) {
      fileRefCount += matches.length;
    }
  }
  const hasFileRefs = fileRefCount > 0;

  // Complexity scoring
  let complexityScore = 0;

  // Length factors
  if (charCount > 500) complexityScore += 20;
  else if (charCount > 200) complexityScore += 10;

  // Structure factors
  if (sentenceCount > 3) complexityScore += 20;
  else if (sentenceCount > 1) complexityScore += 10;

  // Technical factors
  if (hasCode) complexityScore += 25;
  if (hasFileRefs) complexityScore += 15;
  complexityScore += Math.min(10, codeBlockCount * 5);

  // Word complexity proxy (average word length)
  const avgWordLength = charCount / Math.max(1, wordCount);
  if (avgWordLength > 6) complexityScore += 10;

  // Normalize to 0-100
  complexityScore = Math.min(100, complexityScore);

  // Determine level
  let complexityLevel: 'simple' | 'moderate' | 'complex';
  if (complexityScore >= 60) {
    complexityLevel = 'complex';
  } else if (complexityScore >= 30) {
    complexityLevel = 'moderate';
  } else {
    complexityLevel = 'simple';
  }

  return {
    charCount,
    wordCount,
    sentenceCount,
    hasCode,
    hasFileRefs,
    codeBlockCount,
    fileRefCount,
    complexityLevel,
    complexityScore,
  };
}
```

**Note:** `char_count` and `word_count` already exist in the prompts table. Add:

```sql
ALTER TABLE prompts ADD COLUMN sentence_count INTEGER;
ALTER TABLE prompts ADD COLUMN has_code BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN has_file_refs BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN code_block_count INTEGER DEFAULT 0;
ALTER TABLE prompts ADD COLUMN file_ref_count INTEGER DEFAULT 0;
ALTER TABLE prompts ADD COLUMN complexity_level VARCHAR(20);  -- 'simple', 'moderate', 'complex'
ALTER TABLE prompts ADD COLUMN complexity_score INTEGER;  -- 0-100
```

---

### Story 21.5: Interaction Timing

**Objective:** Analyze prompting rhythm and patterns.

**Implementation:**

```typescript
// lib/analysis/timing-analyzer.ts

export interface TimingMetrics {
  timeSincePrevious: number | null;  // seconds
  isRapidFire: boolean;              // <30 seconds
  isLongPause: boolean;              // >5 minutes
  isFollowUp: boolean;               // "also", "and", "now", "next"
  sequenceNumber: number;            // within session
}

const RAPID_FIRE_THRESHOLD_SECONDS = 30;
const LONG_PAUSE_THRESHOLD_SECONDS = 300; // 5 minutes

const FOLLOW_UP_PATTERNS = [
  /^(also|and|additionally|furthermore)/i,
  /^(now|next|then)/i,
  /^(one more thing|another thing)/i,
  /^(oh|wait)/i,
];

export function analyzeTimingWithContext(
  promptText: string,
  currentTimestamp: Date,
  previousTimestamp: Date | null,
  sequenceNumber: number
): TimingMetrics {
  let timeSincePrevious: number | null = null;
  let isRapidFire = false;
  let isLongPause = false;

  if (previousTimestamp) {
    timeSincePrevious = (currentTimestamp.getTime() - previousTimestamp.getTime()) / 1000;
    isRapidFire = timeSincePrevious < RAPID_FIRE_THRESHOLD_SECONDS;
    isLongPause = timeSincePrevious > LONG_PAUSE_THRESHOLD_SECONDS;
  }

  const isFollowUp = FOLLOW_UP_PATTERNS.some(p => p.test(promptText.trim()));

  return {
    timeSincePrevious,
    isRapidFire,
    isLongPause,
    isFollowUp,
    sequenceNumber,
  };
}
```

**Database Schema:**

```sql
ALTER TABLE prompts ADD COLUMN time_since_previous_seconds INTEGER;
ALTER TABLE prompts ADD COLUMN is_rapid_fire BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN is_long_pause BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN is_follow_up BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN sequence_number INTEGER;  -- Within session
```

---

### Story 21.6: Tool Usage Profiling

**Objective:** Track Claude Code tool usage patterns per session.

**Implementation:**

This requires response capture (Epic 15 dependency). Tool usage is extracted from assistant responses.

```typescript
// lib/analysis/tool-usage-tracker.ts

export type ToolName =
  | 'Bash'
  | 'Read'
  | 'Edit'
  | 'Write'
  | 'Glob'
  | 'Grep'
  | 'TodoWrite'
  | 'Task'
  | 'WebFetch'
  | 'WebSearch'
  | 'NotebookEdit';

export interface ToolUsageProfile {
  toolDistribution: Record<ToolName, number>;
  totalToolCalls: number;
  topTools: ToolName[];
  underutilizedTools: ToolName[];
  userProfile: 'terminal_power' | 'code_centric' | 'methodical' | 'balanced';
}

// This function analyzes response data (from Epic 15)
export function extractToolUsage(
  responseData: { toolCalls?: Array<{ name: string }> }
): Map<string, number> {
  const usage = new Map<string, number>();

  if (!responseData.toolCalls) return usage;

  for (const call of responseData.toolCalls) {
    const count = usage.get(call.name) || 0;
    usage.set(call.name, count + 1);
  }

  return usage;
}

export function classifyUserProfile(distribution: Record<string, number>): string {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return 'balanced';

  const bashRatio = (distribution['Bash'] || 0) / total;
  const fileOpsRatio = ((distribution['Read'] || 0) + (distribution['Edit'] || 0) + (distribution['Write'] || 0)) / total;
  const todoRatio = (distribution['TodoWrite'] || 0) / total;

  if (bashRatio > 0.3) return 'terminal_power';
  if (fileOpsRatio > 0.5) return 'code_centric';
  if (todoRatio > 0.1) return 'methodical';
  return 'balanced';
}
```

**Database Schema:**

```sql
CREATE TABLE session_tool_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tool_name VARCHAR(50) NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_session_tool UNIQUE (session_id, tool_name)
);

CREATE INDEX idx_session_tool_usage_session ON session_tool_usage(session_id);
CREATE INDEX idx_session_tool_usage_tool ON session_tool_usage(tool_name);
```

---

### Story 21.7: Session Health Score

**Objective:** Calculate real-time session health indicators (0-100).

**Implementation:**

```typescript
// lib/analysis/session-health.ts

export interface SessionHealthMetrics {
  healthScore: number;           // 0-100
  healthLevel: 'healthy' | 'warning' | 'critical';
  factors: {
    durationScore: number;       // 0-25
    contextScore: number;        // 0-25
    frustrationScore: number;    // 0-25
    retryScore: number;          // 0-25
  };
  warnings: string[];
  suggestions: string[];
}

interface SessionData {
  durationMinutes: number;
  contextUsageEstimate: number;  // 0-1
  frustrationRate: number;       // frustrated prompts / total
  retryRate: number;             // retry prompts / total
  promptCount: number;
}

export function calculateSessionHealth(data: SessionData): SessionHealthMetrics {
  const factors = {
    durationScore: calculateDurationScore(data.durationMinutes),
    contextScore: calculateContextScore(data.contextUsageEstimate),
    frustrationScore: calculateFrustrationScore(data.frustrationRate),
    retryScore: calculateRetryScore(data.retryRate),
  };

  const healthScore = Object.values(factors).reduce((a, b) => a + b, 0);

  const healthLevel: 'healthy' | 'warning' | 'critical' =
    healthScore >= 75 ? 'healthy' :
    healthScore >= 50 ? 'warning' : 'critical';

  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (factors.durationScore < 15) {
    warnings.push('Session duration is getting long');
    suggestions.push('Consider starting a fresh session for complex new tasks');
  }
  if (factors.contextScore < 15) {
    warnings.push('Context window usage is high');
    suggestions.push('Summarize key context and start fresh to maintain quality');
  }
  if (factors.frustrationScore < 15) {
    warnings.push('Frustration signals detected');
    suggestions.push('Take a short break or try a different approach');
  }
  if (factors.retryScore < 15) {
    warnings.push('High retry rate detected');
    suggestions.push('Clarify requirements before retrying');
  }

  return { healthScore, healthLevel, factors, warnings, suggestions };
}

function calculateDurationScore(minutes: number): number {
  if (minutes <= 60) return 25;
  if (minutes <= 90) return 20;
  if (minutes <= 120) return 15;
  if (minutes <= 180) return 10;
  return 5;
}

function calculateContextScore(usage: number): number {
  if (usage <= 0.5) return 25;
  if (usage <= 0.7) return 20;
  if (usage <= 0.8) return 15;
  if (usage <= 0.9) return 10;
  return 5;
}

function calculateFrustrationScore(rate: number): number {
  if (rate <= 0.02) return 25;
  if (rate <= 0.05) return 20;
  if (rate <= 0.10) return 15;
  if (rate <= 0.15) return 10;
  return 5;
}

function calculateRetryScore(rate: number): number {
  if (rate <= 0.05) return 25;
  if (rate <= 0.10) return 20;
  if (rate <= 0.15) return 15;
  if (rate <= 0.20) return 10;
  return 5;
}
```

**Database Schema Additions:**

```sql
ALTER TABLE sessions ADD COLUMN health_score INTEGER;  -- 0-100
ALTER TABLE sessions ADD COLUMN health_level VARCHAR(20);  -- 'healthy', 'warning', 'critical'
ALTER TABLE sessions ADD COLUMN frustration_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN last_health_update_at TIMESTAMPTZ;
```

---

### Story 21.8: Technical Depth Profile

**Objective:** Categorize users into technical personas based on prompt patterns.

**Implementation:**

```typescript
// lib/analysis/technical-depth.ts

export type TechnicalPersona = 'architect' | 'firefighter' | 'craftsman' | 'explorer';

export interface TechnicalDepthProfile {
  persona: TechnicalPersona;
  confidence: number;
  breakdown: {
    architectureRatio: number;
    debuggingRatio: number;
    testingRatio: number;
    implementationRatio: number;
  };
  personaDescription: string;
}

export function calculateTechnicalProfile(
  workStyleDistribution: Record<string, number>
): TechnicalDepthProfile {
  const total = Object.values(workStyleDistribution).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return {
      persona: 'explorer',
      confidence: 0.3,
      breakdown: { architectureRatio: 0, debuggingRatio: 0, testingRatio: 0, implementationRatio: 0 },
      personaDescription: 'Not enough data to determine profile',
    };
  }

  const architectureRatio = (workStyleDistribution['architecture_questions'] || 0) / total;
  const debuggingRatio = (workStyleDistribution['debugging'] || 0) / total;
  const testingRatio = (workStyleDistribution['testing'] || 0) / total;
  const implementationRatio = (
    (workStyleDistribution['file_operations'] || 0) +
    (workStyleDistribution['deployment'] || 0)
  ) / total;

  const breakdown = { architectureRatio, debuggingRatio, testingRatio, implementationRatio };

  // Determine persona
  let persona: TechnicalPersona;
  let confidence: number;
  let personaDescription: string;

  if (architectureRatio > 0.2 && debuggingRatio < 0.15) {
    persona = 'architect';
    confidence = 0.8;
    personaDescription = 'High-level thinker focused on design decisions and system structure';
  } else if (debuggingRatio > 0.2 && testingRatio < 0.10) {
    persona = 'firefighter';
    confidence = 0.75;
    personaDescription = 'Reactive problem solver, often in fix-it mode';
  } else if (testingRatio > 0.12 && Math.abs(architectureRatio - implementationRatio) < 0.1) {
    persona = 'craftsman';
    confidence = 0.85;
    personaDescription = 'Balanced approach with strong quality focus';
  } else {
    persona = 'explorer';
    confidence = 0.6;
    personaDescription = 'Experimental approach with diverse prompting patterns';
  }

  return { persona, confidence, breakdown, personaDescription };
}
```

---

### Story 21.9: Learning Progression

**Objective:** Track week-over-week improvement metrics.

**Implementation:**

```typescript
// lib/analysis/learning-progression.ts

export interface WeeklyMetrics {
  weekStart: string;  // ISO date
  avgPromptScore: number;
  frustrationRate: number;
  promptsPerGoal: number;  // Lower is better
  contextExhaustionRate: number;
  totalPrompts: number;
  totalSessions: number;
}

export interface LearningProgression {
  currentWeek: WeeklyMetrics;
  previousWeek: WeeklyMetrics | null;
  improvements: {
    promptScore: number;        // Percentage change
    frustration: number;        // Percentage change (negative = improvement)
    efficiency: number;         // Percentage change
    contextManagement: number;  // Percentage change
  } | null;
  achievements: string[];
  suggestions: string[];
}

export function calculateProgression(
  current: WeeklyMetrics,
  previous: WeeklyMetrics | null
): LearningProgression {
  if (!previous) {
    return {
      currentWeek: current,
      previousWeek: null,
      improvements: null,
      achievements: ['First week tracked! Keep prompting to see your progress.'],
      suggestions: [],
    };
  }

  const improvements = {
    promptScore: previous.avgPromptScore > 0
      ? ((current.avgPromptScore - previous.avgPromptScore) / previous.avgPromptScore) * 100
      : 0,
    frustration: previous.frustrationRate > 0
      ? ((current.frustrationRate - previous.frustrationRate) / previous.frustrationRate) * 100
      : 0,
    efficiency: previous.promptsPerGoal > 0
      ? ((previous.promptsPerGoal - current.promptsPerGoal) / previous.promptsPerGoal) * 100
      : 0,
    contextManagement: previous.contextExhaustionRate > 0
      ? ((previous.contextExhaustionRate - current.contextExhaustionRate) / previous.contextExhaustionRate) * 100
      : 0,
  };

  const achievements: string[] = [];
  const suggestions: string[] = [];

  if (improvements.promptScore > 5) {
    achievements.push(`Prompt quality improved ${improvements.promptScore.toFixed(0)}%!`);
  }
  if (improvements.frustration < -10) {
    achievements.push('Frustration levels decreased - great communication!');
  }
  if (improvements.efficiency > 10) {
    achievements.push('Workflow efficiency improved - fewer prompts per goal!');
  }
  if (improvements.contextManagement > 20) {
    achievements.push('Context management mastery - fewer resets!');
  }

  if (improvements.promptScore < -5) {
    suggestions.push('Focus on prompt clarity this week');
  }
  if (improvements.frustration > 10) {
    suggestions.push('Try shorter sessions or clearer initial requirements');
  }

  return {
    currentWeek: current,
    previousWeek: previous,
    improvements,
    achievements,
    suggestions,
  };
}
```

**Database Table:**

```sql
CREATE TABLE user_weekly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  avg_prompt_score DECIMAL(4,2),
  frustration_rate DECIMAL(4,3),
  prompts_per_goal DECIMAL(5,2),
  context_exhaustion_rate DECIMAL(4,3),
  total_prompts INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_week UNIQUE (user_id, week_start)
);

CREATE INDEX idx_user_weekly_user ON user_weekly_metrics(user_id);
CREATE INDEX idx_user_weekly_week ON user_weekly_metrics(week_start);
```

---

### Story 21.10: Workflow Efficiency

**Objective:** Measure efficiency of goal achievement.

**Implementation:**

```typescript
// lib/analysis/workflow-efficiency.ts

export interface EfficiencyMetrics {
  promptsPerTask: number;
  contextResetsPerSession: number;
  debuggingLoopAverage: number;
  timeToResolutionMinutes: number;
  efficiencyScore: number;  // 0-100
  benchmark: 'below_average' | 'average' | 'above_average' | 'excellent';
}

// Team benchmarks (can be made dynamic)
const TEAM_BENCHMARKS = {
  promptsPerTask: 5.8,
  contextResetsPerSession: 0.5,
  debuggingLoopAverage: 3.0,
};

export function calculateEfficiency(
  userMetrics: {
    totalPrompts: number;
    completedTasks: number;  // Derived from session goals
    contextResets: number;
    totalSessions: number;
    debuggingPrompts: number;
    debuggingResolutions: number;
    totalTimeMinutes: number;
  }
): EfficiencyMetrics {
  const promptsPerTask = userMetrics.completedTasks > 0
    ? userMetrics.totalPrompts / userMetrics.completedTasks
    : 0;

  const contextResetsPerSession = userMetrics.totalSessions > 0
    ? userMetrics.contextResets / userMetrics.totalSessions
    : 0;

  const debuggingLoopAverage = userMetrics.debuggingResolutions > 0
    ? userMetrics.debuggingPrompts / userMetrics.debuggingResolutions
    : 0;

  const timeToResolutionMinutes = userMetrics.completedTasks > 0
    ? userMetrics.totalTimeMinutes / userMetrics.completedTasks
    : 0;

  // Calculate efficiency score
  let efficiencyScore = 50; // Start at baseline

  // Prompts per task (lower is better)
  if (promptsPerTask < TEAM_BENCHMARKS.promptsPerTask * 0.8) {
    efficiencyScore += 20;
  } else if (promptsPerTask < TEAM_BENCHMARKS.promptsPerTask) {
    efficiencyScore += 10;
  } else if (promptsPerTask > TEAM_BENCHMARKS.promptsPerTask * 1.5) {
    efficiencyScore -= 15;
  }

  // Context resets (lower is better)
  if (contextResetsPerSession < TEAM_BENCHMARKS.contextResetsPerSession * 0.5) {
    efficiencyScore += 15;
  } else if (contextResetsPerSession < TEAM_BENCHMARKS.contextResetsPerSession) {
    efficiencyScore += 8;
  } else if (contextResetsPerSession > TEAM_BENCHMARKS.contextResetsPerSession * 2) {
    efficiencyScore -= 10;
  }

  // Debugging loops (lower is better)
  if (debuggingLoopAverage < TEAM_BENCHMARKS.debuggingLoopAverage * 0.7) {
    efficiencyScore += 15;
  } else if (debuggingLoopAverage < TEAM_BENCHMARKS.debuggingLoopAverage) {
    efficiencyScore += 8;
  }

  efficiencyScore = Math.max(0, Math.min(100, efficiencyScore));

  const benchmark: 'below_average' | 'average' | 'above_average' | 'excellent' =
    efficiencyScore >= 80 ? 'excellent' :
    efficiencyScore >= 60 ? 'above_average' :
    efficiencyScore >= 40 ? 'average' : 'below_average';

  return {
    promptsPerTask,
    contextResetsPerSession,
    debuggingLoopAverage,
    timeToResolutionMinutes,
    efficiencyScore,
    benchmark,
  };
}
```

---

### Story 21.11: Interactive Insights Dashboard

**Objective:** Provide interactive visualization of all analytics dimensions.

**UI Components Required:**

```typescript
// components/analytics/insights-dashboard.tsx

interface InsightsDashboardProps {
  userId: string;
  timeRange: TimeRange;
}

// Component breakdown:
// 1. SummaryCards - Key metrics at a glance
// 2. WorkStyleRadarChart - Radar chart of 10 work styles
// 3. SentimentTimeline - Line chart of sentiment over time
// 4. SessionHealthTrend - Health score trend
// 5. ToolUsageBreakdown - Bar chart of tool distribution
// 6. LearningProgressionChart - Week-over-week improvements
// 7. ComparisonPanel - This week vs last week
// 8. PersonalizedTips - AI-generated suggestions
```

**API Endpoint:**

```typescript
// GET /api/analytics/insights?userId=xxx&timeRange=30d

interface InsightsResponse {
  summary: {
    totalPrompts: number;
    totalSessions: number;
    avgSessionDuration: number;
    overallScore: number;
  };
  workStyle: {
    distribution: Record<WorkStyleCategory, number>;
    primaryStyle: WorkStyleCategory;
    persona: TechnicalPersona;
  };
  sentiment: {
    politeRate: number;
    frustratedRate: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  sessionHealth: {
    avgHealthScore: number;
    healthySessions: number;
    warningSessions: number;
    criticalSessions: number;
  };
  toolUsage: {
    distribution: Record<string, number>;
    topTools: string[];
    underutilized: string[];
    userProfile: string;
  };
  learning: LearningProgression;
  efficiency: EfficiencyMetrics;
  tips: string[];
}
```

---

### Story 21.12: Team Intelligence

**Objective:** Aggregate individual metrics for team-level insights.

**Implementation:**

```typescript
// lib/analysis/team-intelligence.ts

export interface TeamIntelligence {
  teamSize: number;
  teamMetrics: {
    avgPromptScore: number;
    avgSessionHealth: number;
    avgEfficiency: number;
  };
  styleDistribution: Record<WorkStyleCategory, number>;
  topPerformers: {
    userId: string;
    userName: string;
    metric: string;
    value: number;
  }[];
  commonStruggles: {
    issue: string;
    affectedPercent: number;
    suggestion: string;
  }[];
  bestPractices: {
    pattern: string;
    practitionerCount: number;
    impact: string;
  }[];
  teamTrend: {
    scoreChange: number;
    direction: 'up' | 'down' | 'stable';
  };
}
```

**Database Table:**

```sql
CREATE TABLE team_daily_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_prompts INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  avg_prompt_score DECIMAL(4,2),
  avg_session_health DECIMAL(4,2),
  work_style_distribution JSONB,  -- { category: count }
  sentiment_distribution JSONB,   -- { sentiment: count }
  active_users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_team_date UNIQUE (team_id, date)
);

CREATE INDEX idx_team_daily_team ON team_daily_analytics(team_id);
CREATE INDEX idx_team_daily_date ON team_daily_analytics(date);
```

---

## Classification Algorithms

### Algorithm Selection Matrix

| Dimension | Algorithm | Latency Target | Accuracy Target | Rationale |
|-----------|-----------|----------------|-----------------|-----------|
| Work Style | Regex + Priority | <3ms | 85% | Deterministic, fast, interpretable |
| Sentiment | Weighted Regex | <2ms | 80% | Pattern-based with confidence scores |
| Complexity | Heuristic Scoring | <2ms | 95% | Metrics are measurable, not subjective |
| Context Exhaustion | Keyword + Duration | <1ms | 90% | Clear indicators exist |
| Follow-up Detection | Regex | <1ms | 90% | Specific patterns are reliable |
| Technical Persona | Distribution Analysis | <1ms | 75% | Based on aggregated categories |

**Why Not ML for Classification?**

1. **Latency:** ML models add 50-200ms latency; regex is <5ms
2. **Interpretability:** Regex rules can be explained and audited
3. **Accuracy:** 80-85% is sufficient for behavioral insights
4. **Cost:** No inference costs or model hosting
5. **Maintainability:** Rules are easy to update without retraining

**When to Consider ML:**

- If accuracy requirements exceed 90%
- If patterns become too complex for regex
- If we need cross-language support

---

### Regex-Based Classifiers

All classifiers use **prioritized pattern matching** with early exit for performance:

```typescript
// lib/analysis/classifier-base.ts

export interface ClassifierResult<T> {
  value: T;
  confidence: number;
  matchedPattern?: string;
}

export function createPatternClassifier<T>(
  rules: Array<{
    pattern: RegExp;
    value: T;
    confidence: number;
    priority: number;
  }>,
  defaultValue: T,
  defaultConfidence: number
): (text: string) => ClassifierResult<T> {
  // Sort by priority descending
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  return (text: string): ClassifierResult<T> => {
    for (const rule of sortedRules) {
      if (rule.pattern.test(text)) {
        return {
          value: rule.value,
          confidence: rule.confidence,
          matchedPattern: rule.pattern.source,
        };
      }
    }
    return { value: defaultValue, confidence: defaultConfidence };
  };
}
```

---

### Heuristic Classifiers

For metrics-based classification (complexity, session health):

```typescript
// lib/analysis/heuristic-base.ts

export interface HeuristicFactor {
  name: string;
  weight: number;  // 0-1, sum should equal 1
  calculate: (input: unknown) => number;  // Returns 0-100
}

export function createHeuristicClassifier(
  factors: HeuristicFactor[]
): (input: Record<string, unknown>) => number {
  // Validate weights sum to 1
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  if (Math.abs(totalWeight - 1) > 0.01) {
    throw new Error(`Weights must sum to 1, got ${totalWeight}`);
  }

  return (input: Record<string, unknown>): number => {
    let score = 0;
    for (const factor of factors) {
      const factorScore = factor.calculate(input);
      score += factorScore * factor.weight;
    }
    return Math.round(score);
  };
}
```

---

### Performance Requirements

| Operation | Target Latency | Measurement Point |
|-----------|----------------|-------------------|
| Per-prompt classification (sync) | <5ms total | All regex classifiers combined |
| Session health update | <10ms | After session aggregation |
| Daily analytics aggregation | <30s | Cron job (off-peak) |
| Dashboard data fetch | <200ms | API response time |
| Team analytics aggregation | <60s | Cron job (off-peak) |

**Caching Strategy:**

- Dashboard data: 5-minute stale time (React Query)
- Team aggregates: 15-minute cache
- Learning progression: 1-hour cache

---

## Aggregation Pipelines

### Real-time Per-Prompt Analysis

On every prompt insert, these operations run **synchronously** (total <10ms):

```sql
-- Trigger function on prompts insert
CREATE OR REPLACE FUNCTION analyze_prompt_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Calculate complexity metrics (already have char_count, word_count)
  NEW.sentence_count := (
    SELECT COUNT(*)
    FROM regexp_split_to_table(NEW.text, '[.!?]+') s
    WHERE LENGTH(TRIM(s)) > 0
  );
  NEW.has_code := NEW.text ~ '```|`[^`]+`|\b(function|const|let|var|class)\b';
  NEW.has_file_refs := NEW.text ~ '\.(ts|tsx|js|jsx|py|sql|md)\b|/[a-zA-Z0-9_-]+/';

  -- 2. Work style classification (done in application layer, passed as param)
  -- 3. Sentiment classification (done in application layer, passed as param)

  -- 4. Calculate timing metrics
  IF NEW.session_id IS NOT NULL THEN
    SELECT
      NEW.created_at - MAX(p.created_at),
      COALESCE(MAX(p.sequence_number), 0) + 1
    INTO
      NEW.time_since_previous_seconds,
      NEW.sequence_number
    FROM prompts p
    WHERE p.session_id = NEW.session_id
      AND p.created_at < NEW.created_at;

    NEW.is_rapid_fire := NEW.time_since_previous_seconds IS NOT NULL
      AND NEW.time_since_previous_seconds < 30;
    NEW.is_long_pause := NEW.time_since_previous_seconds IS NOT NULL
      AND NEW.time_since_previous_seconds > 300;
  END IF;

  -- 5. Follow-up detection
  NEW.is_follow_up := NEW.text ~* '^(also|and|additionally|now|next|then)';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analyze_prompt_before_insert
  BEFORE INSERT ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION analyze_prompt_sync();
```

**Application Layer Processing:**

```typescript
// In capture API route handler
async function processPromptCapture(promptData: CaptureRequest) {
  const startTime = Date.now();

  // Sync classifiers (run in parallel)
  const [workStyle, sentiment, complexity] = await Promise.all([
    Promise.resolve(classifyWorkStyle(promptData.text)),
    Promise.resolve(analyzeSentiment(promptData.text)),
    Promise.resolve(analyzeComplexity(promptData.text)),
  ]);

  const classificationTime = Date.now() - startTime;
  console.log(`[Capture] Classification completed in ${classificationTime}ms`);

  // Insert prompt with enhanced fields
  const { data, error } = await supabase
    .from('prompts')
    .insert({
      ...promptData,
      work_style_category: workStyle.category,
      work_style_confidence: workStyle.confidence,
      sentiment: sentiment.sentiment,
      sentiment_confidence: sentiment.confidence,
      sentiment_scores: sentiment,
      complexity_level: complexity.complexityLevel,
      complexity_score: complexity.complexityScore,
      // Other fields filled by trigger...
    })
    .select()
    .single();

  // Async: Update session metrics
  if (promptData.session_id) {
    updateSessionMetrics(promptData.session_id).catch(console.error);
  }

  return data;
}
```

---

### Daily Aggregation Pipeline

Runs as a scheduled Supabase Edge Function (daily at 00:05 UTC):

```sql
-- Function to aggregate daily user analytics
CREATE OR REPLACE FUNCTION aggregate_user_daily_analytics(target_date DATE)
RETURNS INTEGER AS $$
DECLARE
  rows_affected INTEGER := 0;
BEGIN
  -- Delete existing data for target date
  DELETE FROM user_daily_analytics WHERE date = target_date;

  -- Insert aggregated data
  INSERT INTO user_daily_analytics (
    user_id,
    date,
    total_prompts,
    total_sessions,
    avg_prompt_score,
    avg_session_health,
    work_style_distribution,
    sentiment_distribution,
    complexity_distribution,
    frustration_count,
    rapid_fire_count,
    follow_up_count
  )
  SELECT
    p.user_id,
    target_date,
    COUNT(*)::INTEGER as total_prompts,
    COUNT(DISTINCT p.session_id)::INTEGER as total_sessions,
    AVG(pa.overall_score)::DECIMAL(4,2) as avg_prompt_score,
    AVG(s.health_score)::DECIMAL(4,2) as avg_session_health,
    jsonb_object_agg(
      COALESCE(p.work_style_category, 'unknown'),
      COUNT(*) FILTER (WHERE p.work_style_category IS NOT NULL)
    ) as work_style_distribution,
    jsonb_build_object(
      'polite', COUNT(*) FILTER (WHERE p.sentiment = 'polite'),
      'frustrated', COUNT(*) FILTER (WHERE p.sentiment = 'frustrated'),
      'neutral', COUNT(*) FILTER (WHERE p.sentiment = 'neutral'),
      'directive', COUNT(*) FILTER (WHERE p.sentiment = 'directive')
    ) as sentiment_distribution,
    jsonb_build_object(
      'simple', COUNT(*) FILTER (WHERE p.complexity_level = 'simple'),
      'moderate', COUNT(*) FILTER (WHERE p.complexity_level = 'moderate'),
      'complex', COUNT(*) FILTER (WHERE p.complexity_level = 'complex')
    ) as complexity_distribution,
    COUNT(*) FILTER (WHERE p.sentiment = 'frustrated')::INTEGER as frustration_count,
    COUNT(*) FILTER (WHERE p.is_rapid_fire = true)::INTEGER as rapid_fire_count,
    COUNT(*) FILTER (WHERE p.is_follow_up = true)::INTEGER as follow_up_count
  FROM prompts p
  LEFT JOIN prompt_analyses pa ON pa.prompt_id = p.id
  LEFT JOIN sessions s ON s.id = p.session_id
  WHERE DATE(p.created_at) = target_date
  GROUP BY p.user_id;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### Weekly/Monthly Trend Calculations

```sql
-- Weekly metrics aggregation (runs weekly on Sunday)
CREATE OR REPLACE FUNCTION aggregate_user_weekly_metrics(week_start_date DATE)
RETURNS INTEGER AS $$
DECLARE
  rows_affected INTEGER := 0;
  week_end_date DATE := week_start_date + INTERVAL '6 days';
BEGIN
  DELETE FROM user_weekly_metrics WHERE week_start = week_start_date;

  INSERT INTO user_weekly_metrics (
    user_id,
    week_start,
    avg_prompt_score,
    frustration_rate,
    prompts_per_goal,
    context_exhaustion_rate,
    total_prompts,
    total_sessions
  )
  SELECT
    user_id,
    week_start_date,
    AVG(avg_prompt_score)::DECIMAL(4,2),
    CASE
      WHEN SUM(total_prompts) > 0 THEN
        SUM(frustration_count)::DECIMAL / SUM(total_prompts)
      ELSE 0
    END as frustration_rate,
    CASE
      WHEN SUM(total_sessions) > 0 THEN
        SUM(total_prompts)::DECIMAL / SUM(total_sessions)
      ELSE 0
    END as prompts_per_goal,  -- Approximation until goal tracking exists
    (
      SELECT COUNT(*)::DECIMAL / NULLIF(COUNT(DISTINCT s.id), 0)
      FROM sessions s
      WHERE s.user_id = uda.user_id
        AND s.started_at >= week_start_date
        AND s.started_at < week_end_date + INTERVAL '1 day'
        AND s.context_exhausted = true
    ) as context_exhaustion_rate,
    SUM(total_prompts)::INTEGER,
    SUM(total_sessions)::INTEGER
  FROM user_daily_analytics uda
  WHERE date >= week_start_date AND date <= week_end_date
  GROUP BY user_id;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### Team-Level Rollups

```sql
-- Team daily aggregation
CREATE OR REPLACE FUNCTION aggregate_team_daily_analytics(target_date DATE)
RETURNS INTEGER AS $$
DECLARE
  rows_affected INTEGER := 0;
BEGIN
  DELETE FROM team_daily_analytics WHERE date = target_date;

  INSERT INTO team_daily_analytics (
    team_id,
    date,
    total_prompts,
    total_sessions,
    avg_prompt_score,
    avg_session_health,
    work_style_distribution,
    sentiment_distribution,
    active_users
  )
  SELECT
    tm.team_id,
    target_date,
    SUM(uda.total_prompts)::INTEGER,
    SUM(uda.total_sessions)::INTEGER,
    AVG(uda.avg_prompt_score)::DECIMAL(4,2),
    AVG(uda.avg_session_health)::DECIMAL(4,2),
    -- Aggregate work style JSON (sum counts per category)
    (
      SELECT jsonb_object_agg(key, SUM(value::INTEGER))
      FROM user_daily_analytics u,
           jsonb_each_text(u.work_style_distribution) kv(key, value)
      WHERE u.user_id = tm.user_id AND u.date = target_date
      GROUP BY key
    ),
    (
      SELECT jsonb_object_agg(key, SUM(value::INTEGER))
      FROM user_daily_analytics u,
           jsonb_each_text(u.sentiment_distribution) kv(key, value)
      WHERE u.user_id = tm.user_id AND u.date = target_date
      GROUP BY key
    ),
    COUNT(DISTINCT uda.user_id)::INTEGER
  FROM team_members tm
  JOIN user_daily_analytics uda ON uda.user_id = tm.user_id::TEXT
  WHERE uda.date = target_date
  GROUP BY tm.team_id;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Database Schema

### Schema Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXISTING TABLES                              │
│                     (Enhanced)                                   │
├─────────────────────────────────────────────────────────────────┤
│ prompts                    │ sessions (Epic 16)                  │
│   + work_style_category   │   + health_score                    │
│   + sentiment             │   + health_level                    │
│   + complexity metrics    │   + frustration_count               │
│   + timing metrics        │   + context_exhausted               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     NEW TABLES                                   │
├─────────────────────────────────────────────────────────────────┤
│ session_tool_usage        │ user_daily_analytics                │
│ user_weekly_metrics       │ team_daily_analytics                │
└─────────────────────────────────────────────────────────────────┘
```

### Complete SQL Migration

```sql
-- ============================================
-- EPIC 21: ENHANCED ANALYSIS FRAMEWORK
-- Migration: 20251223000000_epic21_enhanced_analysis.sql
-- ============================================

-- ============================================
-- PART 1: PROMPTS TABLE ENHANCEMENTS
-- ============================================

-- Work Style Classification
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS work_style_category VARCHAR(50);
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS work_style_confidence DECIMAL(3,2);

-- Sentiment Analysis
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20);
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS sentiment_confidence DECIMAL(3,2);
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS sentiment_scores JSONB;

-- Complexity Metrics (char_count, word_count already exist)
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS sentence_count INTEGER;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS has_code BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS has_file_refs BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS code_block_count INTEGER DEFAULT 0;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS file_ref_count INTEGER DEFAULT 0;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS complexity_level VARCHAR(20);
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS complexity_score INTEGER;

-- Timing Metrics
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS time_since_previous_seconds INTEGER;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS is_rapid_fire BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS is_long_pause BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS is_follow_up BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS sequence_number INTEGER;

-- Session Link (if not already added by Epic 16)
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id);

-- Add constraints
ALTER TABLE prompts ADD CONSTRAINT valid_work_style CHECK (
  work_style_category IS NULL OR work_style_category IN (
    'architecture_questions', 'file_operations', 'debugging',
    'agent_delegation', 'testing', 'deployment', 'design_iteration',
    'context_recovery', 'quick_commands', 'business_discussion'
  )
);

ALTER TABLE prompts ADD CONSTRAINT valid_sentiment CHECK (
  sentiment IS NULL OR sentiment IN ('polite', 'frustrated', 'neutral', 'directive')
);

ALTER TABLE prompts ADD CONSTRAINT valid_complexity_level CHECK (
  complexity_level IS NULL OR complexity_level IN ('simple', 'moderate', 'complex')
);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_prompts_work_style ON prompts(work_style_category);
CREATE INDEX IF NOT EXISTS idx_prompts_sentiment ON prompts(sentiment);
CREATE INDEX IF NOT EXISTS idx_prompts_complexity ON prompts(complexity_level);
CREATE INDEX IF NOT EXISTS idx_prompts_session ON prompts(session_id);

-- ============================================
-- PART 2: SESSIONS TABLE ENHANCEMENTS
-- Depends on Epic 16 creating the sessions table
-- ============================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS health_score INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS health_level VARCHAR(20);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS frustration_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS context_exhausted BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS exhaustion_detected_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS context_usage_estimate DECIMAL(3,2);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_health_update_at TIMESTAMPTZ;

ALTER TABLE sessions ADD CONSTRAINT valid_health_level CHECK (
  health_level IS NULL OR health_level IN ('healthy', 'warning', 'critical')
);

ALTER TABLE sessions ADD CONSTRAINT valid_health_score CHECK (
  health_score IS NULL OR (health_score >= 0 AND health_score <= 100)
);

-- ============================================
-- PART 3: SESSION TOOL USAGE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS session_tool_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tool_name VARCHAR(50) NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_session_tool UNIQUE (session_id, tool_name)
);

CREATE INDEX IF NOT EXISTS idx_session_tool_usage_session ON session_tool_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_session_tool_usage_tool ON session_tool_usage(tool_name);

COMMENT ON TABLE session_tool_usage IS 'Tracks Claude Code tool usage per session';

-- ============================================
-- PART 4: USER DAILY ANALYTICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_daily_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,  -- Matches prompts.user_id type
  date DATE NOT NULL,
  total_prompts INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  avg_prompt_score DECIMAL(4,2),
  avg_session_health DECIMAL(4,2),
  work_style_distribution JSONB,
  sentiment_distribution JSONB,
  complexity_distribution JSONB,
  frustration_count INTEGER DEFAULT 0,
  rapid_fire_count INTEGER DEFAULT 0,
  follow_up_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_daily_user ON user_daily_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_daily_date ON user_daily_analytics(date);
CREATE INDEX IF NOT EXISTS idx_user_daily_user_date ON user_daily_analytics(user_id, date DESC);

COMMENT ON TABLE user_daily_analytics IS 'Daily aggregated analytics per user';

-- ============================================
-- PART 5: USER WEEKLY METRICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_weekly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  week_start DATE NOT NULL,
  avg_prompt_score DECIMAL(4,2),
  frustration_rate DECIMAL(4,3),
  prompts_per_goal DECIMAL(5,2),
  context_exhaustion_rate DECIMAL(4,3),
  total_prompts INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_week UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_user_weekly_user ON user_weekly_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_weekly_week ON user_weekly_metrics(week_start);

COMMENT ON TABLE user_weekly_metrics IS 'Weekly aggregated metrics for learning progression';

-- ============================================
-- PART 6: TEAM DAILY ANALYTICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS team_daily_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_prompts INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  avg_prompt_score DECIMAL(4,2),
  avg_session_health DECIMAL(4,2),
  work_style_distribution JSONB,
  sentiment_distribution JSONB,
  active_users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_team_date UNIQUE (team_id, date)
);

CREATE INDEX IF NOT EXISTS idx_team_daily_team ON team_daily_analytics(team_id);
CREATE INDEX IF NOT EXISTS idx_team_daily_date ON team_daily_analytics(date);
CREATE INDEX IF NOT EXISTS idx_team_daily_team_date ON team_daily_analytics(team_id, date DESC);

COMMENT ON TABLE team_daily_analytics IS 'Daily aggregated analytics per team';

-- ============================================
-- PART 7: ENABLE RLS ON NEW TABLES
-- ============================================

ALTER TABLE session_tool_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_weekly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_daily_analytics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 8: RLS POLICIES
-- ============================================

-- session_tool_usage: Team members can view their team's session data
CREATE POLICY "Team members can view session tool usage" ON session_tool_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN team_members tm ON tm.team_id = s.team_id
      WHERE s.id = session_tool_usage.session_id
        AND tm.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage session tool usage" ON session_tool_usage
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- user_daily_analytics: Users can view their own data, team admins can view team member data
CREATE POLICY "Users can view own daily analytics" ON user_daily_analytics
  FOR SELECT USING (
    user_id = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role = 'admin'
        AND EXISTS (
          SELECT 1 FROM team_members tm2
          WHERE tm2.team_id = tm.team_id
            AND tm2.user_id::TEXT = user_daily_analytics.user_id
        )
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage user daily analytics" ON user_daily_analytics
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- user_weekly_metrics: Same as daily
CREATE POLICY "Users can view own weekly metrics" ON user_weekly_metrics
  FOR SELECT USING (
    user_id = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role = 'admin'
        AND EXISTS (
          SELECT 1 FROM team_members tm2
          WHERE tm2.team_id = tm.team_id
            AND tm2.user_id::TEXT = user_weekly_metrics.user_id
        )
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage user weekly metrics" ON user_weekly_metrics
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- team_daily_analytics: Team members can view their team's analytics
CREATE POLICY "Team members can view team daily analytics" ON team_daily_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_daily_analytics.team_id
        AND tm.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Service role can manage team daily analytics" ON team_daily_analytics
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- PART 9: AGGREGATION FUNCTIONS
-- ============================================

-- Daily user analytics aggregation
CREATE OR REPLACE FUNCTION aggregate_user_daily_analytics(target_date DATE)
RETURNS INTEGER AS $$
DECLARE
  rows_affected INTEGER := 0;
BEGIN
  DELETE FROM user_daily_analytics WHERE date = target_date;

  INSERT INTO user_daily_analytics (
    user_id, date, total_prompts, total_sessions,
    avg_prompt_score, avg_session_health,
    work_style_distribution, sentiment_distribution, complexity_distribution,
    frustration_count, rapid_fire_count, follow_up_count
  )
  SELECT
    p.user_id,
    target_date,
    COUNT(*)::INTEGER,
    COUNT(DISTINCT p.session_id)::INTEGER,
    AVG(pa.overall_score)::DECIMAL(4,2),
    AVG(s.health_score)::DECIMAL(4,2),
    (
      SELECT jsonb_object_agg(work_style_category, cnt)
      FROM (
        SELECT work_style_category, COUNT(*)::INTEGER as cnt
        FROM prompts p2
        WHERE p2.user_id = p.user_id
          AND DATE(p2.created_at) = target_date
          AND p2.work_style_category IS NOT NULL
        GROUP BY work_style_category
      ) sub
    ),
    jsonb_build_object(
      'polite', COUNT(*) FILTER (WHERE p.sentiment = 'polite'),
      'frustrated', COUNT(*) FILTER (WHERE p.sentiment = 'frustrated'),
      'neutral', COUNT(*) FILTER (WHERE p.sentiment = 'neutral'),
      'directive', COUNT(*) FILTER (WHERE p.sentiment = 'directive')
    ),
    jsonb_build_object(
      'simple', COUNT(*) FILTER (WHERE p.complexity_level = 'simple'),
      'moderate', COUNT(*) FILTER (WHERE p.complexity_level = 'moderate'),
      'complex', COUNT(*) FILTER (WHERE p.complexity_level = 'complex')
    ),
    COUNT(*) FILTER (WHERE p.sentiment = 'frustrated')::INTEGER,
    COUNT(*) FILTER (WHERE p.is_rapid_fire = true)::INTEGER,
    COUNT(*) FILTER (WHERE p.is_follow_up = true)::INTEGER
  FROM prompts p
  LEFT JOIN prompt_analyses pa ON pa.prompt_id = p.id
  LEFT JOIN sessions s ON s.id = p.session_id
  WHERE DATE(p.created_at) = target_date
  GROUP BY p.user_id;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Team daily analytics aggregation
CREATE OR REPLACE FUNCTION aggregate_team_daily_analytics(target_date DATE)
RETURNS INTEGER AS $$
DECLARE
  rows_affected INTEGER := 0;
BEGIN
  DELETE FROM team_daily_analytics WHERE date = target_date;

  INSERT INTO team_daily_analytics (
    team_id, date, total_prompts, total_sessions,
    avg_prompt_score, avg_session_health,
    work_style_distribution, sentiment_distribution, active_users
  )
  SELECT
    p.team_id,
    target_date,
    COUNT(*)::INTEGER,
    COUNT(DISTINCT p.session_id)::INTEGER,
    AVG(pa.overall_score)::DECIMAL(4,2),
    AVG(s.health_score)::DECIMAL(4,2),
    (
      SELECT jsonb_object_agg(work_style_category, cnt)
      FROM (
        SELECT work_style_category, COUNT(*)::INTEGER as cnt
        FROM prompts p2
        WHERE p2.team_id = p.team_id
          AND DATE(p2.created_at) = target_date
          AND p2.work_style_category IS NOT NULL
        GROUP BY work_style_category
      ) sub
    ),
    jsonb_build_object(
      'polite', COUNT(*) FILTER (WHERE p.sentiment = 'polite'),
      'frustrated', COUNT(*) FILTER (WHERE p.sentiment = 'frustrated'),
      'neutral', COUNT(*) FILTER (WHERE p.sentiment = 'neutral'),
      'directive', COUNT(*) FILTER (WHERE p.sentiment = 'directive')
    ),
    COUNT(DISTINCT p.user_id)::INTEGER
  FROM prompts p
  LEFT JOIN prompt_analyses pa ON pa.prompt_id = p.id
  LEFT JOIN sessions s ON s.id = p.session_id
  WHERE DATE(p.created_at) = target_date
  GROUP BY p.team_id;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION aggregate_user_daily_analytics TO service_role;
GRANT EXECUTE ON FUNCTION aggregate_team_daily_analytics TO service_role;
```

---

### RLS Policies

All RLS policies follow these principles:

1. **Users see their own data** - Personal analytics
2. **Team members see team data** - Team-level aggregates
3. **Team admins see member data** - For coaching
4. **Service role bypasses RLS** - For aggregation jobs

See the migration above for complete RLS policy definitions.

---

### Indexes for Performance

```sql
-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Prompts: Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_prompts_user_date ON prompts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_team_date ON prompts(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_session_seq ON prompts(session_id, sequence_number);

-- Partial indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_prompts_frustrated ON prompts(user_id, created_at)
  WHERE sentiment = 'frustrated';
CREATE INDEX IF NOT EXISTS idx_prompts_rapid_fire ON prompts(session_id, created_at)
  WHERE is_rapid_fire = true;

-- Sessions: Health monitoring
CREATE INDEX IF NOT EXISTS idx_sessions_health ON sessions(health_level, started_at DESC)
  WHERE health_level IN ('warning', 'critical');

-- Analytics tables: Time-series queries
CREATE INDEX IF NOT EXISTS idx_user_daily_recent ON user_daily_analytics(user_id, date DESC)
  INCLUDE (total_prompts, avg_prompt_score);
CREATE INDEX IF NOT EXISTS idx_team_daily_recent ON team_daily_analytics(team_id, date DESC)
  INCLUDE (total_prompts, avg_prompt_score);
```

---

## API Endpoints

### Individual Prompt Analysis

```typescript
// GET /api/prompts/:id/analysis

interface PromptAnalysisResponse {
  promptId: string;
  coreAnalysis: {
    overallScore: number;
    dimensionScores: Record<string, { score: number; reasoning: string }>;
    suggestions: string[];
  };
  enhancedAnalysis: {
    workStyle: {
      category: WorkStyleCategory;
      confidence: number;
    };
    sentiment: {
      sentiment: Sentiment;
      confidence: number;
      scores: { polite: number; frustrated: number; directive: number };
    };
    complexity: {
      level: 'simple' | 'moderate' | 'complex';
      score: number;
      charCount: number;
      wordCount: number;
      sentenceCount: number;
      hasCode: boolean;
      hasFileRefs: boolean;
    };
    timing: {
      timeSincePrevious: number | null;
      isRapidFire: boolean;
      isLongPause: boolean;
      isFollowUp: boolean;
      sequenceNumber: number;
    };
  };
}
```

---

### User Insights Dashboard

```typescript
// GET /api/analytics/insights?userId=xxx&timeRange=30d

interface InsightsRequest {
  userId: string;
  timeRange: '7d' | '30d' | '90d' | 'all';
}

interface InsightsResponse {
  summary: {
    totalPrompts: number;
    totalSessions: number;
    avgSessionDurationMinutes: number;
    avgPromptScore: number | null;
    scoreChange: number | null;  // vs previous period
  };
  workStyle: {
    distribution: Record<WorkStyleCategory, number>;
    primaryStyle: WorkStyleCategory;
    secondaryStyle: WorkStyleCategory | null;
  };
  technicalProfile: {
    persona: TechnicalPersona;
    confidence: number;
    breakdown: {
      architectureRatio: number;
      debuggingRatio: number;
      testingRatio: number;
      implementationRatio: number;
    };
  };
  sentiment: {
    overallPoliteRate: number;
    overallFrustratedRate: number;
    politenessRatio: number;
    trend: TrendDirection;
    byWorkStyle: Record<WorkStyleCategory, {
      politeRate: number;
      frustratedRate: number;
    }>;
  };
  sessionHealth: {
    avgHealthScore: number;
    healthDistribution: {
      healthy: number;
      warning: number;
      critical: number;
    };
    avgSessionDuration: number;
    contextExhaustionRate: number;
  };
  complexity: {
    avgComplexity: number;
    distribution: {
      simple: number;
      moderate: number;
      complex: number;
    };
    avgCharsPerPrompt: number;
    codeInclusionRate: number;
  };
  timing: {
    rapidFireRate: number;
    longPauseRate: number;
    followUpRate: number;
    avgGapSeconds: number;
    medianGapSeconds: number;
  };
  toolUsage: {
    distribution: Record<string, number>;
    topTools: string[];
    underutilizedTools: string[];
    userProfile: string;
  };
  learning: LearningProgression;
  efficiency: EfficiencyMetrics;
  personalizedTips: string[];
}
```

---

### Team Intelligence API

```typescript
// GET /api/analytics/team/:teamId/intelligence?timeRange=30d

interface TeamIntelligenceRequest {
  teamId: string;
  timeRange: '7d' | '30d' | '90d';
}

interface TeamIntelligenceResponse {
  summary: {
    teamSize: number;
    activeUsers: number;
    totalPrompts: number;
    totalSessions: number;
    avgPromptScore: number;
    scoreChange: number | null;
  };
  styleDistribution: Record<WorkStyleCategory, number>;
  personaDistribution: Record<TechnicalPersona, number>;
  sentimentHealth: {
    teamPoliteRate: number;
    teamFrustratedRate: number;
    politenessRatio: number;
    trend: TrendDirection;
  };
  sessionHealth: {
    avgHealthScore: number;
    healthySessionRate: number;
    avgContextUsage: number;
  };
  topPerformers: Array<{
    userId: string;
    userName: string;
    metric: 'prompt_quality' | 'efficiency' | 'session_health';
    value: number;
    rank: number;
  }>;
  commonStruggles: Array<{
    issue: string;
    affectedPercent: number;
    severity: 'low' | 'medium' | 'high';
    suggestion: string;
  }>;
  bestPractices: Array<{
    pattern: string;
    exemplarCount: number;
    impact: string;
    examples: string[];
  }>;
  weekOverWeek: {
    promptScoreChange: number;
    efficiencyChange: number;
    frustrationChange: number;
  };
}
```

---

### Learning Progression API

```typescript
// GET /api/analytics/learning?userId=xxx

interface LearningProgressionResponse {
  currentWeek: WeeklyMetrics;
  previousWeek: WeeklyMetrics | null;
  weeklyHistory: WeeklyMetrics[];  // Last 12 weeks
  improvements: {
    promptScore: number;
    frustration: number;
    efficiency: number;
    contextManagement: number;
  } | null;
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    earnedAt: string | null;
    progress: number;  // 0-100
  }>;
  milestones: Array<{
    metric: string;
    baseline: number;
    current: number;
    target: number;
    progress: number;
  }>;
  recommendations: string[];
}
```

---

## TypeScript Interfaces

```typescript
// lib/types/analytics.ts

// ============================================
// WORK STYLE TYPES
// ============================================

export type WorkStyleCategory =
  | 'architecture_questions'
  | 'file_operations'
  | 'debugging'
  | 'agent_delegation'
  | 'testing'
  | 'deployment'
  | 'design_iteration'
  | 'context_recovery'
  | 'quick_commands'
  | 'business_discussion';

export interface WorkStyleClassification {
  category: WorkStyleCategory;
  confidence: number;
  matchedPattern?: string;
}

// ============================================
// SENTIMENT TYPES
// ============================================

export type Sentiment = 'polite' | 'frustrated' | 'neutral' | 'directive';

export interface SentimentAnalysis {
  sentiment: Sentiment;
  confidence: number;
  scores: {
    polite: number;
    frustrated: number;
    directive: number;
  };
}

// ============================================
// COMPLEXITY TYPES
// ============================================

export type ComplexityLevel = 'simple' | 'moderate' | 'complex';

export interface ComplexityMetrics {
  charCount: number;
  wordCount: number;
  sentenceCount: number;
  hasCode: boolean;
  hasFileRefs: boolean;
  codeBlockCount: number;
  fileRefCount: number;
  complexityLevel: ComplexityLevel;
  complexityScore: number;
}

// ============================================
// TIMING TYPES
// ============================================

export interface TimingMetrics {
  timeSincePreviousSeconds: number | null;
  isRapidFire: boolean;
  isLongPause: boolean;
  isFollowUp: boolean;
  sequenceNumber: number;
}

// ============================================
// SESSION HEALTH TYPES
// ============================================

export type HealthLevel = 'healthy' | 'warning' | 'critical';

export interface SessionHealthMetrics {
  healthScore: number;
  healthLevel: HealthLevel;
  factors: {
    durationScore: number;
    contextScore: number;
    frustrationScore: number;
    retryScore: number;
  };
  warnings: string[];
  suggestions: string[];
}

// ============================================
// TECHNICAL PROFILE TYPES
// ============================================

export type TechnicalPersona = 'architect' | 'firefighter' | 'craftsman' | 'explorer';

export interface TechnicalDepthProfile {
  persona: TechnicalPersona;
  confidence: number;
  breakdown: {
    architectureRatio: number;
    debuggingRatio: number;
    testingRatio: number;
    implementationRatio: number;
  };
  personaDescription: string;
}

// ============================================
// TOOL USAGE TYPES
// ============================================

export type ToolName =
  | 'Bash'
  | 'Read'
  | 'Edit'
  | 'Write'
  | 'Glob'
  | 'Grep'
  | 'TodoWrite'
  | 'Task'
  | 'WebFetch'
  | 'WebSearch'
  | 'NotebookEdit';

export type ToolUserProfile =
  | 'terminal_power'
  | 'code_centric'
  | 'methodical'
  | 'balanced';

export interface ToolUsageProfile {
  distribution: Record<ToolName, number>;
  totalCalls: number;
  topTools: ToolName[];
  underutilizedTools: ToolName[];
  userProfile: ToolUserProfile;
}

// ============================================
// LEARNING PROGRESSION TYPES
// ============================================

export interface WeeklyMetrics {
  weekStart: string;
  avgPromptScore: number;
  frustrationRate: number;
  promptsPerGoal: number;
  contextExhaustionRate: number;
  totalPrompts: number;
  totalSessions: number;
}

export interface LearningProgression {
  currentWeek: WeeklyMetrics;
  previousWeek: WeeklyMetrics | null;
  improvements: {
    promptScore: number;
    frustration: number;
    efficiency: number;
    contextManagement: number;
  } | null;
  achievements: string[];
  suggestions: string[];
}

// ============================================
// EFFICIENCY TYPES
// ============================================

export type EfficiencyBenchmark =
  | 'below_average'
  | 'average'
  | 'above_average'
  | 'excellent';

export interface EfficiencyMetrics {
  promptsPerTask: number;
  contextResetsPerSession: number;
  debuggingLoopAverage: number;
  timeToResolutionMinutes: number;
  efficiencyScore: number;
  benchmark: EfficiencyBenchmark;
}

// ============================================
// ENHANCED PROMPT TYPE
// ============================================

export interface EnhancedPrompt {
  id: string;
  teamId: string;
  projectId: string;
  userId: string;
  text: string;

  // Core fields
  charCount: number;
  wordCount: number;
  analysisStatus: 'pending' | 'processing' | 'complete' | 'failed';

  // Enhanced analysis fields
  workStyleCategory: WorkStyleCategory | null;
  workStyleConfidence: number | null;
  sentiment: Sentiment | null;
  sentimentConfidence: number | null;
  sentimentScores: SentimentAnalysis['scores'] | null;
  sentenceCount: number | null;
  hasCode: boolean;
  hasFileRefs: boolean;
  codeBlockCount: number;
  fileRefCount: number;
  complexityLevel: ComplexityLevel | null;
  complexityScore: number | null;
  timeSincePreviousSeconds: number | null;
  isRapidFire: boolean;
  isLongPause: boolean;
  isFollowUp: boolean;
  sequenceNumber: number | null;

  // Session link
  sessionId: string | null;

  createdAt: string;
}

// ============================================
// AGGREGATION TYPES
// ============================================

export interface UserDailyAnalytics {
  id: string;
  userId: string;
  date: string;
  totalPrompts: number;
  totalSessions: number;
  avgPromptScore: number | null;
  avgSessionHealth: number | null;
  workStyleDistribution: Record<WorkStyleCategory, number>;
  sentimentDistribution: Record<Sentiment, number>;
  complexityDistribution: Record<ComplexityLevel, number>;
  frustrationCount: number;
  rapidFireCount: number;
  followUpCount: number;
}

export interface TeamDailyAnalytics {
  id: string;
  teamId: string;
  date: string;
  totalPrompts: number;
  totalSessions: number;
  avgPromptScore: number | null;
  avgSessionHealth: number | null;
  workStyleDistribution: Record<WorkStyleCategory, number>;
  sentimentDistribution: Record<Sentiment, number>;
  activeUsers: number;
}
```

---

## Performance Considerations

### Latency Budgets

| Operation | Budget | Strategy |
|-----------|--------|----------|
| Prompt capture + sync classification | <15ms | Run classifiers in parallel |
| Dashboard initial load | <300ms | React Query with suspense |
| Insights API response | <200ms | Pre-aggregated data |
| Daily aggregation job | <60s | Off-peak execution |
| Weekly aggregation job | <120s | Off-peak execution |

### Caching Strategy

```typescript
// React Query cache configuration
const CACHE_CONFIG = {
  personalInsights: {
    staleTime: 5 * 60 * 1000,     // 5 minutes
    gcTime: 30 * 60 * 1000,       // 30 minutes
  },
  teamIntelligence: {
    staleTime: 15 * 60 * 1000,    // 15 minutes
    gcTime: 60 * 60 * 1000,       // 1 hour
  },
  learningProgression: {
    staleTime: 60 * 60 * 1000,    // 1 hour
    gcTime: 24 * 60 * 60 * 1000,  // 24 hours
  },
  sessionHealth: {
    staleTime: 30 * 1000,         // 30 seconds (real-time feel)
    gcTime: 5 * 60 * 1000,        // 5 minutes
  },
};
```

### Database Optimization

1. **Partial indexes** for filtered queries (frustrated prompts, rapid-fire)
2. **Covering indexes** with INCLUDE for common projections
3. **JSONB indexes** for work_style_distribution queries
4. **Table partitioning** for prompts (by created_at month) if volume exceeds 10M rows

### Aggregation Job Scheduling

```yaml
# Supabase cron configuration
schedules:
  - name: daily-user-analytics
    schedule: "5 0 * * *"  # 00:05 UTC
    function: aggregate-user-daily

  - name: daily-team-analytics
    schedule: "10 0 * * *"  # 00:10 UTC
    function: aggregate-team-daily

  - name: weekly-user-metrics
    schedule: "0 1 * * 0"  # Sunday 01:00 UTC
    function: aggregate-user-weekly
```

---

## Implementation Phases

### Phase 1: Foundation (Stories 21.2, 21.3, 21.4)

**Duration:** 1 sprint

1. Add columns to prompts table
2. Implement sync classifiers (work style, sentiment, complexity)
3. Integrate classifiers into capture API
4. Add unit tests for all classifiers

**Deliverables:**
- Enhanced prompts with classification data
- 85% accuracy on work style classification
- 80% accuracy on sentiment detection

### Phase 2: Session Analytics (Stories 21.1, 21.5, 21.7)

**Duration:** 1 sprint

**Depends on:** Epic 16 (Sessions)

1. Create sessions table if not exists
2. Add session health columns
3. Implement timing analysis
4. Implement context exhaustion detection
5. Create session health calculation

**Deliverables:**
- Session-level health scores
- Context exhaustion tracking
- Timing pattern detection

### Phase 3: Aggregation Pipeline (Stories 21.6, 21.8, 21.9, 21.10)

**Duration:** 1 sprint

1. Create aggregation tables
2. Implement daily aggregation functions
3. Implement weekly aggregation functions
4. Create Edge Functions for cron jobs
5. Implement technical depth profiling
6. Implement workflow efficiency scoring

**Deliverables:**
- Daily/weekly aggregated analytics
- Technical personas assigned to users
- Efficiency benchmarking

### Phase 4: Dashboards (Stories 21.11, 21.12)

**Duration:** 2 sprints

1. Create API endpoints for all analytics
2. Build personal insights dashboard
3. Build team intelligence dashboard
4. Add visualization components (charts, radar, heatmaps)
5. Implement personalized tips engine

**Deliverables:**
- Interactive personal insights dashboard
- Team intelligence dashboard
- Personalized coaching recommendations

---

## Appendix: Accuracy Measurement Plan

### Work Style Classifier Validation

```typescript
// Manual labeling of 200 prompts across categories
// Target: 85% accuracy (170/200)

interface ValidationResult {
  category: WorkStyleCategory;
  predicted: WorkStyleCategory;
  correct: boolean;
  confidence: number;
}

// Confusion matrix tracking
const confusionMatrix: Record<WorkStyleCategory, Record<WorkStyleCategory, number>> = {
  // predicted vs actual
};
```

### Sentiment Classifier Validation

```typescript
// Manual labeling of 200 prompts
// Target: 80% accuracy

// Special attention to:
// - False positives on frustration (user just explaining a bug)
// - False negatives on subtle politeness
```

### Continuous Monitoring

- Log classification results with confidence scores
- Alert if low-confidence classifications exceed 20%
- Monthly accuracy review with sample manual labeling

---

## Appendix: Security Considerations

1. **All aggregation functions are SECURITY DEFINER** - Run with elevated privileges
2. **RLS enforced on all new tables** - Multi-tenant isolation guaranteed
3. **Aggregation jobs use service role** - Bypass RLS for cross-user aggregation
4. **No PII in work_style or sentiment** - Only categorical labels stored
5. **Team admins see aggregates, not individual prompts** - Privacy preserved

---

*Document Version: 1.0*
*Last Updated: 2025-12-23*
