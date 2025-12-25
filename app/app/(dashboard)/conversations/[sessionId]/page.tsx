import { ConversationThreadClient } from "./ConversationThreadClient";
import type { ConversationMessage, ConversationSummary } from "@/components/conversations/types";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { sessionId } = await params;
  return {
    title: `Conversation | Contextor`,
    description: `View conversation ${sessionId}`,
  };
}

/**
 * Conversation Thread Page
 *
 * UI Preview with mock data - will be connected to database in implementation phase.
 */

// Mock conversation data based on real session
const MOCK_CONVERSATION: ConversationSummary = {
  id: "fc8c7e5f-b3e8-47b4-bf5a-f483cda2847d",
  sessionId: "fc8c7e5f-b3e8-47b4-bf5a-f483cda2847d",
  slug: "Epic 18: Session Recovery Implementation",
  projectId: "proj-1",
  projectName: "Contextor",
  userId: "user-1",
  startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  endedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  userMessageCount: 5,
  totalMessages: 10,
  primaryStage: "implementation",
  hasDebuggingLoop: true,
  conversationScore: 74,
  gitBranch: "feature/session-recovery",
  cwd: "/Users/edgars/My-projects/2025-projects/DEV/context-coach",
  claudeCodeVersion: "2.0.76",
};

