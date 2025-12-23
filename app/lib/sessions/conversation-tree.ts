/**
 * Conversation Tree - Story 16-4: Conversation Threading
 *
 * Builds conversation tree structures from flat prompt lists.
 * Supports both threaded (parent-child) and linear (sequence-based) conversations.
 */

import { createScopedLogger } from "@/lib/utils/logger";
import type { PromptWithAnalysis } from "@/lib/types/prompt";

const logger = createScopedLogger("TREE");

/**
 * A prompt with threading information for tree display
 */
export interface ThreadedPrompt {
  /** Database prompt ID */
  id: string;
  /** Prompt text */
  text: string;
  /** Position within the session (1-indexed) */
  sequence_number: number;
  /** Parent prompt ID (null for roots) */
  parent_prompt_id: string | null;
  /** Depth level in the tree (0 for roots) */
  depth: number;
  /** Child prompts in this thread */
  children: ThreadedPrompt[];
  /** When the prompt was created */
  created_at: string;
  /** Analysis data if available */
  analysis?: {
    overall_score: number;
    categories: Record<string, number>;
  };
}

/**
 * Conversation tree structure
 */
export interface ConversationTree {
  /** Root-level prompts (no parent or orphaned) */
  roots: ThreadedPrompt[];
  /** Type of tree structure */
  type: "threaded" | "linear";
  /** Total number of prompts in the tree */
  totalPrompts: number;
  /** Maximum depth in the tree */
  maxDepth: number;
}

/**
 * Prompt row from database (partial for tree building)
 */
export interface PromptRow {
  id: string;
  text: string;
  sequence_number: number | null;
  parent_prompt_id: string | null;
  created_at: string;
  analysis?: {
    overall_score: number;
    dimension_scores: Record<string, number>;
  } | null;
}

/**
 * Build a conversation tree from a flat list of prompts.
 *
 * Automatically detects whether to use threaded or linear structure
 * based on the presence of parent-child relationships.
 *
 * @param prompts - Flat array of prompt rows from database
 * @returns Structured conversation tree
 *
 * @example
 * const prompts = await fetchSessionPrompts(sessionId);
 * const tree = buildConversationTree(prompts);
 *
 * if (tree.type === 'threaded') {
 *   // Render with indentation based on depth
 * } else {
 *   // Render as flat list
 * }
 */
export function buildConversationTree(prompts: PromptRow[]): ConversationTree {
  if (prompts.length === 0) {
    return {
      roots: [],
      type: "linear",
      totalPrompts: 0,
      maxDepth: 0,
    };
  }

  // Check if any prompts have parent references
  const hasParentRelationships = prompts.some((p) => p.parent_prompt_id !== null);

  if (hasParentRelationships) {
    return buildThreadedTree(prompts);
  } else {
    return buildLinearTree(prompts);
  }
}

/**
 * Convert a prompt row to a threaded prompt node
 */
function promptToNode(prompt: PromptRow, depth: number): ThreadedPrompt {
  const node: ThreadedPrompt = {
    id: prompt.id,
    text: prompt.text,
    sequence_number: prompt.sequence_number ?? 0,
    parent_prompt_id: prompt.parent_prompt_id,
    depth,
    children: [],
    created_at: prompt.created_at,
  };

  // Map analysis if available
  if (prompt.analysis) {
    node.analysis = {
      overall_score: prompt.analysis.overall_score,
      categories: prompt.analysis.dimension_scores,
    };
  }

  return node;
}

/**
 * Build a linear tree (fallback when no threading info).
 *
 * All prompts are treated as roots, sorted by sequence_number or created_at.
 *
 * @param prompts - Flat array of prompt rows
 * @returns Linear conversation tree
 */
