/**
 * Pasted Content Detector
 *
 * Detects and segments large pasted content within user prompts:
 * - Terminal/log output (timestamps like [2026-01-08T...])
 * - Session continuation summaries
 * - Code blocks (triple backticks)
 * - VS Code extension logs
 * - Build/compilation output
 */

export interface ContentSegment {
  type: "text" | "pasted";
  content: string;
  pastedType?:
    | "code_block"
    | "terminal_logs"
    | "session_summary"
    | "build_output"
    | "json_data"
    | "generic_pasted";
  label?: string;
  charCount: number;
}

export interface SegmentedContent {
  segments: ContentSegment[];
  hasPastedContent: boolean;
  totalPastedChars: number;
}

// Minimum chars for content to be considered "large" and worth collapsing
const MIN_PASTED_CONTENT_LENGTH = 500;

// Patterns for detecting pasted content
const PATTERNS = {
  // Code blocks with triple backticks
  codeBlock: /```[\s\S]*?```/g,

  // Terminal logs with ISO timestamps
  terminalLogs:
    /(?:^|\n)(?:\[[0-9T:.\-Z+]+\].*(?:\n|$)){3,}/gm,

  // Session continuation text
  sessionSummary:
    /This session is being continued from a previous conversation[\s\S]*?(?=(?:\n\n[A-Z]|\n\nUser:|$))/g,

  // VS Code extension logs
  vscodeExtLogs:
    /(?:^|\n)(?:\[(?:Contextor|Extension|VS ?Code)[^\]]*\].*(?:\n|$)){3,}/gim,

  // Build/compilation output (npm, webpack, tsc, etc.)
  buildOutput:
    /(?:^|\n)(?:(?:error|warning|info|debug|WARN|ERROR|INFO)[\s:].+(?:\n|$)){3,}/gim,

  // JSON data blocks (objects or arrays)
  jsonData: /\{[\s\S]{200,}?\}|\[[\s\S]{200,}?\]/g,

  // Stack traces
  stackTrace: /(?:^|\n)(?:\s+at\s+.+(?:\n|$)){3,}/gm,

  // Generic multi-line output (10+ lines of similar patterns)
  genericOutput:
    /(?:^|\n)(?:[│├└─┌┐┘┬┴┤┼]+.*(?:\n|$)){5,}/gm,
};

/**
 * Detects pasted content type from a segment
 */
function detectPastedType(
  content: string
): ContentSegment["pastedType"] | null {
  // Code blocks are most reliable
  if (content.startsWith("```") && content.endsWith("```")) {
    return "code_block";
  }

  // Session summaries
  if (content.includes("This session is being continued")) {
    return "session_summary";
  }

  // Terminal logs with timestamps
  if (/\[[0-9T:.\-Z+]+\]/.test(content)) {
    return "terminal_logs";
  }

  // Build output patterns
  if (
    /(?:error|warning|ERROR|WARN|npm|webpack|tsc)/i.test(content) &&
    content.split("\n").length > 5
  ) {
    return "build_output";
  }

  // JSON data
  if (
    (content.trim().startsWith("{") && content.trim().endsWith("}")) ||
    (content.trim().startsWith("[") && content.trim().endsWith("]"))
  ) {
    try {
      JSON.parse(content.trim());
      return "json_data";
    } catch {
      // Not valid JSON
    }
  }

  // Stack traces
  if (/\s+at\s+/.test(content) && content.split("\n").length > 3) {
    return "terminal_logs";
  }

  return "generic_pasted";
}

/**
 * Gets a human-readable label for pasted content type
 */
function getPastedContentLabel(
  type: ContentSegment["pastedType"],
  charCount: number
): string {
  const sizeLabel = charCount > 5000 ? "Large" : "";

  switch (type) {
    case "code_block":
      return `${sizeLabel} Code Block`.trim();
    case "terminal_logs":
      return `${sizeLabel} Terminal/Log Output`.trim();
    case "session_summary":
      return "Session Continuation Context";
    case "build_output":
      return `${sizeLabel} Build Output`.trim();
    case "json_data":
      return `${sizeLabel} JSON Data`.trim();
    default:
      return `${sizeLabel} Pasted Content`.trim();
  }
}

/**
 * Finds all pasted content regions in text
 * Returns array of [start, end, type] tuples
 */