// Mock messages based on real Claude Code conversations
const MOCK_MESSAGES: ConversationMessage[] = [
  {
    id: "msg-1",
    role: "user",
    content: `I want you to start development of Epic 18 (Session Recovery). Remember to use Playwright and Real Browser testing for everything that you implement before you involve end user. You're allowed to spin subagents. They should use Opus 4.5 model. If parallel execution of certain tasks is applicable, that's okay to do. Keep going until the Epic is complete and testing passes. Unless you need certain input from me. I'm waiting until you're done.

Here's the epic overview from the PRD:

## Epic 18: Session Recovery for Interrupted Claude Code Sessions

**Goal:** Enable developers to recover context from interrupted or crashed Claude Code sessions

### Stories:
- 18-1: Crash Detection Service
- 18-2: Session State Snapshot
- 18-3: Recovery Prompt Generator
- 18-4: Recovery Notification UI
- 18-5: One-Click Resume`,
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    sequenceNumber: 1,
    promptType: "initiating",
    score: 92,
    detectedStage: "planning",
    isInDebuggingLoop: false,
    metadata: {
      gitBranch: "main",
      model: "claude-opus-4-5-20251101",
      inputTokens: 850,
      outputTokens: 4200,
    },
    analysis: {
      overallScore: 92,
      dimensions: {
        clarity: 9.5,
        context: 9.2,
        specificity: 9.0,
        actionability: 9.3,
        efficiency: 9.0,
      },
      feedback: "Excellent prompt with clear scope, specific requirements, and autonomy guidelines.",
    },
  },
  {
    id: "msg-1-response",
    role: "assistant",
    content: `I'll start development of Epic 18 (Session Recovery). Let me first analyze the story dependencies and determine which can be parallelized.

## Epic 18 Analysis

### Dependency Graph
\`\`\`
18-1 (Crash Detection) ──┬──> 18-4 (Notification UI)
                         │
18-2 (State Snapshot) ───┼──> 18-3 (Recovery Prompt)
                         │
                         └──> 18-5 (One-Click Resume)
\`\`\`

### Parallelization Strategy

**Phase 1 (Parallel):**
- Story 18-1: Crash Detection Service
- Story 18-2: Session State Snapshot

**Phase 2 (After Phase 1):**
- Story 18-3: Recovery Prompt Generator (depends on 18-2)
- Story 18-4: Recovery Notification UI (depends on 18-1)

**Phase 3:**
- Story 18-5: One-Click Resume (depends on 18-3, 18-4)

I'll spawn 2 subagents for Phase 1 now, using Opus 4.5 as requested.`,
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000 + 45000).toISOString(),
    sequenceNumber: 1.5,
    response: {
      id: "resp-1",
      toolCount: 8,
      toolsUsed: ["Read", "Glob", "Grep", "Task", "Task", "TodoWrite"],
      model: "claude-opus-4-5-20251101",
      tokensIn: 850,
      tokensOut: 4200,
    },
  },
  {
    id: "msg-2",
    role: "user",
    content: `## Error Type
Build Error

## Error Message
Type error: Property 'sessions' does not exist on type 'Database'.

## Build Output
\`\`\`
./lib/sessions/crashDetector.ts:45:28
Type error: Property 'sessions' does not exist on type 'Database'.

  43 |   const supabase = createAdminClient();
  44 |
> 45 |   const { data } = await supabase.from('sessions').select('*');
     |                            ^
  46 |
  47 |   return data || [];
\`\`\`

The sessions table was added in Epic 16 but I think the TypeScript types weren't regenerated. Can you fix this?`,
    timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    sequenceNumber: 2,
    promptType: "continuation",
    score: 78,
    detectedStage: "debugging",
    isInDebuggingLoop: false,
    metadata: {
      gitBranch: "feature/session-recovery",
      model: "claude-opus-4-5-20251101",
      inputTokens: 320,
      outputTokens: 1850,
    },
    analysis: {
      overallScore: 78,
      dimensions: {
        clarity: 8.5,
        context: 7.5,
        specificity: 8.0,
        actionability: 7.8,
        efficiency: 7.2,
      },
      feedback: "Good error context with stack trace. Could include what was tried before.",
    },
  },
  {
    id: "msg-2-response",
    role: "assistant",
    content: `You're right - the Supabase TypeScript types need to be regenerated after adding the sessions table. Let me fix this:

\`\`\`bash
npx supabase gen types typescript --project-id ddskanjiobrjphscskog > lib/supabase/database.types.ts
\`\`\`

I'll run this now and then verify the types are correct.

The issue is that \`database.types.ts\` was generated before the Epic 16 migrations added the \`sessions\` table. After regenerating, you'll have proper typing for:
- \`sessions\` table
- \`session_id\`, \`user_id\`, \`team_id\` columns
- All the new columns from the migration`,
    timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000 + 30000).toISOString(),
    sequenceNumber: 2.5,
    response: {
      id: "resp-2",
      toolCount: 3,
      toolsUsed: ["Bash", "Read", "Edit"],
      model: "claude-opus-4-5-20251101",
      tokensIn: 320,
      tokensOut: 1850,
    },
  },
  {
    id: "msg-3",
    role: "user",
    content: `Looking at the CrashDetector implementation, I'm not sure how we detect a "crashed" session vs one that just ended normally. Here's the current code:

\`\`\`typescript
// lib/sessions/crashDetector.ts
export async function detectCrashedSessions(userId: string): Promise<Session[]> {
  const supabase = createAdminClient();

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .lt('updated_at', new Date(Date.now() - STALE_THRESHOLD).toISOString());

  return sessions || [];
}
\`\`\`

The problem is: what if the user just closed their terminal and went to lunch? That's not a crash. How do we differentiate?

Also, should we look at the transcript files in ~/.claude/projects/ to see if the session has any error indicators?`,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    sequenceNumber: 3,
    promptType: "clarification",
    score: 85,
    detectedStage: "implementation",
    isInDebuggingLoop: false,
    metadata: {
      gitBranch: "feature/session-recovery",
      model: "claude-opus-4-5-20251101",
      inputTokens: 480,
      outputTokens: 3200,
    },
    analysis: {
      overallScore: 85,
      dimensions: {
        clarity: 8.8,
        context: 8.5,
        specificity: 8.5,
        actionability: 8.2,
        efficiency: 8.5,
      },
      feedback: "Great question with code context and proposed solution direction.",
    },
  },
  {
    id: "msg-3-response",
    role: "assistant",
    content: `Excellent observation! You've identified a key UX challenge. Let me propose a more sophisticated detection strategy:

## Crash Detection Heuristics

### 1. Time-Based Indicators
- **Stale session**: No activity for 30+ minutes → Likely abandoned
- **Very short session**: < 2 minutes with no \`ended_at\` → Possible crash
- **Mid-conversation drop**: Last message was assistant (waiting for user) → Interrupted

### 2. Transcript Analysis
\`\`\`typescript
interface SessionHealthCheck {
  hasError: boolean;          // Contains error patterns in last messages
  lastMessageRole: 'user' | 'assistant';
  messageCount: number;
  hadToolFailures: boolean;   // Any tool execution failures
  abruptEnding: boolean;      // No natural conversation end
}

async function analyzeTranscript(sessionId: string): Promise<SessionHealthCheck> {
  const transcriptPath = \`~/.claude/projects/*/\${sessionId}.jsonl\`;
  // Parse JSONL and analyze patterns...
}
\`\`\`

### 3. Recommended UX
Instead of auto-detecting "crashes", we could:
1. Show **all recent interrupted sessions** (no \`ended_at\`)
2. Let user decide which to recover
3. Add visual indicators for likely crashes vs intentional abandonment

This avoids false positives while still surfacing recoverable sessions.

Want me to implement this more nuanced approach?`,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 60000).toISOString(),
    sequenceNumber: 3.5,
    response: {
      id: "resp-3",
      toolCount: 5,
      toolsUsed: ["Read", "Glob", "Grep", "Write", "Edit"],
      model: "claude-opus-4-5-20251101",
      tokensIn: 480,
      tokensOut: 3200,
    },
  },
  {
    id: "msg-4",
    role: "user",
    content: "Yes, implement that approach. The UX sounds better.",
    timestamp: new Date(Date.now() - 1.8 * 60 * 60 * 1000).toISOString(),
    sequenceNumber: 4,
    promptType: "confirmation",
    score: 45,
    detectedStage: "implementation",
    isInDebuggingLoop: false,
    metadata: {
      gitBranch: "feature/session-recovery",
      model: "claude-opus-4-5-20251101",
      inputTokens: 25,
      outputTokens: 2800,
    },
    analysis: {
      overallScore: 45,
      dimensions: {
        clarity: 6.0,
        context: 3.5,
        specificity: 4.0,
        actionability: 5.0,
        efficiency: 4.0,
      },
      feedback: "Very brief approval. Could specify which parts to prioritize or any constraints.",
    },
  },
  {
    id: "msg-4-response",
    role: "assistant",
    content: `I'll implement the nuanced crash detection approach. Creating the enhanced CrashDetector service now with transcript analysis capabilities.

## Implementation Plan

1. **TranscriptAnalyzer** - Parse JSONL, extract health indicators
2. **SessionHealthChecker** - Combine time + transcript signals
3. **RecoveryCandidate** type - Rich session info for UI
4. **Unit tests** - 34 test cases covering edge cases

Starting implementation...`,
    timestamp: new Date(Date.now() - 1.8 * 60 * 60 * 1000 + 15000).toISOString(),
    sequenceNumber: 4.5,
    response: {
      id: "resp-4",
      toolCount: 12,
      toolsUsed: ["Write", "Write", "Write", "Write", "Edit", "Edit", "Bash", "Read", "TodoWrite"],
      model: "claude-opus-4-5-20251101",
      tokensIn: 25,
      tokensOut: 2800,
    },
  },
  {
    id: "msg-5",
    role: "user",
    content: `Tests are failing. Here's the output:

\`\`\`
FAIL  lib/sessions/__tests__/crashDetector.test.ts
  CrashDetector
    ✓ should detect stale sessions (3 ms)
    ✓ should ignore recently active sessions (2 ms)
    ✕ should analyze transcript for error patterns (15 ms)
    ✕ should handle missing transcript files gracefully (8 ms)
    ✕ should detect abrupt endings (12 ms)

  ● CrashDetector › should analyze transcript for error patterns

    expect(received).toContain(expected)

    Expected substring: "error"
    Received string:    "Session appears healthy"

      45 |     const result = await analyzeTranscript(mockSessionId);
      46 |
    > 47 |     expect(result.healthStatus).toContain('error');
         |                                 ^
      48 |   });
\`\`\`

Looks like the error pattern matching isn't working. The mock transcript has error messages but they're not being detected.`,
    timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    sequenceNumber: 5,
    promptType: "continuation",
    score: 72,
    detectedStage: "debugging",
    isInDebuggingLoop: true,
    metadata: {
      gitBranch: "feature/session-recovery",
      model: "claude-opus-4-5-20251101",
      inputTokens: 520,
      outputTokens: 2100,
    },
    analysis: {
      overallScore: 72,
      dimensions: {
        clarity: 8.0,
        context: 7.5,
        specificity: 7.0,
        actionability: 7.0,
        efficiency: 6.5,
      },
      feedback: "Good test output. Include the mock transcript content and the regex patterns being used.",
    },
  },
  {
    id: "msg-5-response",
    role: "assistant",
    content: `I see the issue. Looking at the test file and the implementation...

The problem is in the error pattern regex. It's looking for \`/error:/i\` but the JSONL format wraps errors differently:

\`\`\`typescript
// Current (incorrect)
const ERROR_PATTERNS = [/error:/i, /failed:/i];

// Should be
const ERROR_PATTERNS = [
  /"is_error":\\s*true/,
  /Error:/i,
  /ENOENT|EACCES|EPERM/,
  /TypeError|ReferenceError|SyntaxError/,
];
\`\`\`

Fixing now and re-running tests...`,
    timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000 + 25000).toISOString(),
    sequenceNumber: 5.5,
    response: {
      id: "resp-5",
      toolCount: 4,
      toolsUsed: ["Read", "Edit", "Bash", "Bash"],
      model: "claude-opus-4-5-20251101",
      tokensIn: 520,
      tokensOut: 2100,
    },
  },
];

export default async function ConversationThreadPage({ params }: PageProps) {
  const { sessionId } = await params;

  // In implementation phase, fetch real data based on sessionId
  // For now, return mock data
  return (
    <ConversationThreadClient
      conversation={{ ...MOCK_CONVERSATION, sessionId }}
      messages={MOCK_MESSAGES}
    />
  );
}
