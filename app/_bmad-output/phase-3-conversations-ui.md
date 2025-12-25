# Phase 3: Conversations UI - Design Complete

**Status:** UI Preview Complete (Mock Data)
**Date:** 2025-12-25
**Next:** Implementation with real database connections

## Overview

Created the Conversation Intelligence UI for browsing and analyzing Claude Code sessions. The UI is fully functional with hardcoded mock data, ready for database integration.

## Pages Created

### 1. Conversations List (`/conversations`)

**File:** `app/(dashboard)/conversations/page.tsx`
**Client Component:** `app/(dashboard)/conversations/ConversationsPageClient.tsx`

**Features:**
- Filter by project, stage, debugging loops
- Search by slug, project name, git branch
- Sort by date, message count, score
- Group by project
- Responsive grid layout (1/2/3 columns)

**Filters:**
- Project dropdown (All Projects, Unlinked, specific projects)
- Stage dropdown (Planning, Implementation, Debugging, etc.)
- Loop filter (All, With Loops, No Loops)
- Sort options (Newest, Most Messages, Highest Score)

### 2. Conversation Thread (`/conversations/[sessionId]`)

**File:** `app/(dashboard)/conversations/[sessionId]/page.tsx`
**Client Component:** `app/(dashboard)/conversations/[sessionId]/ConversationThreadClient.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ ← │ Session Title                          │ ← 1 of 5 →    │ ← Fixed header
├───────────────────────────────────┬─────────────────────────┤
│                                   │ Session Info            │
│   User Prompt        │ Analysis   │ - Date/time             │
│   [Full content]     │ [Scores]   │ - Duration              │
│                                   │ - Message count         │
│   Claude Response (collapsed)     │ - Claude Code version   │
│   [First 3 lines...]              │                         │
│   [Show more]                     │ Analysis                │
│                                   │ - Stage badge           │
│   User Prompt        │ Analysis   │ - Loop indicator        │
│   ...                │ ...        │ - Avg. score            │
│                                   │                         │
│   (Scrollable)                    │ Debugging Loop Warning  │
│                                   │ (if applicable)         │
│                                   │                         │
│                                   │ Score Breakdown         │
│                                   │ (Scrollable)            │
└───────────────────────────────────┴─────────────────────────┘
```

**Key Features:**
- Fixed header with back button, title, prompt navigation
- Two-column layout with independent scrolling
- User prompts: Side-by-side with analysis panel
- Assistant responses: Collapsed by default (3 lines), expandable
- Prompt navigation: Previous/Next arrows with "1 of 5" counter
- Right sidebar: Session metadata, analysis summary, debugging warnings

## Components Created/Modified

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| `ConversationsPageClient` | `app/(dashboard)/conversations/ConversationsPageClient.tsx` | List page with filters |
| `ConversationThreadClient` | `app/(dashboard)/conversations/[sessionId]/ConversationThreadClient.tsx` | Thread view with two-column layout |
| `DashboardMetrics` | `app/(dashboard)/home/DashboardMetrics.tsx` | Client wrapper for dashboard metrics |

### Modified Components

| Component | File | Changes |
|-----------|------|---------|
| `MessageBubble` | `components/conversations/MessageBubble.tsx` | Side-by-side layout for user prompts, collapsible assistant responses |
| `types.ts` | `components/conversations/types.ts` | Added missing stage types (planning, implementation, etc.) |

## Type Definitions

### ConversationSummary
```typescript
interface ConversationSummary {
  id: string;
  sessionId: string;
  slug: string;
  projectId: string | null;
  projectName: string | null;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  userMessageCount: number;
  totalMessages: number;
  primaryStage: ProjectStage | null;
  hasDebuggingLoop: boolean;
  conversationScore: number | null;
  gitBranch: string | null;
  cwd: string | null;
  claudeCodeVersion: string | null;
}
```

### ConversationMessage
```typescript
interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sequenceNumber: number;
  promptType?: PromptType;
  score?: number;
  detectedStage?: ProjectStage;
  isInDebuggingLoop?: boolean;
  metadata?: MessageMetadata;
  response?: ResponseData;
  analysis?: PromptAnalysis;
}
```

### ProjectStage (Extended)
```typescript
type ProjectStage =
  | "architecture" | "specification" | "development" | "debugging"
  | "enhancement" | "planning" | "implementation" | "testing"
  | "documentation" | "review" | "refactoring" | "exploration" | "unknown";
```

## Mock Data Structure

Mock data is based on real Claude Code transcript patterns:
- Long multi-paragraph prompts with PRD excerpts
- Build errors with stack traces
- Code snippets in markdown
- Brief confirmations (lower scores)
- Test failure outputs

See `app/(dashboard)/conversations/[sessionId]/page.tsx` for realistic mock data examples.

## Design Patterns Used

1. **Side-by-side prompt analysis** - User prompts display content on left, analysis on right
2. **Collapsible responses** - Assistant messages show 3 lines by default
3. **Fixed header with navigation** - Title stays visible, prompt navigation accessible
4. **Independent scroll areas** - Main content and sidebar scroll separately
5. **Color-coded dimension bars** - Green (≥8), Yellow (≥6), Orange (≥4), Red (<4)

## Implementation Requirements

### Database Tables Needed
- `sessions` - Session metadata (exists from Epic 16)
- `prompts` - User prompts with analysis (exists)
- `responses` - Claude responses (exists from Epic 15)

### API Endpoints Needed
- `GET /api/conversations` - List conversations with filters
- `GET /api/conversations/[sessionId]` - Get conversation with messages
- `GET /api/conversations/[sessionId]/messages` - Paginated messages

### Data Queries
1. List conversations for current user/team with filters
2. Get conversation summary by sessionId
3. Get messages for conversation ordered by sequence
4. Calculate aggregate stats (avg score, stage breakdown)

## Files to Connect to Database

| File | Current State | Implementation Needed |
|------|--------------|----------------------|
| `conversations/page.tsx` | Mock data | Fetch from `/api/conversations` |
| `conversations/[sessionId]/page.tsx` | Mock data | Fetch from `/api/conversations/[sessionId]` |

## Next Steps

1. Create API endpoints for conversations
2. Connect list page to database
3. Connect thread page to database
4. Add real-time updates (optional)
5. Add pagination for long conversations