function findPastedRegions(
  text: string
): Array<[number, number, ContentSegment["pastedType"]]> {
  const regions: Array<[number, number, ContentSegment["pastedType"]]> = [];

  // Code blocks - most reliable
  const codeMatches = [...text.matchAll(PATTERNS.codeBlock)];
  for (const match of codeMatches) {
    if (match.index !== undefined && match[0].length >= MIN_PASTED_CONTENT_LENGTH) {
      regions.push([match.index, match.index + match[0].length, "code_block"]);
    }
  }

  // Session summaries
  const sessionMatches = [...text.matchAll(PATTERNS.sessionSummary)];
  for (const match of sessionMatches) {
    if (match.index !== undefined && match[0].length >= MIN_PASTED_CONTENT_LENGTH) {
      regions.push([
        match.index,
        match.index + match[0].length,
        "session_summary",
      ]);
    }
  }

  // Terminal logs
  const logMatches = [...text.matchAll(PATTERNS.terminalLogs)];
  for (const match of logMatches) {
    if (match.index !== undefined && match[0].length >= MIN_PASTED_CONTENT_LENGTH) {
      regions.push([match.index, match.index + match[0].length, "terminal_logs"]);
    }
  }

  // Build output
  const buildMatches = [...text.matchAll(PATTERNS.buildOutput)];
  for (const match of buildMatches) {
    if (match.index !== undefined && match[0].length >= MIN_PASTED_CONTENT_LENGTH) {
      regions.push([match.index, match.index + match[0].length, "build_output"]);
    }
  }

  // Sort by start position
  regions.sort((a, b) => a[0] - b[0]);

  // Merge overlapping regions
  const merged: Array<[number, number, ContentSegment["pastedType"]]> = [];
  for (const region of regions) {
    if (merged.length === 0) {
      merged.push(region);
    } else {
      const last = merged[merged.length - 1]!;
      if (region[0] <= last[1]) {
        // Overlapping - extend the previous region
        last[1] = Math.max(last[1], region[1]);
        // Keep the more specific type
        if (region[2] !== "generic_pasted") {
          last[2] = region[2];
        }
      } else {
        merged.push(region);
      }
    }
  }

  return merged;
}

/**
 * Segments content into text and pasted content blocks
 */
export function segmentContent(content: string): SegmentedContent {
  if (!content || content.length < MIN_PASTED_CONTENT_LENGTH) {
    return {
      segments: [{ type: "text", content, charCount: content?.length || 0 }],
      hasPastedContent: false,
      totalPastedChars: 0,
    };
  }

  const regions = findPastedRegions(content);

  if (regions.length === 0) {
    return {
      segments: [{ type: "text", content, charCount: content.length }],
      hasPastedContent: false,
      totalPastedChars: 0,
    };
  }

  const segments: ContentSegment[] = [];
  let lastEnd = 0;
  let totalPastedChars = 0;

  for (const [start, end, pastedType] of regions) {
    // Add text before this region
    if (start > lastEnd) {
      const textContent = content.slice(lastEnd, start);
      if (textContent.trim()) {
        segments.push({
          type: "text",
          content: textContent,
          charCount: textContent.length,
        });
      }
    }

    // Add the pasted region
    const pastedContent = content.slice(start, end);
    const detectedType = detectPastedType(pastedContent);
    const finalType = pastedType || detectedType || "generic_pasted";
    segments.push({
      type: "pasted",
      content: pastedContent,
      pastedType: finalType,
      label: getPastedContentLabel(finalType, pastedContent.length),
      charCount: pastedContent.length,
    });
    totalPastedChars += pastedContent.length;

    lastEnd = end;
  }

  // Add remaining text
  if (lastEnd < content.length) {
    const textContent = content.slice(lastEnd);
    if (textContent.trim()) {
      segments.push({
        type: "text",
        content: textContent,
        charCount: textContent.length,
      });
    }
  }

  return {
    segments,
    hasPastedContent: totalPastedChars > 0,
    totalPastedChars,
  };
}

/**
 * Quick check if content likely contains pasted material
 * (without full segmentation)
 */
export function hasPastedContent(content: string): boolean {
  if (!content || content.length < MIN_PASTED_CONTENT_LENGTH) {
    return false;
  }

  // Quick checks
  if (content.includes("```") && content.lastIndexOf("```") > content.indexOf("```") + 3) {
    return true;
  }

  if (content.includes("This session is being continued")) {
    return true;
  }

  // Check for timestamp patterns (common in logs)
  if (/\[[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(content)) {
    return true;
  }

  return false;
}

/**
 * Gets a preview of pasted content (first N chars with indicator)
 */
export function getPastedContentPreview(
  content: string,
  maxLength: number = 150
): string {
  if (content.length <= maxLength) {
    return content;
  }

  // For code blocks, try to show the language
  if (content.startsWith("```")) {
    const firstLineEnd = content.indexOf("\n");
    const language = content.slice(3, firstLineEnd).trim();
    if (language) {
      return `\`\`\`${language}\n...`;
    }
    return "```\n...";
  }

  // For other content, show first line or truncated text
  const firstNewline = content.indexOf("\n");
  if (firstNewline > 0 && firstNewline < maxLength) {
    return content.slice(0, firstNewline) + "\n...";
  }

  return content.slice(0, maxLength) + "...";
}
