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
 * Complete AI analysis response - now a generic record type
 * to support configurable dimensions from the database.
 * Key = dimension name (lowercase), Value = score response
 */
export type AIAnalysisResponse = Record<string, DimensionScoreResponse>;

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
 * Dimension names are now configurable via the database.
 * The parseAIResponse function accepts expectedDimensions parameter
 * to validate the AI response against the configured dimensions.
 */

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
 * Parses and validates the raw AI response against expected dimension names
 * @param rawResponse The raw JSON string from the AI
 * @param expectedDimensions Array of expected dimension names (lowercase) from the database
 * @returns Record of dimension name to validated score response
 * @throws AIResponseParseError if response is invalid
 */
export function parseAIResponse(
  rawResponse: string,
  expectedDimensions: string[]
): Record<string, DimensionScoreResponse> {
  // Validate inputs
  if (!rawResponse || typeof rawResponse !== 'string') {
    throw new AIResponseParseError(
      'Invalid AI response: response must be a non-empty string',
      String(rawResponse),
      { receivedType: typeof rawResponse }
    );
  }

  if (!expectedDimensions || expectedDimensions.length === 0) {
    throw new AIResponseParseError(
      'Invalid expected dimensions: must be a non-empty array',
      rawResponse,
      { receivedDimensions: expectedDimensions }
    );
  }

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

  // Validate all expected dimensions are present (using lowercase names)
  const normalizedExpected = expectedDimensions.map(d => d.toLowerCase());
  const missingDimensions = normalizedExpected.filter(
    (dim) => !(dim in response)
  );
  if (missingDimensions.length > 0) {
    throw new AIResponseParseError(
      `Missing dimensions in AI response: ${missingDimensions.join(', ')}`,
      rawResponse,
      { missingDimensions, expectedDimensions: normalizedExpected }
    );
  }

  // Validate each dimension and build response object
  const result: Record<string, DimensionScoreResponse> = {};
  for (const dim of normalizedExpected) {
    result[dim] = validateDimensionScore(dim, response[dim], rawResponse);
  }

  return result;
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
 * @param analysis The parsed AI analysis response (Record of dimension name to score)
 * @param dimensionWeights Map of dimension name (lowercase) to weight (e.g., { clarity: 25, context: 25, ... })
 * @param rawResponse The raw AI response string for debugging
 * @returns Array of dimension scores with weights and overall score
 */
export function mapToScoringResult(
  analysis: Record<string, DimensionScoreResponse>,
  dimensionWeights: Record<string, number>,
  rawResponse: string
): ScoringResult {
  // Use the dimension names from the weights (which come from the database)
  const dimensionNames = Object.keys(dimensionWeights);

  const dimensionScores: DimensionScore[] = dimensionNames.map((name) => {
    const weight = dimensionWeights[name];
    if (typeof weight !== 'number') {
      throw new Error(`Missing weight for dimension: ${name}`);
    }
    const dimensionData = analysis[name];
    if (!dimensionData) {
      throw new Error(`Missing analysis data for dimension: ${name}`);
    }
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