function buildLinearTree(prompts: PromptRow[]): ConversationTree {
  // Sort by sequence_number (if available) or created_at
  const sorted = [...prompts].sort((a, b) => {
    // Prefer sequence_number if both have it
    if (a.sequence_number !== null && b.sequence_number !== null) {
      return a.sequence_number - b.sequence_number;
    }
    // Fall back to created_at
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const roots = sorted.map((p) => promptToNode(p, 0));

  return {
    roots,
    type: "linear",
    totalPrompts: prompts.length,
    maxDepth: 0,
  };
}

/**
 * Build a threaded tree with parent-child relationships.
 *
 * Handles:
 * - Proper parent-child linking
 * - Orphaned prompts (parent not found) treated as roots
 * - Cycle detection (breaks cycles, treats as roots)
 * - Sorting children by sequence_number at each level
 *
 * @param prompts - Flat array of prompt rows with parent references
 * @returns Threaded conversation tree
 */
function buildThreadedTree(prompts: PromptRow[]): ConversationTree {
  // Create lookup map by ID
  const promptById = new Map<string, PromptRow>();
  for (const prompt of prompts) {
    promptById.set(prompt.id, prompt);
  }

  // Create nodes and track parent relationships
  const nodeById = new Map<string, ThreadedPrompt>();
  const childrenByParent = new Map<string, ThreadedPrompt[]>();
  const rootNodes: ThreadedPrompt[] = [];

  // First pass: create all nodes with depth 0 initially
  for (const prompt of prompts) {
    const node = promptToNode(prompt, 0);
    nodeById.set(prompt.id, node);
  }

  // Second pass: build parent-child relationships and detect orphans
  const visited = new Set<string>();
  const inStack = new Set<string>();

  /**
   * Detect if adding this node would create a cycle
   */
  function wouldCreateCycle(nodeId: string, parentId: string | null): boolean {
    if (parentId === null) return false;
    if (parentId === nodeId) return true;

    let current: string | null = parentId;
    const seen = new Set<string>();

    while (current !== null) {
      if (seen.has(current) || current === nodeId) {
        return true;
      }
      seen.add(current);

      const parentNode = promptById.get(current);
      current = parentNode?.parent_prompt_id ?? null;
    }

    return false;
  }

  // Identify roots and build children lists
  for (const prompt of prompts) {
    const node = nodeById.get(prompt.id)!;
    const parentId = prompt.parent_prompt_id;

    if (parentId === null) {
      // No parent - this is a root
      rootNodes.push(node);
    } else if (!promptById.has(parentId)) {
      // Parent not in our dataset - orphan, treat as root
      logger.debug("Orphaned prompt (parent not found)", {
        promptId: prompt.id,
        parentId,
      });
      rootNodes.push(node);
    } else if (wouldCreateCycle(prompt.id, parentId)) {
      // Would create a cycle - treat as root
      logger.warn("Cycle detected in conversation tree", {
        promptId: prompt.id,
        parentId,
      });
      rootNodes.push(node);
    } else {
      // Valid parent - add to parent's children list
      const children = childrenByParent.get(parentId) || [];
      children.push(node);
      childrenByParent.set(parentId, children);
    }
  }

  // Third pass: calculate depths and assign children
  let maxDepth = 0;

  function assignChildrenAndDepth(node: ThreadedPrompt, depth: number): void {
    node.depth = depth;
    maxDepth = Math.max(maxDepth, depth);

    const children = childrenByParent.get(node.id) || [];

    // Sort children by sequence_number
    children.sort((a, b) => {
      if (a.sequence_number !== 0 && b.sequence_number !== 0) {
        return a.sequence_number - b.sequence_number;
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    node.children = children;

    // Recursively process children
    for (const child of children) {
      assignChildrenAndDepth(child, depth + 1);
    }
  }

  // Sort roots by sequence_number
  rootNodes.sort((a, b) => {
    if (a.sequence_number !== 0 && b.sequence_number !== 0) {
      return a.sequence_number - b.sequence_number;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // Process from roots
  for (const root of rootNodes) {
    assignChildrenAndDepth(root, 0);
  }

  return {
    roots: rootNodes,
    type: "threaded",
    totalPrompts: prompts.length,
    maxDepth,
  };
}

/**
 * Flatten a conversation tree back to a list (depth-first order).
 *
 * Useful for rendering in a flat UI with visual indentation.
 *
 * @param tree - The conversation tree to flatten
 * @returns Array of prompts in depth-first order
 *
 * @example
 * const tree = buildConversationTree(prompts);
 * const flat = flattenTree(tree);
 *
 * flat.forEach(p => {
 *   const indent = '  '.repeat(p.depth);
 *   console.log(`${indent}${p.text}`);
 * });
 */
export function flattenTree(tree: ConversationTree): ThreadedPrompt[] {
  const result: ThreadedPrompt[] = [];

  function traverse(node: ThreadedPrompt): void {
    result.push(node);
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const root of tree.roots) {
    traverse(root);
  }

  return result;
}

/**
 * Find a specific prompt in the tree by ID.
 *
 * @param tree - The conversation tree to search
 * @param promptId - The prompt ID to find
 * @returns The threaded prompt or null if not found
 */
export function findPromptInTree(
  tree: ConversationTree,
  promptId: string
): ThreadedPrompt | null {
  function search(nodes: ThreadedPrompt[]): ThreadedPrompt | null {
    for (const node of nodes) {
      if (node.id === promptId) {
        return node;
      }
      const found = search(node.children);
      if (found) return found;
    }
    return null;
  }

  return search(tree.roots);
}

/**
 * Get the path from a root to a specific prompt.
 *
 * @param tree - The conversation tree
 * @param promptId - The target prompt ID
 * @returns Array of prompt IDs from root to target, or null if not found
 */
export function getPromptPath(
  tree: ConversationTree,
  promptId: string
): string[] | null {
  function search(nodes: ThreadedPrompt[], path: string[]): string[] | null {
    for (const node of nodes) {
      const currentPath = [...path, node.id];
      if (node.id === promptId) {
        return currentPath;
      }
      const found = search(node.children, currentPath);
      if (found) return found;
    }
    return null;
  }

  return search(tree.roots, []);
}

/**
 * Count prompts at each depth level.
 *
 * @param tree - The conversation tree
 * @returns Map of depth -> count
 */
export function countByDepth(tree: ConversationTree): Map<number, number> {
  const counts = new Map<number, number>();

  function count(node: ThreadedPrompt): void {
    const current = counts.get(node.depth) || 0;
    counts.set(node.depth, current + 1);
    for (const child of node.children) {
      count(child);
    }
  }

  for (const root of tree.roots) {
    count(root);
  }

  return counts;
}
