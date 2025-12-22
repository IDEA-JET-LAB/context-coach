// Scoring Module for analyze-prompt Edge Function
// Story 5.2: 5-Dimension Scoring
// Story 5.3: Improvement Suggestions

/**
 * Score and reasoning for a single dimension
 */
export interface DimensionScoreResponse {
  score: number; // 1-10
  reasoning: string;
  suggestion?: string; // AI-generated suggestion (optional - fallback if missing)
  example?: string; // Optional example of improved prompt snippet
}

/**
 * Complete AI analysis response with all 5 dimensions
 */
export interface AIAnalysisResponse {
  clarity: DimensionScoreResponse;
  context: DimensionScoreResponse;
  specificity: DimensionScoreResponse;
  goal: DimensionScoreResponse;
  constraints: DimensionScoreResponse;
}

/**
 * Dimension score with weight for calculation
 */
export interface DimensionScore {
  name: string;
  score: number;
  weight: number;
  reasoning: string;
  suggestion?: string; // AI-generated suggestion
  example?: string; // Optional example of improved prompt snippet
}

/**
 * Complete scoring result
 */
export interface ScoringResult {
  dimensionScores: DimensionScore[];
  overallScore: number;
  rawResponse: string;
}

/**
 * Custom error for invalid AI responses
 */
export class AIResponseParseError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AIResponseParseError';
  }
}

/**
 * Valid dimension names in the response
 */
const VALID_DIMENSIONS = ['clarity', 'context', 'specificity', 'goal', 'constraints'] as const;
type DimensionName = typeof VALID_DIMENSIONS[number];

/**
 * Validates that a score is an integer between 1 and 10
 */
function isValidScore(score: unknown): score is number {
  return (
    typeof score === 'number' &&
    Number.isInteger(score) &&
    score >= 1 &&
    score <= 10
  );
}

/**
 * Validates that reasoning is a non-empty string
 */
function isValidReasoning(reasoning: unknown): reasoning is string {
  return typeof reasoning === 'string' && reasoning.trim().length > 0;
}

/**
 * Validates a single dimension score response
 */
function validateDimensionScore(
  dimension: string,
  value: unknown,
  rawResponse: string
): DimensionScoreResponse {
  if (typeof value !== 'object' || value === null) {
    throw new AIResponseParseError(
      `Invalid ${dimension} dimension: expected object with score and reasoning`,
      rawResponse,
      { dimension, received: typeof value }
    );
  }

  const obj = value as Record<string, unknown>;

  if (!isValidScore(obj.score)) {
    throw new AIResponseParseError(
      `Invalid ${dimension} score: must be integer 1-10`,
      rawResponse,
      { dimension, receivedScore: obj.score }
    );
  }

  if (!isValidReasoning(obj.reasoning)) {
    throw new AIResponseParseError(
      `Invalid ${dimension} reasoning: must be non-empty string`,
      rawResponse,
      { dimension, receivedReasoning: obj.reasoning }
    );
  }

  // Extract optional suggestion (don't throw if missing - use fallback later)
  const suggestion = typeof obj.suggestion === 'string' && obj.suggestion.trim().length > 0
    ? obj.suggestion.trim()
    : undefined;

  // Extract optional example (don't throw if missing)
  const example = typeof obj.example === 'string' && obj.example.trim().length > 0
    ? obj.example.trim()
    : undefined;

  return {
    score: obj.score,
    reasoning: obj.reasoning,
    ...(suggestion && { suggestion }),
    ...(example && { example }),
  };
}

/**
 * Parses and validates the raw AI response
 * @param rawResponse The raw JSON string from the AI
 * @returns Validated AIAnalysisResponse
 * @throws AIResponseParseError if response is invalid
 */
export function parseAIResponse(rawResponse: string): AIAnalysisResponse {
  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponse);
  } catch (e) {
    throw new AIResponseParseError(
      'Invalid JSON in AI response',
      rawResponse,
      { parseError: e instanceof Error ? e.message : 'Unknown parse error' }
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new AIResponseParseError(
      'AI response must be an object',
      rawResponse,
      { receivedType: typeof parsed }
    );
  }

  const response = parsed as Record<string, unknown>;

  // Validate all required dimensions are present
  const missingDimensions = VALID_DIMENSIONS.filter(
    (dim) => !(dim in response)
  );
  if (missingDimensions.length > 0) {
    throw new AIResponseParseError(
      `Missing dimensions in AI response: ${missingDimensions.join(', ')}`,
      rawResponse,
      { missingDimensions }
    );
  }

  // Validate each dimension
  return {
    clarity: validateDimensionScore('clarity', response.clarity, rawResponse),
    context: validateDimensionScore('context', response.context, rawResponse),
    specificity: validateDimensionScore('specificity', response.specificity, rawResponse),
    goal: validateDimensionScore('goal', response.goal, rawResponse),
    constraints: validateDimensionScore('constraints', response.constraints, rawResponse),
  };
}

/**
 * Calculates the weighted average overall score
 * @param scores Array of dimension scores with weights
 * @returns Overall score rounded to 1 decimal place
 */
export function calculateOverallScore(scores: DimensionScoreResponse[], weights: number[]): number {
  if (scores.length !== weights.length) {
    throw new Error(
      `Scores and weights length mismatch: ${scores.length} scores, ${weights.length} weights`
    );
  }

  if (scores.length === 0) {
    throw new Error('Cannot calculate overall score with no dimensions');
  }

  // Calculate weighted sum
  const weightedSum = scores.reduce((sum, score, index) => {
    return sum + score.score * weights[index];
  }, 0);

  // Weights sum to 100, so divide by 100
  const overallScore = weightedSum / 100;

  // Round to 1 decimal place
  return Math.round(overallScore * 10) / 10;
}

/**
 * Maps AI analysis response to dimension scores with weights
 * @param analysis The parsed AI analysis response
 * @param dimensionWeights Map of dimension name to weight (e.g., { clarity: 25, context: 25, ... })
 * @returns Array of dimension scores with weights and overall score
 */
export function mapToScoringResult(
  analysis: AIAnalysisResponse,
  dimensionWeights: Record<string, number>,
  rawResponse: string
): ScoringResult {
  const dimensionScores: DimensionScore[] = VALID_DIMENSIONS.map((name) => {
    const weight = dimensionWeights[name];
    if (typeof weight !== 'number') {
      throw new Error(`Missing weight for dimension: ${name}`);
    }
    const dimensionData = analysis[name];
    return {
      name,
      score: dimensionData.score,
      weight,
      reasoning: dimensionData.reasoning,
      ...(dimensionData.suggestion && { suggestion: dimensionData.suggestion }),
      ...(dimensionData.example && { example: dimensionData.example }),
    };
  });

  const scores = dimensionScores.map((d) => ({ score: d.score, reasoning: d.reasoning }));
  const weights = dimensionScores.map((d) => d.weight);
  const overallScore = calculateOverallScore(scores, weights);

  return {
    dimensionScores,
    overallScore,
    rawResponse,
  };
}
