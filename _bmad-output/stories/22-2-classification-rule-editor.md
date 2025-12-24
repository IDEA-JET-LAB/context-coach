# Story 22.2: Classification Rule Editor

Status: Complete

## Story

**As a** super admin,
**I want** to create and manage regex-based classification patterns,
**So that** I can categorize prompts automatically without code changes.

## Acceptance Criteria

1. **Given** I navigate to Admin > Analysis > Classification Rules
   **When** the page loads
   **Then** I see all classification rules grouped by category
   **And** each rule shows: name, regex pattern, category, match count

2. **Given** I click "Create Rule"
   **When** the form opens
   **Then** I can define: name, category, regex pattern, priority, description
   **And** I see a regex pattern tester with sample inputs

3. **Given** I enter a regex pattern
   **When** I test it with sample text
   **Then** I see matches highlighted in the sample
   **And** I see match groups if any are defined

4. **Given** I have multiple rules for the same category
   **When** a prompt matches multiple patterns
   **Then** the highest priority rule determines the match
   **And** all matching rules are logged for debugging

5. **Given** I save a classification rule
   **When** validation passes
   **Then** the rule is saved and immediately active
   **And** the rule is tested for ReDoS vulnerability

6. **Given** I enter a potentially dangerous regex
   **When** ReDoS detection runs
   **Then** I see a warning about catastrophic backtracking
   **And** the rule cannot be saved until fixed

7. **Given** I create or edit a classification rule
   **When** the pattern overlaps with existing rules in the same category
   **Then** I see a conflict warning showing which rules have overlapping patterns
   **And** I can view sample inputs that would match multiple rules
   **And** I can choose to proceed or adjust the pattern

8. **Given** I am on the classification rules list page
   **When** I click "Export Rules"
   **Then** I can download all rules as a JSON file
   **And** when I click "Import Rules" I can upload a JSON file
   **And** the import validates the JSON schema before applying
   **And** conflicts with existing rules are shown for review

9. **Given** I select multiple rules on the list page
   **When** I use bulk actions
   **Then** I can enable/disable all selected rules at once
   **And** I can change the category of all selected rules
   **And** I see a confirmation dialog before applying bulk changes

## Dependencies

- **Story 7.5**: Analysis Config Editor (base admin config UI patterns)
- **Story 22.10**: Configuration Audit Trail (audit logging)
- **Epic 21**: Classification Architecture (provides category definitions)

## Tasks / Subtasks

