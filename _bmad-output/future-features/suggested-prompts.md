# Future Feature: Suggested Prompts

**Status:** Deferred to Phase 4
**Created:** 2025-12-25
**Rationale:** Requires stable conversation analysis infrastructure from Phase 3

---

## Overview

The Suggested Prompts feature provides AI-powered prompt recommendations to help users improve their context engineering skills. There are two distinct capabilities:

1. **Proactive Next Prompt** — Suggest what the user should prompt next based on conversation context
2. **Retrospective Improvement** — Show how a submitted prompt could have been better

---

## Feature 1: Proactive Next Prompt Suggestions

### Description

After the LLM responds, Contextor analyzes the conversation context and suggests what the user's next prompt should include. This helps users:
- Remember to provide necessary context
- Structure their requests effectively
- Avoid common mistakes

### User Flow

1. User sends prompt → LLM responds
2. Contextor captures both prompt and response
3. Analysis generates suggested next prompt
4. Suggestion appears in VS Code extension (or web UI)
5. User can copy suggestion (with placeholders to fill)

### Technical Requirements

**Input for Generation:**
- Full conversation history
- Last LLM response
- Project context files (CLAUDE.md, etc.) — future enhancement

**Output Format:**
```
Suggested next prompt:

Based on the response, consider providing:
- [Specific file paths that might be relevant]
- [Error messages if debugging]
- [Requirements clarification if needed]

Template:
"I need to [ACTION]. The relevant files are [FILE_PATHS].
The expected behavior is [EXPECTED] but I'm seeing [ACTUAL]."
```

### Configurable Options

| Setting | Options | Default |
|---------|---------|---------|
| Auto-suggest | On / Off | Off |
| Trigger | After every response / On-demand button | On-demand |
| Detail level | Brief / Detailed | Brief |

### UI Placement (VS Code Extension)

**Option A: Dedicated Panel Tab**
- New tab alongside Analytics, Sessions, Import
- Shows current suggestion with copy button
- History of recent suggestions

**Option B: Floating Widget (Optional)**
- Small overlay near terminal
- Expandable on hover/click
- Quick copy action

**Mandatory: Copy to Clipboard**
- One-click copy suggested prompt
- Optional: Edit before copying

---

## Feature 2: Retrospective Improvement Suggestions

### Description

After analyzing a submitted prompt, show the user how it could have been improved. This helps users learn from their actual prompting patterns.

### User Flow

1. User sends prompt
2. Contextor analyzes prompt in conversation context
3. Score + dimensions displayed (existing functionality)
4. **NEW:** "Improved version" displayed with explanation
5. User learns what to do differently next time

### Output Format

```
Your prompt scored 65/100

Suggested improvement:

Original: "fix the bug"

Improved: "Fix the TypeError on line 42 of src/components/UserList.tsx.
The error occurs when mapping over an undefined users array.
Expected: component renders user list. Actual: crashes on mount."

What changed:
- Added specific error type and location
- Included expected vs actual behavior
- Provided file path for context
```

### Analysis Dimensions for Suggestions

| Dimension | Improvement Strategy |
|-----------|---------------------|
| Low Specificity | Add concrete details (file paths, line numbers) |
| Missing Context | Reference prior conversation or provide background |
| Vague Goal | Clarify expected outcome |
| No Constraints | Add boundaries (tech stack, approach preferences) |
| Repetition | Acknowledge what LLM already knows |

---

## Technical Architecture

### Analysis Pipeline

```
Prompt Captured
    ↓
Conversation Context Retrieved (Phase 3)
    ↓
Prompt Classified (Phase 3)
    ↓
[If enabled] Generate Improvement Suggestion
    ↓
[If enabled] Generate Next Prompt Suggestion
    ↓
Store suggestions in `prompt_suggestions` table
    ↓
Display in VS Code / Web UI
```

### Database Schema (Future)

```sql
CREATE TABLE prompt_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES prompts(id) NOT NULL,

  suggestion_type VARCHAR(50) NOT NULL,  -- 'improvement', 'next_prompt'

  -- Improvement suggestion
  improved_prompt TEXT,
  improvement_explanation TEXT,

  -- Next prompt suggestion
  next_prompt_template TEXT,
  placeholders JSONB,  -- [{name: "file_path", description: "..."}]

  -- Metadata
  model_used VARCHAR(100),
  token_cost INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints (Future)

```
POST /api/suggestions/generate
  - prompt_id: UUID
  - type: 'improvement' | 'next_prompt'

GET /api/prompts/:id/suggestions
  - Returns all suggestions for a prompt

POST /api/suggestions/:id/copy
  - Tracks that user copied this suggestion
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Suggestion adoption rate | 30%+ | Copied suggestions / offered |
| User satisfaction | 4+/5 | Post-use survey |
| Prompt quality improvement | +20% | Score delta after using suggestions |
| Feature retention | 50%+ | Users who keep feature enabled |

---

## Implementation Dependencies

### Required from Phase 3

- [ ] Conversation data architecture (Epic 23)
- [ ] Full response capture (Epic 24)
- [ ] Prompt classification (Epic 26)
- [ ] Context-aware analysis (Epic 26)

### Additional Requirements

- [ ] Suggestion generation LLM prompt design
- [ ] VS Code extension UI updates
- [ ] Web UI integration
- [ ] Cost tracking and limits

---

## Cost Considerations

Each suggestion requires an LLM call with conversation context. Estimated costs:

| Scenario | Context Size | Est. Cost |
|----------|--------------|-----------|
| Short conversation (10 messages) | ~5K tokens | $0.01-0.02 |
| Medium conversation (50 messages) | ~25K tokens | $0.05-0.10 |
| Long conversation (200 messages) | ~100K tokens | $0.20-0.40 |

**Mitigation Strategies:**
- On-demand only by default (no auto-suggest)
- Configurable context window limit
- Caching for repeated requests
- Usage limits per user/team

---

## Open Questions

1. **Placeholder format:** How should users fill in placeholders?
   - Option A: `[PLACEHOLDER]` markers
   - Option B: Interactive form in VS Code
   - Option C: Inline editing with highlighting

2. **Suggestion timing:** How long should users wait for suggestions?
   - Target: < 3 seconds
   - If longer, show loading indicator

3. **Learning from feedback:** Should we track which suggestions users modify?
   - Could inform better suggestion generation
   - Privacy considerations

4. **Team-level customization:** Should teams be able to customize suggestion prompts?
   - Aligns with Epic 22 (Configurable Analysis Engine)
   - Adds complexity

---

## Phase 4 Epic Outline (Draft)

```
Epic 29: Suggested Prompts

├── Story 29.1: Suggestion Generation Service
│   └── LLM-based suggestion generation with context
│
├── Story 29.2: Improvement Suggestion UI (Web)
│   └── Display improved prompt with explanation
│
├── Story 29.3: Next Prompt Suggestion UI (VS Code)
│   └── Dedicated panel with copy functionality
│
├── Story 29.4: Suggestion Settings & Configuration
│   └── User preferences, limits, triggers
│
├── Story 29.5: Floating Widget (VS Code) [Optional]
│   └── Real-time suggestion overlay
│
└── Story 29.6: Suggestion Analytics
    └── Track adoption, satisfaction, improvement
```

---

## References

- [Anthropic Context Engineering Guide](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Claude Best Practices](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices)
- Phase 3 PRD: Context-Aware Analysis Engine (Epic 26)
