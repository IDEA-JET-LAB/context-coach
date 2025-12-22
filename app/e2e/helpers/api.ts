import { createHash } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";

/**
 * Creates a test project directly in the database for API testing.
 * Returns the project details including the raw API key.
 */
export async function createTestProject(
  teamId: string,
  userId: string,
  projectName: string = `Test Project ${Date.now()}`
): Promise<{
  id: string;
  team_id: string;
  api_key: string;
  api_key_hash: string;
}> {
  // Generate a test API key
  const apiKey = `ctx_test_${crypto.randomUUID().replace(/-/g, "")}`;
  const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");
  const apiKeyPrefix = apiKey.slice(0, 16);

  // Use service role key for direct DB access
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set for test helper");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      team_id: teamId,
      name: projectName,
      description: "Test project for API testing",
      api_key_hash: apiKeyHash,
      api_key_prefix: apiKeyPrefix,
      created_by: userId,
      is_archived: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create test project: ${error}`);
  }

  const [project] = await response.json();

  return {
    id: project.id,
    team_id: project.team_id,
    api_key: apiKey,
    api_key_hash: apiKeyHash,
  };
}

/**
 * Creates a test team directly in the database.
 */
export async function createTestTeam(
  userId: string,
  teamName: string = `Test Team ${Date.now()}`
): Promise<{ id: string; name: string }> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set for test helper");
  }

  // Create team
  const teamResponse = await fetch(`${SUPABASE_URL}/rest/v1/teams`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      name: teamName,
      description: "Test team for API testing",
      created_by: userId,
    }),
  });

  if (!teamResponse.ok) {
    const error = await teamResponse.text();
    throw new Error(`Failed to create test team: ${error}`);
  }

  const [team] = await teamResponse.json();

  // Add user as admin member
  const memberResponse = await fetch(`${SUPABASE_URL}/rest/v1/team_members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      team_id: team.id,
      user_id: userId,
      role: "admin",
    }),
  });

  if (!memberResponse.ok) {
    const error = await memberResponse.text();
    throw new Error(`Failed to add team member: ${error}`);
  }

  return { id: team.id, name: team.name };
}

/**
 * Creates a test user directly in Supabase Auth.
 */
export async function createTestUserDirect(
  email: string,
  password: string = "TestPassword123!"
): Promise<{ id: string; email: string }> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set for test helper");
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create test user: ${error}`);
  }

  const user = await response.json();
  return { id: user.id, email: user.email };
}

/**
 * Clean up test data.
 */
export async function deleteTestProject(projectId: string): Promise<void> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return;

  await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
}

export async function deleteTestTeam(teamId: string): Promise<void> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return;

  await fetch(`${SUPABASE_URL}/rest/v1/teams?id=eq.${teamId}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
}

export async function deleteTestUser(userId: string): Promise<void> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return;

  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
}

/**
 * Fetches a prompt by ID for test verification.
 */
export async function getPromptById(promptId: string): Promise<{
  id: string;
  team_id: string;
  project_id: string;
  user_id: string;
  text: string;
  char_count: number;
  word_count: number;
  metadata: Record<string, unknown> | null;
  analysis_status: string;
  created_at: string;
} | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set for test helper");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/prompts?id=eq.${promptId}&select=*`,
    {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch prompt: ${error}`);
  }

  const prompts = await response.json();
  return prompts[0] || null;
}

/**
 * Deletes a prompt by ID for test cleanup.
 */
export async function deletePrompt(promptId: string): Promise<void> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return;

  await fetch(`${SUPABASE_URL}/rest/v1/prompts?id=eq.${promptId}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
}

/**
 * Deletes all prompts for a project (test cleanup).
 */
