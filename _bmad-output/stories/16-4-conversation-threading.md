# Story 16.4: Conversation Threading

Status: ✅ COMPLETED (2025-12-23)

## PRD Alignment Note

PRD 16.4 is titled "Multi-Terminal Session Visualization" which describes UI functionality. The implementation splits this into two stories:

- **Story 16-4 (this story):** Handles the conversation threading **data layer** - parent-child relationships, sequence numbering, tree building algorithms, and the thread query API
- **Story 16-5 (Multi-Terminal Awareness):** Handles the **UI layer** for visualizing multi-terminal sessions and threaded conversations

This separation follows the principle of building data infrastructure before UI components.

## Story

**As a** user reviewing my prompts,
**I want** to see how prompts relate to each other within a session,
**So that** I can understand the flow of my conversations and how ideas developed.

## Dependencies

This story requires:
- Story 15-5: Prompt-Response Pairing (provides parentUuid from transcripts)
- Story 16-1: Sessions Database Schema (prompts.parent_prompt_id, prompts.sequence_number)
- Story 16-2: Session Detection Logic (session linking)
- Story 16-3: Session Metadata Capture (session context for thread building)

## Acceptance Criteria

**AC 1: Parent-Child Relationship Capture**
- **Given** a transcript message with `parentUuid`
- **When** the prompt is stored
- **Then** `parent_prompt_id` is set to the matching prompt's UUID
- **And** orphaned messages (no matching parent) are treated as roots

**AC 2: Sequence Number Assignment**
- **Given** prompts are added to a session
- **When** each prompt is stored
- **Then** `sequence_number` reflects the order within the session (1, 2, 3...)
- **And** sequence numbers are unique within a session

**AC 3: Conversation Tree Building**
- **Given** a session's prompts with parent relationships
- **When** the tree is built
- **Then** root prompts (no parent) are identified
- **And** child prompts are nested under their parents
- **And** the tree structure matches the original conversation flow

**AC 4: Thread Query API**
- **Given** a session ID
- **When** the thread API is called
- **Then** prompts are returned in threaded format
- **And** the response includes depth level for UI rendering

**AC 5: Linear Conversation Fallback**
- **Given** prompts without parent information
- **When** the thread is built
- **Then** prompts are ordered by sequence_number
- **And** the conversation is presented as a flat list

## Tasks / Subtasks

