/**
 * Stage Detector Service - Story 31-1
 *
 * Analyzes conversations to detect project stages and transitions.
 * Works as a state machine that tracks the current stage and propagates
 * it forward until a strong signal triggers a transition.
 */

import type { ProjectStage } from '@/lib/types/conversations';
import {
  STAGE_PATTERNS,
  SLASH_COMMAND_STAGE_MAP,
  getStagesByPriority,
  isConfirmationPrompt,
  extractSlashCommand,
  isTooShortToClassify,
} from './stage-patterns';

/**
 * Result of stage detection for a single prompt.
 */
export interface StageDetectionResult {
  /** ID of the prompt */
  promptId: string;
  /** Detected stage for this prompt */
  detectedStage: ProjectStage;
  /** Confidence score (0-1) */
  confidence: number;
  /** True if this prompt started a new stage */
  isTransitionPoint: boolean;
  /** Pattern that triggered detection (for debugging) */
  signalPattern?: string;
}

/**
 * Input format for prompts to analyze.
 */
export interface ConversationPromptInput {
  /** Unique identifier for the prompt */
  id: string;
  /** The prompt text */
  text: string;
  /** Order in the conversation (1-based) */
  sequenceNumber: number;
  /** When the prompt was sent (ISO 8601) */
  timestamp: string;
}

/**
 * Options for the stage detector.
 */
export interface StageDetectorOptions {
  /** Default stage when no signal detected (default: 'development') */
  defaultStage?: ProjectStage;
  /** Minimum confidence to accept a detection (default: 0.6) */
  minConfidence?: number;
  /** Confidence decay rate for inherited stages (default: 0.9) */
  confidenceDecay?: number;
}

/**
 * Result from single prompt detection.
 */
interface SinglePromptDetection {
  stage: ProjectStage;
  confidence: number;
  matchedPattern: string;
}

/**
 * Analyzes a conversation and detects stages for each prompt.
 *
 * The algorithm works as a state machine:
 * 1. Start with a default stage
 * 2. For each prompt, check if it signals a stage transition
 * 3. If yes, transition to the new stage
 * 4. If no, inherit the previous stage
 *
 * @param prompts - Array of prompts to analyze
 * @param options - Detection options
 * @returns Array of detection results, one per prompt
 */
export function detectConversationStages(
  prompts: ConversationPromptInput[],
  options: StageDetectorOptions = {}
): StageDetectionResult[] {
  const {
    defaultStage = 'development',
    minConfidence = 0.6,
    confidenceDecay = 0.9,
  } = options;

  // Handle empty input
  if (!prompts || prompts.length === 0) {
    return [];
  }

  const results: StageDetectionResult[] = [];
  let currentStage: ProjectStage = defaultStage;
  let currentConfidence = 0.5;

  // Sort by sequence number to ensure correct order
  const sortedPrompts = [...prompts].sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber
  );

  for (const prompt of sortedPrompts) {
    const detection = detectStageFromPrompt(prompt.text, minConfidence);

    if (detection) {
      // Strong signal detected - transition to new stage
      const isTransition = detection.stage !== currentStage;
      results.push({
        promptId: prompt.id,
        detectedStage: detection.stage,
        confidence: detection.confidence,
        isTransitionPoint: isTransition,
        signalPattern: detection.matchedPattern,
      });
      currentStage = detection.stage;
      currentConfidence = detection.confidence;
    } else {
      // No strong signal - inherit previous stage with decayed confidence
      results.push({
        promptId: prompt.id,
        detectedStage: currentStage,
        confidence: Math.max(0.5, currentConfidence * confidenceDecay),
        isTransitionPoint: false,
      });
      // Don't decay the stored confidence too much
      currentConfidence = Math.max(0.5, currentConfidence * 0.95);
    }
  }

  return results;
}

/**
 * Attempts to detect stage from a single prompt.
 * Returns null if no strong signal found.
 *
 * @param text - The prompt text
 * @param minConfidence - Minimum confidence threshold
 * @returns Detection result or null
 */
export function detectStageFromPrompt(
  text: string,
  minConfidence = 0.6
): SinglePromptDetection | null {
  const trimmedText = text.trim();

  // Check for slash commands first (highest priority)
  const slashCommand = extractSlashCommand(trimmedText);
  if (slashCommand && SLASH_COMMAND_STAGE_MAP[slashCommand]) {
    return {
      stage: SLASH_COMMAND_STAGE_MAP[slashCommand],
      confidence: 0.95,
      matchedPattern: `slash_command:${slashCommand}`,
    };
  }

  // Check if it's a confirmation/continuation prompt
  if (isConfirmationPrompt(trimmedText)) {
    return null; // Inherit previous stage
  }

  // Check if too short to classify
  if (isTooShortToClassify(trimmedText)) {
    return null; // Inherit previous stage
  }

  // Check patterns in priority order
  const stagesByPriority = getStagesByPriority();

  for (const [stage, config] of stagesByPriority) {
    for (const pattern of config.patterns) {
      if (pattern.test(trimmedText)) {
        if (config.minConfidence >= minConfidence) {
          return {
            stage,
            confidence: config.minConfidence,
            matchedPattern: pattern.source,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Detect the primary stage from a single prompt (convenience function).
 * Returns the default stage if no strong signal found.
 *
 * @param text - The prompt text
 * @param defaultStage - Stage to return if no detection
 * @returns Detected or default stage
 */
export function detectSinglePromptStage(
  text: string,
  defaultStage: ProjectStage = 'development'
): ProjectStage {
  const detection = detectStageFromPrompt(text);
  return detection?.stage ?? defaultStage;
}

/**
 * Count stage transitions in detection results.
 */
export function countStageTransitions(results: StageDetectionResult[]): number {
  return results.filter((r) => r.isTransitionPoint).length;
}

/**
 * Get unique stages present in detection results.
 */
export function getUniqueStages(results: StageDetectionResult[]): ProjectStage[] {
  const stages = new Set<ProjectStage>();
  for (const result of results) {
    stages.add(result.detectedStage);
  }
  return Array.from(stages);
}

/**
 * Calculate stage distribution from detection results.
 */
export function calculateStageDistribution(
  results: StageDetectionResult[]
): Record<ProjectStage, number> {
  const distribution: Record<string, number> = {};

  for (const result of results) {
    distribution[result.detectedStage] =
      (distribution[result.detectedStage] || 0) + 1;
  }

  return distribution as Record<ProjectStage, number>;
}

/**
 * Find the primary (most common) stage in detection results.
 */
export function findPrimaryStage(
  results: StageDetectionResult[]
): ProjectStage | null {
  if (results.length === 0) return null;

  const distribution = calculateStageDistribution(results);
  let primaryStage: ProjectStage | null = null;
  let maxCount = 0;

  for (const [stage, count] of Object.entries(distribution)) {
    if (count > maxCount) {
      maxCount = count;
      primaryStage = stage as ProjectStage;
    }
  }

  return primaryStage;
}

/**
 * Get average confidence for detection results.
 */
export function getAverageConfidence(results: StageDetectionResult[]): number {
  if (results.length === 0) return 0;
  const total = results.reduce((sum, r) => sum + r.confidence, 0);
  return total / results.length;
}