export async function deletePromptsForProject(projectId: string): Promise<void> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return;

  await fetch(`${SUPABASE_URL}/rest/v1/prompts?project_id=eq.${projectId}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
}

/**
 * Creates a test prompt directly in the database.
 */
export async function createTestPrompt(
  teamId: string,
  projectId: string,
  userId: string,
  text: string = "Test prompt for E2E testing"
): Promise<{
  id: string;
  team_id: string;
  project_id: string;
  user_id: string;
  text: string;
  analysis_status: string;
}> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set for test helper");
  }

  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/prompts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      team_id: teamId,
      project_id: projectId,
      user_id: userId,
      text,
      char_count: charCount,
      word_count: wordCount,
      analysis_status: "pending",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create test prompt: ${error}`);
  }

  const [prompt] = await response.json();
  return prompt;
}

/**
 * Creates a test prompt with full analysis data.
 */
export async function createTestPromptWithAnalysis(
  teamId: string,
  projectId: string,
  userId: string,
  options: {
    text?: string;
    overallScore?: number;
    dimensionScores?: Record<string, { score: number; reasoning: string }>;
    suggestions?: {
      byDimension?: Record<string, { type: "reinforcement" | "improvement"; message: string; example?: string }>;
      prioritized?: string[];
    };
  } = {}
): Promise<{
  prompt: {
    id: string;
    team_id: string;
    project_id: string;
    user_id: string;
    text: string;
    analysis_status: string;
  };
  analysis: {
    id: string;
    prompt_id: string;
    overall_score: number;
    dimension_scores: Record<string, { score: number; reasoning: string }>;
    suggestions: unknown;
  };
}> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set for test helper");
  }

  const text = options.text || "Test prompt for E2E testing with analysis";
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Create the prompt
  const promptResponse = await fetch(`${SUPABASE_URL}/rest/v1/prompts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      team_id: teamId,
      project_id: projectId,
      user_id: userId,
      text,
      char_count: charCount,
      word_count: wordCount,
      analysis_status: "complete",
    }),
  });

  if (!promptResponse.ok) {
    const error = await promptResponse.text();
    throw new Error(`Failed to create test prompt: ${error}`);
  }

  const [prompt] = await promptResponse.json();

  // Get the default analysis config
  const configResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/analysis_configs?is_active=eq.true&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );

  const configs = await configResponse.json();
  const configId = configs[0]?.id || crypto.randomUUID();

  // Default dimension scores
  const dimensionScores = options.dimensionScores || {
    Clarity: { score: 8.0, reasoning: "Clear and concise prompt structure" },
    Context: { score: 7.5, reasoning: "Good context provided" },
    Specificity: { score: 8.5, reasoning: "Very specific requirements" },
    Goal: { score: 7.0, reasoning: "Clear goal articulated" },
    Constraints: { score: 6.5, reasoning: "Could specify more constraints" },
  };

  const overallScore = options.overallScore ?? 7.5;

  const suggestions = options.suggestions || {
    byDimension: {
      Clarity: { type: "reinforcement" as const, message: "Your prompt is well-structured and easy to understand." },
      Context: { type: "improvement" as const, message: "Consider adding more background context about your use case." },
      Specificity: { type: "reinforcement" as const, message: "Excellent level of detail in your requirements." },
      Goal: { type: "improvement" as const, message: "Try stating the expected output format more explicitly." },
      Constraints: { type: "improvement" as const, message: "Adding constraints like scope or limitations would help.", example: "Limit the response to 500 words focusing on..." },
    },
    prioritized: ["Constraints", "Context", "Goal"],
    generatedAt: new Date().toISOString(),
  };

  // Create the analysis
  const analysisResponse = await fetch(`${SUPABASE_URL}/rest/v1/prompt_analyses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      prompt_id: prompt.id,
      config_id: configId,
      overall_score: overallScore,
      dimension_scores: dimensionScores,
      suggestions,
    }),
  });

  if (!analysisResponse.ok) {
    const error = await analysisResponse.text();
    throw new Error(`Failed to create test analysis: ${error}`);
  }

  const [analysis] = await analysisResponse.json();

  return { prompt, analysis };
}
