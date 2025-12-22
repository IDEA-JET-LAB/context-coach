// AI Prompt Templates for analyze-prompt Edge Function
// Story 5.2: 5-Dimension Scoring
// Story 5.3: Improvement Suggestions

/**
 * Analysis dimension from the database
 */
export interface AnalysisDimension {
  id: string;
  config_id: string;
  name: string;
  description: string;
  weight: number;
  prompt_template: string;
  scoring_criteria: string;
  enabled: boolean;
  sort_order: number;
}

/**
 * Default system prompt for scoring (used if analysis_config.system_prompt is empty)
 */
const DEFAULT_SYSTEM_PROMPT = `You are an expert prompt quality analyst and coach. Your task is to evaluate the quality of prompts given to AI assistants and provide actionable suggestions for improvement.

You will analyze prompts across 5 key dimensions that determine how effectively an AI can understand and respond to a request.

For each dimension, provide:
1. A score from 1-10 (integer only)
2. Brief reasoning explaining the score
3. A suggestion based on the score:
   - Score 1-7: Give a specific, actionable improvement suggestion that references the actual prompt content
   - Score 8-9: Acknowledge what was done well, offer an optional advanced tip
   - Score 10: Provide positive reinforcement highlighting what makes this excellent
4. Optionally, a brief example showing how to improve (for scores 1-9)

Scoring guidelines:
- 1-3: Poor - Major issues that significantly hinder understanding
- 4-5: Below Average - Notable gaps or ambiguities
- 6-7: Good - Functional with minor improvements possible
- 8-9: Very Good - Clear, well-structured with minimal issues
- 10: Excellent - Exemplary, could serve as a template

Language guidelines for suggestions:
- Use coaching-positive language (e.g., "Consider..." instead of "You failed to...")
- Be specific and actionable (reference the actual prompt)
- Keep suggestions concise but helpful
- Focus on improvement, not criticism

Be fair but honest in your assessment. Most prompts should score in the 5-7 range.`;

/**
 * Builds the dimension descriptions section of the prompt
 */
function buildDimensionDescriptions(dimensions: AnalysisDimension[]): string {
  return dimensions
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((dim) => {
      const criteria = dim.scoring_criteria || dim.description;
      return `**${dim.name}**: ${dim.description}
   Scoring criteria: ${criteria}`;
    })
    .join('\n\n');
}

/**
 * Builds the expected JSON output format based on dimensions
 */
function buildOutputFormat(dimensions: AnalysisDimension[]): string {
  const dimensionKeys = dimensions
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((dim) => dim.name.toLowerCase());

  const example = dimensionKeys
    .map((key) => `  "${key}": { "score": <1-10>, "reasoning": "<brief explanation>", "suggestion": "<coaching-positive suggestion>", "example": "<optional improved snippet>" }`)
    .join(',\n');

  return `{
${example}
}

Note: "suggestion" is required for all dimensions. "example" is optional but recommended for scores 1-9.`;
}

/**
 * Builds the complete scoring prompts (system and user)
 * @param userPrompt The prompt text to analyze
 * @param dimensions The enabled analysis dimensions
 * @param configSystemPrompt Optional system prompt from analysis_config
 * @returns Object with systemPrompt and userPrompt for the AI
 */
export function buildScoringPrompt(
  userPrompt: string,
  dimensions: AnalysisDimension[],
  configSystemPrompt?: string
): { systemPrompt: string; userPrompt: string } {
  const baseSystemPrompt = configSystemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
  const dimensionDescriptions = buildDimensionDescriptions(dimensions);
  const outputFormat = buildOutputFormat(dimensions);

  const systemPrompt = `${baseSystemPrompt}

## Dimensions to Evaluate

${dimensionDescriptions}

## Response Format

You MUST respond with ONLY valid JSON matching this exact schema:
${outputFormat}

Do not include any text before or after the JSON. The response must be parseable by JSON.parse().`;

  const formattedUserPrompt = `Please analyze the following prompt and provide scores for each dimension:

---
${userPrompt}
---

Respond with the JSON scores only.`;

  return {
    systemPrompt,
    userPrompt: formattedUserPrompt,
  };
}

/**
 * Extracts dimension weights from analysis dimensions
 * @param dimensions Array of analysis dimensions
 * @returns Map of dimension name (lowercase) to weight
 */
export function extractDimensionWeights(
  dimensions: AnalysisDimension[]
): Record<string, number> {
  return dimensions.reduce(
    (weights, dim) => {
      weights[dim.name.toLowerCase()] = dim.weight;
      return weights;
    },
    {} as Record<string, number>
  );
}

/**
 * Validates that dimension weights sum to 100
 * @param dimensions Array of analysis dimensions
 * @throws Error if weights don't sum to 100
 */
export function validateDimensionWeights(dimensions: AnalysisDimension[]): void {
  const totalWeight = dimensions.reduce((sum, dim) => sum + dim.weight, 0);
  if (totalWeight !== 100) {
    throw new Error(
      `Dimension weights must sum to 100, got ${totalWeight}. ` +
      `Weights: ${dimensions.map((d) => `${d.name}=${d.weight}`).join(', ')}`
    );
  }
}
