/**
 * Conversation Tree Tests - Story 16-4: Conversation Threading
 */

import { describe, it, expect } from "vitest";
import {
  buildConversationTree,
  flattenTree,
  findPromptInTree,
  getPromptPath,
  countByDepth,
  type PromptRow,
} from "../conversation-tree";

/**
 * Helper to create a prompt row for testing
 */
function createPromptRow(
  id: string,
  sequence: number | null = null,
  parentId: string | null = null,
  text: string = `Prompt ${id}`
): PromptRow {
  return {
    id,
    text,
    sequence_number: sequence,
    parent_prompt_id: parentId,
    created_at: new Date(2025, 0, 15, 10, 0, (sequence || 0) * 10).toISOString(),
    analysis: null,
  };
}

describe("buildConversationTree", () => {
  describe("empty input", () => {
    it("should return empty tree for empty array", () => {
      const tree = buildConversationTree([]);

      expect(tree.roots).toHaveLength(0);
      expect(tree.type).toBe("linear");
      expect(tree.totalPrompts).toBe(0);
      expect(tree.maxDepth).toBe(0);
    });
  });

  describe("linear tree (no parent relationships)", () => {
    it("should build linear tree when no parent_prompt_id values", () => {
      const prompts: PromptRow[] = [
        createPromptRow("p1", 1),
        createPromptRow("p2", 2),
        createPromptRow("p3", 3),
      ];

      const tree = buildConversationTree(prompts);

      expect(tree.type).toBe("linear");
      expect(tree.totalPrompts).toBe(3);
      expect(tree.maxDepth).toBe(0);
      expect(tree.roots).toHaveLength(3);
    });

    it("should sort by sequence_number", () => {
      const prompts: PromptRow[] = [
        createPromptRow("p3", 3),
        createPromptRow("p1", 1),
        createPromptRow("p2", 2),
      ];

      const tree = buildConversationTree(prompts);

      expect(tree.roots[0]?.id).toBe("p1");
      expect(tree.roots[1]?.id).toBe("p2");
      expect(tree.roots[2]?.id).toBe("p3");
    });

    it("should sort by created_at when sequence_number is null", () => {
      const prompts: PromptRow[] = [
        {
          id: "p2",
          text: "Second",
          sequence_number: null,
          parent_prompt_id: null,
          created_at: "2025-01-15T10:01:00Z",
          analysis: null,
        },
        {
          id: "p1",
          text: "First",
          sequence_number: null,
          parent_prompt_id: null,
          created_at: "2025-01-15T10:00:00Z",
          analysis: null,
        },
      ];

      const tree = buildConversationTree(prompts);

      expect(tree.roots[0]?.id).toBe("p1");
      expect(tree.roots[1]?.id).toBe("p2");
    });

    it("should set depth to 0 for all prompts in linear tree", () => {
      const prompts: PromptRow[] = [
        createPromptRow("p1", 1),
        createPromptRow("p2", 2),
      ];

      const tree = buildConversationTree(prompts);

      expect(tree.roots.every((r) => r.depth === 0)).toBe(true);
      expect(tree.roots.every((r) => r.children.length === 0)).toBe(true);
    });
  });

  describe("threaded tree (with parent relationships)", () => {
    it("should build threaded tree with parent-child relationships", () => {
      const prompts: PromptRow[] = [
        createPromptRow("p1", 1, null),
        createPromptRow("p2", 2, "p1"),
        createPromptRow("p3", 3, "p1"),
      ];

      const tree = buildConversationTree(prompts);

      expect(tree.type).toBe("threaded");
      expect(tree.totalPrompts).toBe(3);
      expect(tree.maxDepth).toBe(1);
      expect(tree.roots).toHaveLength(1);
      expect(tree.roots[0]?.id).toBe("p1");
      expect(tree.roots[0]?.children).toHaveLength(2);
    });

    it("should calculate correct depth levels", () => {
      // p1 -> p2 -> p3 -> p4 (chain of depth 3)
      const prompts: PromptRow[] = [
        createPromptRow("p1", 1, null),
        createPromptRow("p2", 2, "p1"),
        createPromptRow("p3", 3, "p2"),
        createPromptRow("p4", 4, "p3"),
      ];

      const tree = buildConversationTree(prompts);

      expect(tree.maxDepth).toBe(3);

      const flat = flattenTree(tree);
      expect(flat[0]?.depth).toBe(0); // p1
      expect(flat[1]?.depth).toBe(1); // p2
      expect(flat[2]?.depth).toBe(2); // p3
      expect(flat[3]?.depth).toBe(3); // p4
    });

    it("should sort children by sequence_number", () => {
      const prompts: PromptRow[] = [
        createPromptRow("parent", 1, null),
        createPromptRow("child3", 4, "parent"),
        createPromptRow("child1", 2, "parent"),
        createPromptRow("child2", 3, "parent"),
      ];

      const tree = buildConversationTree(prompts);

      const children = tree.roots[0]?.children || [];
      expect(children[0]?.id).toBe("child1");
      expect(children[1]?.id).toBe("child2");
      expect(children[2]?.id).toBe("child3");
    });

    it("should handle multiple root nodes", () => {
      const prompts: PromptRow[] = [
        createPromptRow("root1", 1, null),
        createPromptRow("child1", 2, "root1"),
        createPromptRow("root2", 3, null),
        createPromptRow("child2", 4, "root2"),
      ];

      const tree = buildConversationTree(prompts);

      expect(tree.roots).toHaveLength(2);
      expect(tree.roots[0]?.id).toBe("root1");
      expect(tree.roots[0]?.children).toHaveLength(1);
      expect(tree.roots[1]?.id).toBe("root2");
      expect(tree.roots[1]?.children).toHaveLength(1);
    });
  });

  describe("orphaned prompts", () => {
    it("should treat prompts with missing parents as roots", () => {
      const prompts: PromptRow[] = [
        createPromptRow("p1", 1, null),
        createPromptRow("p2", 2, "missing-parent"),
      ];

      const tree = buildConversationTree(prompts);

      expect(tree.roots).toHaveLength(2);
      expect(tree.roots.find((r) => r.id === "p2")).toBeDefined();
    });

    it("should still be threaded type if any valid parent relationships exist", () => {
      const prompts: PromptRow[] = [
        createPromptRow("p1", 1, null),
        createPromptRow("p2", 2, "p1"), // valid parent
        createPromptRow("p3", 3, "missing"), // orphan
      ];

      const tree = buildConversationTree(prompts);

      expect(tree.type).toBe("threaded");
      expect(tree.roots).toHaveLength(2); // p1 and orphaned p3
    });
  });

  describe("cycle detection", () => {
    it("should handle self-referencing prompts", () => {
      const prompts: PromptRow[] = [
        { ...createPromptRow("p1", 1, null), parent_prompt_id: "p1" }, // self-ref
      ];

      const tree = buildConversationTree(prompts);

      // Should treat as root instead of infinite loop
      expect(tree.roots).toHaveLength(1);
      expect(tree.roots[0]?.id).toBe("p1");
    });

    it("should handle circular references", () => {
      // p1 -> p2 -> p3 -> p1 (cycle)
      const prompts: PromptRow[] = [
        { ...createPromptRow("p1", 1), parent_prompt_id: "p3" },
        { ...createPromptRow("p2", 2), parent_prompt_id: "p1" },
        { ...createPromptRow("p3", 3), parent_prompt_id: "p2" },
      ];

      // Should not hang, should handle gracefully
      const tree = buildConversationTree(prompts);

      expect(tree.totalPrompts).toBe(3);
      // At least one should become a root to break the cycle
      expect(tree.roots.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("analysis data", () => {
    it("should include analysis data in nodes", () => {
      const prompts: PromptRow[] = [
        {
          id: "p1",
          text: "Test",
          sequence_number: 1,
          parent_prompt_id: null,
          created_at: "2025-01-15T10:00:00Z",
          analysis: {
            overall_score: 75,
            dimension_scores: { clarity: 80, specificity: 70 },
          },
        },
      ];

      const tree = buildConversationTree(prompts);

      expect(tree.roots[0]?.analysis).toBeDefined();
      expect(tree.roots[0]?.analysis?.overall_score).toBe(75);
      expect(tree.roots[0]?.analysis?.categories).toEqual({
        clarity: 80,
        specificity: 70,
      });
    });

    it("should handle null analysis", () => {
      const prompts: PromptRow[] = [createPromptRow("p1", 1)];

      const tree = buildConversationTree(prompts);

      expect(tree.roots[0]?.analysis).toBeUndefined();
    });
  });
});

describe("flattenTree", () => {
  it("should flatten tree in depth-first order", () => {
    const prompts: PromptRow[] = [
      createPromptRow("p1", 1, null),
      createPromptRow("p2", 2, "p1"),
      createPromptRow("p3", 3, "p2"),
      createPromptRow("p4", 4, "p1"),
    ];

    const tree = buildConversationTree(prompts);
    const flat = flattenTree(tree);

    expect(flat).toHaveLength(4);
    expect(flat[0]?.id).toBe("p1"); // root
    expect(flat[1]?.id).toBe("p2"); // first child of p1
    expect(flat[2]?.id).toBe("p3"); // child of p2
    expect(flat[3]?.id).toBe("p4"); // second child of p1
  });

  it("should preserve depth in flattened nodes", () => {
    const prompts: PromptRow[] = [
      createPromptRow("p1", 1, null),
      createPromptRow("p2", 2, "p1"),
      createPromptRow("p3", 3, "p2"),
    ];

    const tree = buildConversationTree(prompts);
    const flat = flattenTree(tree);

    expect(flat[0]?.depth).toBe(0);
    expect(flat[1]?.depth).toBe(1);
    expect(flat[2]?.depth).toBe(2);
  });

  it("should return empty array for empty tree", () => {
    const tree = buildConversationTree([]);
    const flat = flattenTree(tree);

    expect(flat).toHaveLength(0);
  });
});

describe("findPromptInTree", () => {
  it("should find prompt in tree by ID", () => {
    const prompts: PromptRow[] = [
      createPromptRow("p1", 1, null),
      createPromptRow("p2", 2, "p1"),
      createPromptRow("p3", 3, "p2"),
    ];

    const tree = buildConversationTree(prompts);

    const found = findPromptInTree(tree, "p3");
    expect(found).toBeDefined();
    expect(found?.id).toBe("p3");
    expect(found?.depth).toBe(2);
  });

  it("should return null for non-existent ID", () => {
    const prompts: PromptRow[] = [createPromptRow("p1", 1)];

    const tree = buildConversationTree(prompts);

    expect(findPromptInTree(tree, "nonexistent")).toBeNull();
  });

  it("should find root-level prompts", () => {
    const prompts: PromptRow[] = [
      createPromptRow("p1", 1),
      createPromptRow("p2", 2),
    ];

    const tree = buildConversationTree(prompts);

    expect(findPromptInTree(tree, "p1")?.id).toBe("p1");
    expect(findPromptInTree(tree, "p2")?.id).toBe("p2");
  });
});

describe("getPromptPath", () => {
  it("should return path from root to prompt", () => {
    const prompts: PromptRow[] = [
      createPromptRow("p1", 1, null),
      createPromptRow("p2", 2, "p1"),
      createPromptRow("p3", 3, "p2"),
    ];

    const tree = buildConversationTree(prompts);

    const path = getPromptPath(tree, "p3");
    expect(path).toEqual(["p1", "p2", "p3"]);
  });

  it("should return single-element path for root", () => {
    const prompts: PromptRow[] = [
      createPromptRow("p1", 1, null),
      createPromptRow("p2", 2, "p1"),
    ];

    const tree = buildConversationTree(prompts);

    const path = getPromptPath(tree, "p1");
    expect(path).toEqual(["p1"]);
  });

  it("should return null for non-existent prompt", () => {
    const prompts: PromptRow[] = [createPromptRow("p1", 1)];

    const tree = buildConversationTree(prompts);

    expect(getPromptPath(tree, "nonexistent")).toBeNull();
  });
});

describe("countByDepth", () => {
  it("should count prompts at each depth level", () => {
    const prompts: PromptRow[] = [
      createPromptRow("p1", 1, null), // depth 0
      createPromptRow("p2", 2, null), // depth 0
      createPromptRow("p3", 3, "p1"), // depth 1
      createPromptRow("p4", 4, "p1"), // depth 1
      createPromptRow("p5", 5, "p3"), // depth 2
    ];

    const tree = buildConversationTree(prompts);
    const counts = countByDepth(tree);

    expect(counts.get(0)).toBe(2); // p1, p2
    expect(counts.get(1)).toBe(2); // p3, p4
    expect(counts.get(2)).toBe(1); // p5
  });

  it("should return empty map for empty tree", () => {
    const tree = buildConversationTree([]);
    const counts = countByDepth(tree);

    expect(counts.size).toBe(0);
  });
});
