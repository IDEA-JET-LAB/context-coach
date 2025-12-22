/**
 * Health threshold constants and utilities for system monitoring.
 * Used to determine warning and critical states for metrics.
 */

export const HEALTH_THRESHOLDS = {
  pendingQueue: { warning: 50, critical: 100 },
  processingQueue: { warning: 20, critical: 50 },
  errorRate: { warning: 2, critical: 5 }, // percentages
  successRate: { warning: 95, critical: 90 }, // below is bad
  apiResponseTime: { warning: 2000, critical: 5000 }, // ms
  analysisTime: { warning: 10000, critical: 30000 }, // ms
} as const;

export type HealthStatus = 'healthy' | 'warning' | 'critical';

export type ThresholdConfig = { warning: number; critical: number };

/**
 * Determines the health status of a metric based on its value and thresholds.
 *
 * @param value - The current metric value
 * @param thresholds - The warning and critical threshold values
 * @param higherIsBetter - If true, lower values are worse (e.g., success rate).
 *                         If false, higher values are worse (e.g., error count).
 * @returns The health status: 'healthy', 'warning', or 'critical'
 */
export function getHealthStatus(
  value: number,
  thresholds: ThresholdConfig,
  higherIsBetter = false
): HealthStatus {
  if (higherIsBetter) {
    // For metrics where higher is better (e.g., success rate)
    // Critical if below critical threshold
    if (value < thresholds.critical) return 'critical';
    // Warning if below warning threshold
    if (value < thresholds.warning) return 'warning';
    return 'healthy';
  }

  // For metrics where lower is better (e.g., error count, response time)
  // Critical if at or above critical threshold
  if (value >= thresholds.critical) return 'critical';
  // Warning if at or above warning threshold
  if (value >= thresholds.warning) return 'warning';
  return 'healthy';
}

/**
 * Returns CSS class names for a given health status.
 */
export function getHealthStatusColors(status: HealthStatus): {
  text: string;
  bg: string;
  border: string;
} {
  switch (status) {
    case 'healthy':
      return {
        text: 'text-green-500',
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
      };
    case 'warning':
      return {
        text: 'text-yellow-500',
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/20',
      };
    case 'critical':
      return {
        text: 'text-red-500',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
      };
  }
}

/**
 * Gets threshold description for tooltip display.
 */
export function getThresholdDescription(
  thresholds: ThresholdConfig,
  unit: string = '',
  higherIsBetter = false
): string {
  if (higherIsBetter) {
    return `Warning: below ${thresholds.warning}${unit}, Critical: below ${thresholds.critical}${unit}`;
  }
  return `Warning: above ${thresholds.warning}${unit}, Critical: above ${thresholds.critical}${unit}`;
}
