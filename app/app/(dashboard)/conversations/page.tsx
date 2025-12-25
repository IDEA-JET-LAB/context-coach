import { ConversationsPageClient } from "./ConversationsPageClient";
import type { ConversationSummary } from "@/components/conversations/types";

export const metadata = {
  title: "Conversations | Contextor",
  description: "Browse your Claude Code conversations",
};

/**
 * Conversations List Page
 *
 * UI Preview with mock data - will be connected to database in implementation phase.
 */

// Mock data for UI preview
const MOCK_CONVERSATIONS: ConversationSummary[] = [
  {
    id: "1",
    sessionId: "session-001",
    slug: "Implement OAuth login flow",
    projectId: "proj-1",
    projectName: "Contextor",
    userId: "user-1",
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    endedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    userMessageCount: 15,
    totalMessages: 30,
    primaryStage: "implementation",
    hasDebuggingLoop: false,
    conversationScore: 78,
    gitBranch: "feature/auth-flow",
    cwd: "/Users/dev/contextor",
    claudeCodeVersion: "1.0.23",
  },
  {
    id: "2",
    sessionId: "session-002",
    slug: "Fix database connection timeout",
    projectId: "proj-1",
    projectName: "Contextor",
    userId: "user-1",
    startedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    endedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    userMessageCount: 28,
    totalMessages: 56,
    primaryStage: "debugging",
    hasDebuggingLoop: true,
    conversationScore: 62,
    gitBranch: "fix/database-issue",
    cwd: "/Users/dev/contextor",
    claudeCodeVersion: "1.0.23",
  },
  {
    id: "3",
    sessionId: "session-003",
    slug: "Plan API refactoring strategy",
    projectId: "proj-1",
    projectName: "Contextor",
    userId: "user-1",
    startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    endedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
    userMessageCount: 8,
    totalMessages: 16,
    primaryStage: "planning",
    hasDebuggingLoop: false,
    conversationScore: 85,
    gitBranch: "main",
    cwd: "/Users/dev/contextor",
    claudeCodeVersion: "1.0.22",
  },
  {
    id: "4",
    sessionId: "session-004",
    slug: "Build conversation UI components",
    projectId: "proj-2",
    projectName: "Design System",
    userId: "user-1",
    startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    endedAt: null,
    userMessageCount: 5,
    totalMessages: 10,
    primaryStage: "implementation",
    hasDebuggingLoop: false,
    conversationScore: null,
    gitBranch: "feature/new-ui",
    cwd: "/Users/dev/design-system",
    claudeCodeVersion: "1.0.23",
  },
  {
    id: "5",
    sessionId: "session-005",
    slug: "Write API documentation",
    projectId: "proj-1",
    projectName: "Contextor",
    userId: "user-1",
    startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    endedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
    userMessageCount: 12,
    totalMessages: 24,
    primaryStage: "documentation",
    hasDebuggingLoop: false,
    conversationScore: 91,
    gitBranch: "docs/api-reference",
    cwd: "/Users/dev/contextor",
    claudeCodeVersion: "1.0.21",
  },
];

const MOCK_PROJECTS = [
  { id: "proj-1", name: "Contextor" },
  { id: "proj-2", name: "Design System" },
];

export default function ConversationsPage() {
  return (
    <ConversationsPageClient
      conversations={MOCK_CONVERSATIONS}
      projects={MOCK_PROJECTS}
      currentUserId="user-1"
    />
  );
}