- [x] **Task 1: Create database schema for classification rules** (AC: #1, #5)
  - [x] Create migration `20251223002000_classification_rules.sql`
  - [x] Create `classification_rules` table with: id, name, category, pattern, priority, enabled, created_by, created_at
  - [x] Create `classification_categories` table for category definitions
  - [x] Add RLS policies for super admin access only
  - [x] Audit handled at application level via config_audit_logs (Story 22-10)

- [x] **Task 2: Create classification rules list page** (AC: #1)
  - [x] Create `app/(dashboard)/admin/analysis/rules/page.tsx`
  - [x] Query all rules grouped by category
  - [x] Display rules in expandable category sections
  - [x] Show match count (from analytics) for each rule
  - [x] Add filter by category
  - [x] Add "Create Rule" button

- [x] **Task 3: Create category management component** (AC: #1)
  - [x] Create `components/admin/category-manager.tsx`
  - [x] Display all categories with rule counts
  - [x] Allow adding new categories with name and description
  - [x] Allow renaming and archiving categories (not delete if rules exist)

- [x] **Task 4: Create rule form component** (AC: #2)
  - [x] Create `components/admin/classification-rule-form.tsx`
  - [x] Add name input field
  - [x] Add category selector (from classification_categories)
  - [x] Add regex pattern input with monospace font
  - [x] Add priority number input (1-100, higher = more important)
  - [x] Add description textarea

- [x] **Task 5: Create regex pattern tester** (AC: #3)
  - [x] Create `components/admin/regex-tester.tsx`
  - [x] Add sample text input area
  - [x] Highlight matches in real-time
  - [x] Display match groups in a panel
  - [x] Show match count and positions

- [x] **Task 6: Implement ReDoS detection** (AC: #6)
  - [x] Create `lib/utils/redos-detector.ts`
  - [x] Implement pattern analysis for nested quantifiers
  - [x] Detect overlapping alternations
  - [x] Add timeout-based safety test (run pattern against crafted input)
  - [x] Return warning severity: safe, warning, dangerous

- [x] **Task 7: Implement pattern validation** (AC: #5, #6)
  - [x] Validate regex syntax before save
  - [x] Run ReDoS detection on all patterns
  - [x] Block save if pattern is dangerous
  - [x] Show warning but allow save for warning-level patterns
  - [x] Test pattern against 5 sample prompts for basic verification

- [x] **Task 8: Create rule save/update workflow** (AC: #5)
  - [x] Create `lib/services/classification-rules.ts` server actions
  - [x] Implement `createRule()` with validation
  - [x] Implement `updateRule()` with pattern change tracking
  - [x] Implement `toggleRuleEnabled()` for quick enable/disable
  - [x] Log all changes to audit trail

- [x] **Task 9: Implement priority-based matching** (AC: #4)
  - [x] Create `lib/services/classification-engine.ts`
  - [x] Query rules ordered by priority DESC
  - [x] Return highest priority match as primary category
  - [x] Return all matches for debugging/analytics
  - [x] Cache compiled regex patterns for performance

- [x] **Task 10: Create rule detail/edit page** (AC: #2, #3)
  - [x] Create `app/(dashboard)/admin/analysis/rules/[id]/page.tsx`
  - [x] Load existing rule data
  - [x] Allow editing all fields
  - [x] Show match history (recent prompts matched by this rule)
  - [x] Add "Test on historical data" button

- [x] **Task 11: Write E2E tests** (AC: #1-6)
  - [x] Create `e2e/admin-classification-rules.spec.ts`
  - [x] Test rule list grouped by category
  - [x] Test rule creation with valid regex
  - [x] Test regex tester highlighting
  - [x] Test ReDoS warning display
  - [x] Test priority-based matching

- [x] **Task 12: Implement import/export functionality** (AC: #8)
  - [x] Create `lib/services/classification-rules-io.ts`
  - [x] Implement `exportRules()` returning JSON with schema version
  - [x] Implement `importRules()` with JSON schema validation
  - [x] Add conflict detection for duplicate rule names/patterns
  - [x] Create import preview UI showing rules to be added/updated
  - [x] Add "Export Rules" and "Import Rules" buttons to list page
  - [x] Support partial import (skip conflicting rules)

- [x] **Task 13: Implement pattern conflict detection** (AC: #7)
  - [x] Create `lib/utils/pattern-conflict-detector.ts`
  - [x] Implement overlap detection algorithm using sample input generation
  - [x] Generate sample strings that match both patterns
  - [x] Display conflict warnings in rule form
  - [x] Show affected rules with links to edit them
  - [x] Add conflict severity levels (info, warning, error)

- [x] **Task 14: Implement bulk operations** (AC: #9)
  - [x] Add checkbox column to rules table for multi-select
  - [x] Create `components/admin/bulk-actions-bar.tsx`
  - [x] Implement "Select All" / "Deselect All" functionality
  - [x] Add bulk enable/disable action
  - [x] Add bulk category change action
  - [x] Create confirmation dialog with affected rule count
  - [x] Log bulk operations to audit trail

## Dev Notes

### Database Schema

```sql
-- Migration: 20251223002000_classification_rules.sql

-- Classification categories
CREATE TABLE classification_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366f1', -- Hex color for UI
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classification rules
CREATE TABLE classification_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  category_id UUID REFERENCES classification_categories(id) ON DELETE RESTRICT,
  pattern TEXT NOT NULL,
  pattern_flags VARCHAR(10) DEFAULT 'i', -- Regex flags (i, g, m, etc.)
  priority INTEGER DEFAULT 50 CHECK (priority >= 1 AND priority <= 100),
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  match_count INTEGER DEFAULT 0, -- Updated by analytics pipeline
  last_matched_at TIMESTAMPTZ,
  redos_risk VARCHAR(20) DEFAULT 'safe' CHECK (redos_risk IN ('safe', 'warning', 'dangerous')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rules_category ON classification_rules(category_id);
CREATE INDEX idx_rules_enabled ON classification_rules(enabled) WHERE enabled = TRUE;
CREATE INDEX idx_rules_priority ON classification_rules(priority DESC);

-- RLS Policies
ALTER TABLE classification_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_rules ENABLE ROW LEVEL SECURITY;

-- Insert default categories based on Epic 21 research
INSERT INTO classification_categories (name, description, color, sort_order) VALUES
  ('feature_request', 'New feature implementation requests', '#22c55e', 1),
  ('bug_fix', 'Bug fixes and error resolution', '#ef4444', 2),
  ('refactoring', 'Code refactoring and cleanup', '#f59e0b', 3),
  ('documentation', 'Documentation and comments', '#3b82f6', 4),
  ('testing', 'Test creation and modification', '#8b5cf6', 5),
  ('debugging', 'Debugging and investigation', '#ec4899', 6),
  ('configuration', 'Config and setup tasks', '#6366f1', 7),
  ('learning', 'Questions and exploration', '#14b8a6', 8);

-- Insert sample rules
INSERT INTO classification_rules (name, category_id, pattern, priority, description) VALUES
  (
    'Bug Fix Keywords',
    (SELECT id FROM classification_categories WHERE name = 'bug_fix'),
    '\\b(fix|bug|error|issue|problem|broken|crash|fail)\\b',
    80,
    'Matches common bug-related terminology'
  ),
  (
    'Feature Creation',
    (SELECT id FROM classification_categories WHERE name = 'feature_request'),
    '\\b(add|create|implement|build|new feature|introduce)\\b',
    70,
    'Matches feature creation language'
  ),
  (
    'Test Keywords',
    (SELECT id FROM classification_categories WHERE name = 'testing'),
    '\\b(test|spec|assert|expect|mock|jest|playwright|vitest)\\b',
    75,
    'Matches testing-related terminology'
  );
```

### TypeScript Interfaces

```typescript
// lib/types/classification-rules.ts

export type RedosRisk = 'safe' | 'warning' | 'dangerous';

export interface ClassificationCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  rule_count?: number; // Computed from join
}

export interface ClassificationRule {
  id: string;
  name: string;
  category_id: string;
  category?: ClassificationCategory;
  pattern: string;
  pattern_flags: string;
  priority: number;
  description: string | null;
  enabled: boolean;
  match_count: number;
  last_matched_at: string | null;
  redos_risk: RedosRisk;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegexTestResult {
  matches: Array<{
    text: string;
    index: number;
    length: number;
    groups: Record<string, string>;
  }>;
  matchCount: number;
  executionTime: number; // ms
}

export interface RedosAnalysis {
  risk: RedosRisk;
  issues: string[];
  suggestions: string[];
}
```

### ReDoS Detection Implementation

```typescript
// lib/utils/redos-detector.ts

/**
 * Detect potential ReDoS vulnerabilities in regex patterns
 *
 * Common dangerous patterns:
 * - Nested quantifiers: (a+)+
 * - Overlapping alternations: (a|a)+
 * - Greedy quantifiers with backtracking: .*.*
 */
export function analyzePattern(pattern: string): RedosAnalysis {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check for nested quantifiers
  const nestedQuantifiers = /\([^)]*[+*]\)[+*]/;
  if (nestedQuantifiers.test(pattern)) {
    issues.push('Nested quantifiers detected (e.g., (a+)+). This can cause exponential backtracking.');
    suggestions.push('Replace nested quantifiers with atomic groups or possessive quantifiers.');
  }

  // Check for overlapping alternations
  const overlappingAlt = /\(([^|)]+)\|(\1[^)]*|\1)\)/;
  if (overlappingAlt.test(pattern)) {
    issues.push('Overlapping alternations detected. Matches can be ambiguous.');
    suggestions.push('Make alternation branches mutually exclusive.');
  }

  // Check for .* followed by specific patterns
  const greedyDot = /\.\*[^?]/;
  if (greedyDot.test(pattern)) {
    issues.push('Greedy .* may cause excessive backtracking on non-matching input.');
    suggestions.push('Consider using .*? (lazy) or more specific patterns.');
  }

  // Timeout-based safety test
  const isSafe = testPatternSafety(pattern);
  if (!isSafe) {
    issues.push('Pattern took too long on crafted input (possible ReDoS).');
  }

  // Determine risk level
  let risk: RedosRisk = 'safe';
  if (issues.length > 0 && !isSafe) {
    risk = 'dangerous';
  } else if (issues.length > 0) {
    risk = 'warning';
  }

  return { risk, issues, suggestions };
}

function testPatternSafety(pattern: string, timeoutMs = 100): boolean {
  try {
    const regex = new RegExp(pattern, 'i');
    const evilInput = 'a'.repeat(30) + '!'; // Crafted input

    const start = performance.now();
    regex.test(evilInput);
    const elapsed = performance.now() - start;

    return elapsed < timeoutMs;
  } catch {
    return true; // Invalid pattern, will be caught elsewhere
  }
}
```

### Classification Engine

```typescript
// lib/services/classification-engine.ts

import { createAdminClient } from '@/lib/supabase/admin';

interface ClassificationResult {
  primary: {
    category: string;
    rule_id: string;
    rule_name: string;
    confidence: number;
  } | null;
  all_matches: Array<{
    category: string;
    rule_id: string;
    rule_name: string;
    priority: number;
  }>;
}

// Cache compiled regex patterns
const patternCache = new Map<string, RegExp>();

export async function classifyPrompt(prompt: string): Promise<ClassificationResult> {
  const supabase = createAdminClient();

  // Fetch all enabled rules ordered by priority
  const { data: rules } = await supabase
    .from('classification_rules')
    .select(`
      id, name, pattern, pattern_flags, priority,
      category:classification_categories(id, name)
    `)
    .eq('enabled', true)
    .order('priority', { ascending: false });

  if (!rules) return { primary: null, all_matches: [] };

  const matches: ClassificationResult['all_matches'] = [];

  for (const rule of rules) {
    const regex = getCompiledPattern(rule.id, rule.pattern, rule.pattern_flags);

    if (regex.test(prompt)) {
      matches.push({
        category: rule.category.name,
        rule_id: rule.id,
        rule_name: rule.name,
        priority: rule.priority,
      });
    }
  }

  // Primary is highest priority match
  const primary = matches.length > 0 ? {
    category: matches[0].category,
    rule_id: matches[0].rule_id,
    rule_name: matches[0].rule_name,
    confidence: calculateConfidence(matches),
  } : null;

  return { primary, all_matches: matches };
}

function getCompiledPattern(id: string, pattern: string, flags: string): RegExp {
  const cacheKey = `${id}:${pattern}:${flags}`;
  if (!patternCache.has(cacheKey)) {
    patternCache.set(cacheKey, new RegExp(pattern, flags));
  }
  return patternCache.get(cacheKey)!;
}

function calculateConfidence(matches: ClassificationResult['all_matches']): number {
  if (matches.length === 0) return 0;
  if (matches.length === 1) return 0.95;

  // Lower confidence if multiple categories matched
  const uniqueCategories = new Set(matches.map(m => m.category));
  if (uniqueCategories.size === 1) return 0.90;

  // Multiple categories = ambiguous
  return 0.70;
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Rules List Page | `app/(dashboard)/admin/analysis/rules/page.tsx` |
| Rule Detail Page | `app/(dashboard)/admin/analysis/rules/[id]/page.tsx` |
| New Rule Page | `app/(dashboard)/admin/analysis/rules/new/page.tsx` |
| Rule Form | `components/admin/classification-rule-form.tsx` |
| Category Manager | `components/admin/category-manager.tsx` |
| Regex Tester | `components/admin/regex-tester.tsx` |
| ReDoS Warning | `components/admin/redos-warning.tsx` |
| Services | `lib/services/classification-rules.ts` |
| Engine | `lib/services/classification-engine.ts` |
| Types | `lib/types/classification-rules.ts` |
| ReDoS Detector | `lib/utils/redos-detector.ts` |

### Security Considerations

1. **ReDoS Prevention**: All patterns must pass ReDoS analysis before save
2. **Pattern Timeout**: Execution timeout in classification engine (50ms per pattern)
3. **Input Sanitization**: Pattern input sanitized to prevent SQL injection in LIKE queries
4. **Audit Trail**: All rule changes logged via Story 22.10
5. **Rate Limiting**: Pattern testing rate limited (10/minute)

### Performance Requirements

- Pattern compilation: < 1ms (cached)
- Single pattern match: < 5ms
- Full classification (all rules): < 50ms
- Cache invalidation on rule update

### Pattern Conflict Detection Algorithm

```typescript
// lib/utils/pattern-conflict-detector.ts

interface PatternConflict {
  ruleId: string;
  ruleName: string;
  pattern: string;
  overlapType: 'subset' | 'superset' | 'partial';
  sampleMatches: string[]; // Inputs that match both patterns
  severity: 'info' | 'warning' | 'error';
}

/**
 * Detect overlapping regex patterns within the same category.
 *
 * Algorithm:
 * 1. Generate sample strings that match the new pattern
 * 2. Test those samples against all existing rules in same category
 * 3. For each match, classify the overlap type:
 *    - subset: new pattern matches subset of existing
 *    - superset: new pattern matches superset of existing
 *    - partial: patterns overlap but neither contains the other
 * 4. Return conflicts sorted by severity
 */
export async function detectPatternConflicts(
  newPattern: string,
  categoryId: string,
  excludeRuleId?: string // When editing, exclude self
): Promise<PatternConflict[]> {
  const conflicts: PatternConflict[] = [];

  // Generate sample strings that match the new pattern
  const samples = generateMatchingSamples(newPattern, 20);

  // Fetch existing rules in same category
  const existingRules = await fetchRulesInCategory(categoryId, excludeRuleId);

  for (const rule of existingRules) {
    const matchingBoth = samples.filter(s => {
      try {
        return new RegExp(rule.pattern, rule.pattern_flags).test(s);
      } catch {
        return false;
      }
    });

    if (matchingBoth.length > 0) {
      const overlapType = classifyOverlap(newPattern, rule.pattern, samples);
      conflicts.push({
        ruleId: rule.id,
        ruleName: rule.name,
        pattern: rule.pattern,
        overlapType,
        sampleMatches: matchingBoth.slice(0, 3),
        severity: overlapType === 'subset' ? 'info' :
                  overlapType === 'superset' ? 'warning' : 'error',
      });
    }
  }

  return conflicts.sort((a, b) =>
    severityOrder[b.severity] - severityOrder[a.severity]
  );
}

/**
 * Generate strings that match a regex pattern.
 * Uses common word lists and pattern-aware generation.
 */
function generateMatchingSamples(pattern: string, count: number): string[] {
  const samples: string[] = [];
  const regex = new RegExp(pattern, 'i');

  // Start with common programming terms
  const wordLists = [
    'fix', 'bug', 'error', 'add', 'create', 'test', 'update', 'remove',
    'implement', 'refactor', 'debug', 'build', 'deploy', 'configure',
    // ... more domain words
  ];

  // Generate phrases containing these words
  for (const word of wordLists) {
    const phrases = [
      word,
      `Please ${word} this`,
      `Can you ${word} the code`,
      `I need to ${word}`,
    ];
    for (const phrase of phrases) {
      if (regex.test(phrase) && samples.length < count) {
        samples.push(phrase);
      }
    }
  }

  return samples;
}

const severityOrder = { info: 0, warning: 1, error: 2 };
```

### Import/Export JSON Schema

```typescript
// lib/types/classification-rules-io.ts

/**
 * JSON schema for classification rules import/export.
 * Version 1.0 - Initial schema
 */
export interface ClassificationRulesExport {
  version: '1.0';
  exportedAt: string; // ISO timestamp
  exportedBy: string; // User email
  categories: ExportedCategory[];
  rules: ExportedRule[];
}

export interface ExportedCategory {
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
}

export interface ExportedRule {
  name: string;
  category_name: string; // References category by name
  pattern: string;
  pattern_flags: string;
  priority: number;
  description: string | null;
  enabled: boolean;
}

/**
 * Import result with detailed status for each rule
 */
export interface ImportResult {
  success: boolean;
  summary: {
    categoriesCreated: number;
    categoriesSkipped: number;
    rulesCreated: number;
    rulesUpdated: number;
    rulesSkipped: number;
    errors: number;
  };
  details: ImportRuleResult[];
}

export interface ImportRuleResult {
  ruleName: string;
  status: 'created' | 'updated' | 'skipped' | 'error';
  reason?: string; // Why skipped or error message
  conflictsWith?: string; // Existing rule name if conflict
}

// JSON Schema for validation (used with Zod or similar)
export const importSchemaValidator = z.object({
  version: z.literal('1.0'),
  exportedAt: z.string().datetime(),
  exportedBy: z.string().email(),
  categories: z.array(z.object({
    name: z.string().min(1).max(50),
    description: z.string().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    sort_order: z.number().int().min(0),
  })),
  rules: z.array(z.object({
    name: z.string().min(1).max(100),
    category_name: z.string(),
    pattern: z.string().min(1),
    pattern_flags: z.string().max(10),
    priority: z.number().int().min(1).max(100),
    description: z.string().nullable(),
    enabled: z.boolean(),
  })),
});
```

### Bulk Operations UI Patterns

```typescript
// components/admin/bulk-actions-bar.tsx

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkEnable: () => void;
  onBulkDisable: () => void;
  onBulkChangeCategory: (categoryId: string) => void;
  categories: ClassificationCategory[];
}

/**
 * Sticky action bar that appears when rules are selected.
 *
 * UI Pattern:
 * - Bar slides up from bottom when selection > 0
 * - Shows: "X rules selected" with select all/deselect all
 * - Actions: Enable All | Disable All | Change Category dropdown
 * - Each action triggers confirmation dialog
 */
export function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkEnable,
  onBulkDisable,
  onBulkChangeCategory,
  categories,
}: BulkActionsBarProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const handleAction = (action: string) => {
    setPendingAction(action);
    setShowConfirm(true);
  };

  return (
    <>
      <div className={cn(
        "fixed bottom-0 left-0 right-0 bg-background border-t p-4",
        "transform transition-transform duration-200",
        selectedCount > 0 ? "translate-y-0" : "translate-y-full"
      )}>
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedCount} of {totalCount} rules selected
            </span>
            <Button variant="link" size="sm" onClick={onSelectAll}>
              Select All
            </Button>
            <Button variant="link" size="sm" onClick={onDeselectAll}>
              Deselect All
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('enable')}
            >
              Enable All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('disable')}
            >
              Disable All
            </Button>
            <Select onValueChange={(id) => handleAction(`category:${id}`)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Change Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Confirm Bulk Action"
        description={`This will affect ${selectedCount} rules. Are you sure?`}
        onConfirm={() => {
          if (pendingAction === 'enable') onBulkEnable();
          else if (pendingAction === 'disable') onBulkDisable();
          else if (pendingAction?.startsWith('category:')) {
            onBulkChangeCategory(pendingAction.split(':')[1]);
          }
          setShowConfirm(false);
        }}
      />
    </>
  );
}
```

### Updated Component File Locations

| Component | Path |
|-----------|------|
| Rules List Page | `app/(dashboard)/admin/analysis/rules/page.tsx` |
| Rule Detail Page | `app/(dashboard)/admin/analysis/rules/[id]/page.tsx` |
| New Rule Page | `app/(dashboard)/admin/analysis/rules/new/page.tsx` |
| Rule Form | `components/admin/classification-rule-form.tsx` |
| Category Manager | `components/admin/category-manager.tsx` |
| Regex Tester | `components/admin/regex-tester.tsx` |
| ReDoS Warning | `components/admin/redos-warning.tsx` |
| **Bulk Actions Bar** | `components/admin/bulk-actions-bar.tsx` |
| **Conflict Warning** | `components/admin/pattern-conflict-warning.tsx` |
| **Import/Export Dialog** | `components/admin/rules-import-export.tsx` |
| Services | `lib/services/classification-rules.ts` |
| **Import/Export Service** | `lib/services/classification-rules-io.ts` |
| Engine | `lib/services/classification-engine.ts` |
| Types | `lib/types/classification-rules.ts` |
| **Import/Export Types** | `lib/types/classification-rules-io.ts` |
| ReDoS Detector | `lib/utils/redos-detector.ts` |
| **Conflict Detector** | `lib/utils/pattern-conflict-detector.ts` |

### Verification Checklist

After completing this story, verify:
- [ ] Rule list shows rules grouped by category
- [ ] Can create new rule with valid regex
- [ ] Regex tester highlights matches correctly
- [ ] Match groups are displayed
- [ ] ReDoS warning appears for dangerous patterns
- [ ] Cannot save dangerous patterns
- [ ] Priority determines primary category
- [ ] Match count updates from analytics
- [ ] Audit log records all changes
- [ ] Pattern cache invalidates on update
- [ ] Conflict detection warns about overlapping patterns
- [ ] Sample inputs shown for conflicting patterns
- [ ] Export downloads valid JSON file
- [ ] Import validates JSON schema
- [ ] Import preview shows rules to be added/updated
- [ ] Bulk select works with checkboxes
- [ ] Bulk enable/disable updates all selected rules
- [ ] Bulk category change works correctly
- [ ] Confirmation dialog appears before bulk actions


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
- All 14 tasks completed successfully
- Build passes with no TypeScript errors
- 1796 unit tests pass including 25 ReDoS detection tests
- E2E tests created for admin classification rules
- Database migration requires valid Supabase access token to apply
- Audit trail handled at application level via config_audit_logs (Story 22-10) instead of database triggers
- Fixed pre-existing build error in audit-log.ts (non-async export in 'use server' module)
- Fixed ConfirmationModal prop names (isLoading -> loading, danger -> warning variant)
- Fixed Supabase relation type handling (array vs single object)

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2024-12-24 | Initial implementation of all 14 tasks | Claude Opus 4.5 |
| 2024-12-24 | Fixed build errors (audit-log.ts, bulk-actions-bar, category-manager, classification-engine, classification-rules-io) | Claude Opus 4.5 |

### File List
**Created:**
- `app/supabase/migrations/20251223002000_classification_rules.sql` - Database schema
- `app/lib/types/classification-rules.ts` - TypeScript interfaces
- `app/lib/types/classification-rules-io.ts` - Import/export types with Zod schema
- `app/lib/utils/redos-detector.ts` - ReDoS vulnerability detection
- `app/lib/utils/__tests__/redos-detector.test.ts` - 25 unit tests for ReDoS detection
- `app/lib/utils/pattern-conflict-detector.ts` - Pattern overlap detection
- `app/lib/validations/classification-rules.ts` - Zod validation schemas
- `app/lib/services/classification-rules.ts` - CRUD server actions
- `app/lib/services/classification-engine.ts` - Classification matching engine
- `app/lib/services/classification-rules-io.ts` - Import/export server actions
- `app/app/(dashboard)/admin/analysis/rules/page.tsx` - Rules list page
- `app/app/(dashboard)/admin/analysis/rules/new/page.tsx` - Create rule page
- `app/app/(dashboard)/admin/analysis/rules/[id]/page.tsx` - Edit rule page
- `app/app/api/admin/classification-rules/conflicts/route.ts` - Conflict detection API
- `app/components/admin/classification-rules-list.tsx` - Rules list component
- `app/components/admin/bulk-actions-bar.tsx` - Bulk operations bar
- `app/components/admin/category-manager.tsx` - Category management dialog
- `app/components/admin/regex-tester.tsx` - Interactive regex tester
- `app/components/admin/redos-warning.tsx` - ReDoS warning display
- `app/components/admin/classification-rule-form.tsx` - Rule create/edit form
- `app/components/admin/pattern-conflict-warning.tsx` - Conflict warnings
- `app/components/admin/rule-match-history.tsx` - Recent matches display
- `app/components/admin/rules-import-export.tsx` - Import/export dialog
- `app/components/ui/collapsible.tsx` - Radix collapsible component
- `app/e2e/admin-classification-rules.spec.ts` - E2E tests

**Modified:**
- `app/lib/services/audit-log.ts` - Fixed non-async export for Server Actions compliance