- [ ] **Task 1: Implement parent UUID resolution** (AC: #1)
  - [ ] Create `lib/sessions/thread-linking.ts`
  - [ ] Implement `resolveParentPrompt(parentUuid: string, sessionUuid: string): Promise<string | null>`
  - [ ] Store Claude's `parentUuid` in prompt metadata for reference
  - [ ] Handle orphaned messages gracefully

- [ ] **Task 2: Implement sequence number assignment** (AC: #2)
  - [ ] Create atomic sequence number generator
  - [ ] Use database function for thread-safe increment
  - [ ] Handle gaps in sequence numbers (from failed inserts)

- [ ] **Task 3: Build conversation tree algorithm** (AC: #3)
  - [ ] Create `lib/sessions/conversation-tree.ts`
  - [ ] Implement `buildConversationTree(prompts: Prompt[]): TreeNode[]`
  - [ ] Handle cycles gracefully (shouldn't occur but be defensive)
  - [ ] Compute depth for each node

- [ ] **Task 4: Create thread query service** (AC: #4)
  - [ ] Create `lib/sessions/thread-query.ts`
  - [ ] Implement `getSessionThread(sessionUuid: string): Promise<ThreadedPrompt[]>`
  - [ ] Return prompts with depth and children arrays
  - [ ] Optimize query for single database round-trip

- [ ] **Task 5: Handle linear fallback** (AC: #5)
  - [ ] Detect when no parent relationships exist
  - [ ] Fall back to sequence_number ordering
  - [ ] Mark thread type in response (threaded vs linear)

- [ ] **Task 6: Create thread API endpoint** (AC: #4)
  - [ ] Create `app/api/sessions/[sessionId]/thread/route.ts`
  - [ ] Validate user access to session
  - [ ] Return threaded conversation data

- [ ] **Task 7: Add comprehensive tests** (AC: #1-5)
  - [ ] Test parent resolution with various scenarios
  - [ ] Test tree building with branching conversations
  - [ ] Test linear fallback
  - [ ] Test API endpoint access control

## Dev Notes

### Claude Code Transcript Threading

Claude Code transcripts include threading information:

```json
{
  "type": "user",
  "uuid": "msg_001",
  "parentUuid": null,
  "message": { "content": "Let's build an auth system" }
}
{
  "type": "assistant",
  "uuid": "msg_002",
  "parentUuid": "msg_001",
  "message": { "content": "I'll help with that..." }
}
{
  "type": "user",
  "uuid": "msg_003",
  "parentUuid": "msg_002",
  "message": { "content": "Great, let's start with login" }
}
```

We need to map `parentUuid` -> `parent_prompt_id` (our internal UUID).

### Thread Linking Service

```typescript
// lib/sessions/thread-linking.ts

import { createAdminClient } from '@/lib/supabase/admin';

// Cache for UUID mapping within a session import
const uuidCache = new Map<string, string>();

/**
 * Resolve a Claude transcript UUID to our internal prompt ID.
 * Uses caching for efficient batch processing.
 */
export async function resolveParentPrompt(
  claudeUuid: string,
  sessionUuid: string
): Promise<string | null> {
  // Check cache first
  const cacheKey = `${sessionUuid}:${claudeUuid}`;
  if (uuidCache.has(cacheKey)) {
    return uuidCache.get(cacheKey) ?? null;
  }

  const supabase = createAdminClient();

  // Look up prompt by claude_uuid in metadata
  const { data, error } = await supabase
    .from('prompts')
    .select('id')
    .eq('session_uuid', sessionUuid)
    .contains('metadata', { claude_uuid: claudeUuid })
    .single();

  if (error || !data) {
    // Parent not found - might be assistant message or orphaned
    return null;
  }

  uuidCache.set(cacheKey, data.id);
  return data.id;
}

/**
 * Clear the UUID cache (call between session imports).
 */
export function clearUuidCache(): void {
  uuidCache.clear();
}

/**
 * Batch resolve multiple parent UUIDs.
 * More efficient than individual lookups.
 */
export async function batchResolveParents(
  mappings: Array<{ claudeUuid: string; sessionUuid: string }>
): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const result = new Map<string, string>();

  // Group by session for efficient queries
  const bySession = new Map<string, string[]>();
  for (const { claudeUuid, sessionUuid } of mappings) {
    const list = bySession.get(sessionUuid) ?? [];
    list.push(claudeUuid);
    bySession.set(sessionUuid, list);
  }

  for (const [sessionUuid, claudeUuids] of bySession) {
    const { data, error } = await supabase
      .from('prompts')
      .select('id, metadata')
      .eq('session_uuid', sessionUuid)
      .not('metadata', 'is', null);

    if (error || !data) continue;

    for (const prompt of data) {
      const claudeUuid = (prompt.metadata as { claude_uuid?: string })?.claude_uuid;
      if (claudeUuid && claudeUuids.includes(claudeUuid)) {
        result.set(`${sessionUuid}:${claudeUuid}`, prompt.id);
      }
    }
  }

  return result;
}
```

### Conversation Tree Algorithm

```typescript
// lib/sessions/conversation-tree.ts

export interface ThreadedPrompt {
  id: string;
  text: string;
  sequence_number: number;
  parent_prompt_id: string | null;
  depth: number;
  children: ThreadedPrompt[];
  created_at: string;
  // Include analysis data for UI
  analysis?: {
    overall_score: number;
    categories: Record<string, number>;
  };
}

export interface ConversationTree {
  roots: ThreadedPrompt[];
  type: 'threaded' | 'linear';
  totalPrompts: number;
  maxDepth: number;
}

interface PromptRow {
  id: string;
  text: string;
  sequence_number: number | null;
  parent_prompt_id: string | null;
  created_at: string;
  analysis?: unknown;
}

/**
 * Build a conversation tree from flat prompt list.
 * Handles orphaned messages and cycles.
 */
export function buildConversationTree(
  prompts: PromptRow[]
): ConversationTree {
  if (prompts.length === 0) {
    return { roots: [], type: 'linear', totalPrompts: 0, maxDepth: 0 };
  }

  // Check if we have threading info
  const hasThreading = prompts.some((p) => p.parent_prompt_id !== null);

  if (!hasThreading) {
    // Fall back to linear ordering
    return buildLinearTree(prompts);
  }

  return buildThreadedTree(prompts);
}

function buildLinearTree(prompts: PromptRow[]): ConversationTree {
  const sorted = [...prompts].sort((a, b) => {
    // Sort by sequence_number, then by created_at
    if (a.sequence_number !== null && b.sequence_number !== null) {
      return a.sequence_number - b.sequence_number;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const roots: ThreadedPrompt[] = sorted.map((prompt, index) => ({
    id: prompt.id,
    text: prompt.text,
    sequence_number: prompt.sequence_number ?? index + 1,
    parent_prompt_id: null,
    depth: 0,
    children: [],
    created_at: prompt.created_at,
    analysis: prompt.analysis as ThreadedPrompt['analysis'],
  }));

  return {
    roots,
    type: 'linear',
    totalPrompts: prompts.length,
    maxDepth: 0,
  };
}

function buildThreadedTree(prompts: PromptRow[]): ConversationTree {
  const byId = new Map<string, ThreadedPrompt>();
  const processed = new Set<string>();

  // First pass: create nodes
  for (const prompt of prompts) {
    byId.set(prompt.id, {
      id: prompt.id,
      text: prompt.text,
      sequence_number: prompt.sequence_number ?? 0,
      parent_prompt_id: prompt.parent_prompt_id,
      depth: 0,
      children: [],
      created_at: prompt.created_at,
      analysis: prompt.analysis as ThreadedPrompt['analysis'],
    });
  }

  // Second pass: build tree
  const roots: ThreadedPrompt[] = [];

  for (const node of byId.values()) {
    if (processed.has(node.id)) continue;

    if (node.parent_prompt_id === null) {
      // Root node
      roots.push(node);
      computeDepth(node, 0, byId, processed);
    } else {
      const parent = byId.get(node.parent_prompt_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphaned - treat as root
        roots.push(node);
        computeDepth(node, 0, byId, processed);
      }
    }
  }

  // Sort roots by sequence number
  roots.sort((a, b) => a.sequence_number - b.sequence_number);

  // Sort children at each level
  const sortChildren = (node: ThreadedPrompt) => {
    node.children.sort((a, b) => a.sequence_number - b.sequence_number);
    node.children.forEach(sortChildren);
  };
  roots.forEach(sortChildren);

  // Compute max depth
  let maxDepth = 0;
  const findMaxDepth = (node: ThreadedPrompt) => {
    maxDepth = Math.max(maxDepth, node.depth);
    node.children.forEach(findMaxDepth);
  };
  roots.forEach(findMaxDepth);

  return {
    roots,
    type: 'threaded',
    totalPrompts: prompts.length,
    maxDepth,
  };
}

function computeDepth(
  node: ThreadedPrompt,
  depth: number,
  byId: Map<string, ThreadedPrompt>,
  processed: Set<string>
): void {
  if (processed.has(node.id)) {
    // Cycle detection - shouldn't happen but handle gracefully
    console.warn(`[ConversationTree] Cycle detected at node ${node.id}`);
    return;
  }

  processed.add(node.id);
  node.depth = depth;

  // Find and process children
  for (const potentialChild of byId.values()) {
    if (potentialChild.parent_prompt_id === node.id && !processed.has(potentialChild.id)) {
      node.children.push(potentialChild);
      computeDepth(potentialChild, depth + 1, byId, processed);
    }
  }
}
```

### Thread Query Service

```typescript
// lib/sessions/thread-query.ts

import { createServerClient } from '@/lib/supabase/server';
import { buildConversationTree, ConversationTree } from './conversation-tree';

/**
 * Get session prompts as a threaded conversation.
 */
export async function getSessionThread(
  sessionUuid: string
): Promise<ConversationTree> {
  const supabase = await createServerClient();

  const { data: prompts, error } = await supabase
    .from('prompts')
    .select(`
      id,
      text,
      sequence_number,
      parent_prompt_id,
      created_at,
      prompt_analysis (
        overall_score,
        clarity_score,
        specificity_score,
        context_score,
        actionability_score,
        completeness_score
      )
    `)
    .eq('session_uuid', sessionUuid)
    .order('sequence_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch session prompts: ${error.message}`);
  }

  if (!prompts || prompts.length === 0) {
    return {
      roots: [],
      type: 'linear',
      totalPrompts: 0,
      maxDepth: 0,
    };
  }

  // Transform analysis data
  const transformedPrompts = prompts.map((p) => ({
    id: p.id,
    text: p.text,
    sequence_number: p.sequence_number,
    parent_prompt_id: p.parent_prompt_id,
    created_at: p.created_at,
    analysis: p.prompt_analysis?.[0]
      ? {
          overall_score: p.prompt_analysis[0].overall_score,
          categories: {
            clarity: p.prompt_analysis[0].clarity_score,
            specificity: p.prompt_analysis[0].specificity_score,
            context: p.prompt_analysis[0].context_score,
            actionability: p.prompt_analysis[0].actionability_score,
            completeness: p.prompt_analysis[0].completeness_score,
          },
        }
      : undefined,
  }));

  return buildConversationTree(transformedPrompts);
}

/**
 * Get linear thread (no nesting) for simple display.
 */
export async function getSessionLinearThread(
  sessionUuid: string
): Promise<{
  prompts: Array<{
    id: string;
    text: string;
    sequence_number: number;
    created_at: string;
  }>;
  totalPrompts: number;
}> {
  const supabase = await createServerClient();

  const { data: prompts, error } = await supabase
    .from('prompts')
    .select('id, text, sequence_number, created_at')
    .eq('session_uuid', sessionUuid)
    .order('sequence_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch session prompts: ${error.message}`);
  }

  return {
    prompts: prompts ?? [],
    totalPrompts: prompts?.length ?? 0,
  };
}
```

### Thread API Endpoint

```typescript
// app/api/sessions/[sessionId]/thread/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getSessionThread } from '@/lib/sessions/thread-query';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const supabase = await createServerClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    );
  }

  // Verify user has access to this session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, team_id')
    .eq('id', params.sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Session not found' } },
      { status: 404 }
    );
  }

  // Verify team membership
  const { data: membership, error: memberError } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', session.team_id)
    .eq('user_id', user.id)
    .single();

  if (memberError || !membership) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Not a team member' } },
      { status: 403 }
    );
  }

  try {
    const thread = await getSessionThread(params.sessionId);
    return NextResponse.json({ data: thread });
  } catch (error) {
    console.error('[API] session thread error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch thread' } },
      { status: 500 }
    );
  }
}
```

### Prompt Metadata Schema Update

Store Claude's UUID for parent resolution:

```typescript
// Update prompt metadata to include claude_uuid
interface PromptMetadata {
  source?: 'claude-code-hook' | 'bmad-agent' | 'api' | 'import';
  session_id?: string;
  claude_uuid?: string;      // Claude's message UUID
  claude_parent_uuid?: string; // Claude's parent UUID (for resolution)
  // ... other fields
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Thread Linking | `app/lib/sessions/thread-linking.ts` |
| Conversation Tree | `app/lib/sessions/conversation-tree.ts` |
| Thread Query | `app/lib/sessions/thread-query.ts` |
| Thread API | `app/app/api/sessions/[sessionId]/thread/route.ts` |

### UI Rendering Considerations

The `depth` field enables proper indentation in the UI:

```tsx
// Example thread rendering
function ThreadNode({ node }: { node: ThreadedPrompt }) {
  return (
    <div style={{ marginLeft: `${node.depth * 24}px` }}>
      <PromptCard prompt={node} />
      {node.children.map((child) => (
        <ThreadNode key={child.id} node={child} />
      ))}
    </div>
  );
}
```

### Testing Guidance

**Tree Building Tests:**
```typescript
describe('buildConversationTree', () => {
  it('builds tree with parent-child relationships', () => {
    const prompts = [
      { id: '1', text: 'root', sequence_number: 1, parent_prompt_id: null },
      { id: '2', text: 'child', sequence_number: 2, parent_prompt_id: '1' },
      { id: '3', text: 'grandchild', sequence_number: 3, parent_prompt_id: '2' },
    ];

    const tree = buildConversationTree(prompts);

    expect(tree.type).toBe('threaded');
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children).toHaveLength(1);
    expect(tree.maxDepth).toBe(2);
  });

  it('handles orphaned messages as roots', () => {
    const prompts = [
      { id: '1', text: 'root', sequence_number: 1, parent_prompt_id: null },
      { id: '2', text: 'orphan', sequence_number: 2, parent_prompt_id: 'missing' },
    ];

    const tree = buildConversationTree(prompts);

    expect(tree.roots).toHaveLength(2);
  });

  it('falls back to linear for no threading', () => {
    const prompts = [
      { id: '1', text: 'first', sequence_number: 1, parent_prompt_id: null },
      { id: '2', text: 'second', sequence_number: 2, parent_prompt_id: null },
    ];

    const tree = buildConversationTree(prompts);

    expect(tree.type).toBe('linear');
  });
});
```

### Common Pitfalls to Avoid

1. **DO NOT** assume parentUuid always resolves - handle orphans gracefully
2. **DO NOT** skip cycle detection - defensive coding prevents infinite loops
3. **DO NOT** forget to sort children by sequence number - order matters
4. **DO NOT** load all prompts for large sessions - consider pagination
5. **DO NOT** forget RLS checks on the thread API - verify team membership

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
