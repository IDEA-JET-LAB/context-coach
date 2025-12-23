/**
 * Configuration Audit Trail Types
 * Story 22-10: Configuration Audit Trail
 *
 * Types for tracking all configuration changes for compliance and debugging.
 */

/**
 * All possible actions that can be audited
 */
export type AuditAction =
  // Config actions
  | 'config_created'
  | 'config_updated'
  | 'config_activated'
  | 'config_archived'
  | 'config_deleted'
  | 'config_duplicated'
  | 'config_rolled_back'
  // Template actions
  | 'template_created'
  | 'template_updated'
  | 'template_published'
  | 'template_archived'
  | 'template_deleted'
  // Rule actions
  | 'rule_created'
  | 'rule_updated'
  | 'rule_enabled'
  | 'rule_disabled'
  | 'rule_deleted'
  // Category actions
  | 'category_created'
  | 'category_updated'
  | 'category_deleted'
  // Weight actions
  | 'weight_updated'
  | 'team_weight_created'
  | 'team_weight_updated'
  | 'team_weight_reset'
  // Experiment actions
  | 'experiment_created'
  | 'experiment_updated'
  | 'experiment_activated'
  | 'experiment_paused'
  | 'experiment_resumed'
  | 'experiment_completed'
  | 'experiment_winner_applied';

/**
 * Types of entities that can be audited
 */
export type AuditEntityType =
  | 'analysis_config'
  | 'prompt_template'
  | 'classification_rule'
  | 'classification_category'
  | 'scoring_weight'
  | 'team_weight_override'
  | 'experiment';

/**
 * A single audit log entry as stored in the database
 */
export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  change_summary: string | null;
  changed_by: string | null;
  changed_by_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  correlation_id: string | null;
}

/**
 * Filters for querying audit logs
 */
export interface AuditLogFilters {
  action?: AuditAction[];
  entity_type?: AuditEntityType[];
  changed_by?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

/**
 * Input for creating a new audit log entry
 */
export interface CreateAuditLogInput {
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  change_summary?: string;
  correlation_id?: string;
}

/**
 * Paginated response for audit log queries
 */
export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Action configuration for UI display
 */
export interface AuditActionConfig {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

/**
 * Entity type configuration for UI display
 */
export interface AuditEntityConfig {
  label: string;
  icon: string;
}

/**
 * Action display configurations
 */
export const AUDIT_ACTION_CONFIGS: Record<AuditAction, AuditActionConfig> = {
  // Config actions
  config_created: { label: 'Created', icon: 'Plus', color: 'text-green-600', bgColor: 'bg-green-100' },
  config_updated: { label: 'Updated', icon: 'Edit', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  config_activated: { label: 'Activated', icon: 'Zap', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  config_archived: { label: 'Archived', icon: 'Archive', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  config_deleted: { label: 'Deleted', icon: 'Trash2', color: 'text-red-600', bgColor: 'bg-red-100' },
  config_duplicated: { label: 'Duplicated', icon: 'Copy', color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  config_rolled_back: { label: 'Rolled back', icon: 'RotateCcw', color: 'text-orange-600', bgColor: 'bg-orange-100' },

  // Template actions
  template_created: { label: 'Created', icon: 'Plus', color: 'text-green-600', bgColor: 'bg-green-100' },
  template_updated: { label: 'Updated', icon: 'Edit', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  template_published: { label: 'Published', icon: 'Send', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  template_archived: { label: 'Archived', icon: 'Archive', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  template_deleted: { label: 'Deleted', icon: 'Trash2', color: 'text-red-600', bgColor: 'bg-red-100' },

  // Rule actions
  rule_created: { label: 'Created', icon: 'Plus', color: 'text-green-600', bgColor: 'bg-green-100' },
  rule_updated: { label: 'Updated', icon: 'Edit', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  rule_enabled: { label: 'Enabled', icon: 'Check', color: 'text-green-600', bgColor: 'bg-green-100' },
  rule_disabled: { label: 'Disabled', icon: 'X', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  rule_deleted: { label: 'Deleted', icon: 'Trash2', color: 'text-red-600', bgColor: 'bg-red-100' },

  // Category actions
  category_created: { label: 'Created', icon: 'Plus', color: 'text-green-600', bgColor: 'bg-green-100' },
  category_updated: { label: 'Updated', icon: 'Edit', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  category_deleted: { label: 'Deleted', icon: 'Trash2', color: 'text-red-600', bgColor: 'bg-red-100' },

  // Weight actions
  weight_updated: { label: 'Updated', icon: 'Scale', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  team_weight_created: { label: 'Created', icon: 'Plus', color: 'text-green-600', bgColor: 'bg-green-100' },
  team_weight_updated: { label: 'Updated', icon: 'Edit', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  team_weight_reset: { label: 'Reset', icon: 'RotateCcw', color: 'text-orange-600', bgColor: 'bg-orange-100' },

  // Experiment actions
  experiment_created: { label: 'Created', icon: 'Plus', color: 'text-green-600', bgColor: 'bg-green-100' },
  experiment_updated: { label: 'Updated', icon: 'Edit', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  experiment_activated: { label: 'Activated', icon: 'Play', color: 'text-green-600', bgColor: 'bg-green-100' },
  experiment_paused: { label: 'Paused', icon: 'Pause', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  experiment_resumed: { label: 'Resumed', icon: 'Play', color: 'text-green-600', bgColor: 'bg-green-100' },
  experiment_completed: { label: 'Completed', icon: 'Check', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  experiment_winner_applied: { label: 'Winner applied', icon: 'Trophy', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
};

/**
 * Entity type display configurations
 */
export const AUDIT_ENTITY_CONFIGS: Record<AuditEntityType, AuditEntityConfig> = {
  analysis_config: { label: 'Analysis Config', icon: 'Settings2' },
  prompt_template: { label: 'Prompt Template', icon: 'FileText' },
  classification_rule: { label: 'Classification Rule', icon: 'Filter' },
  classification_category: { label: 'Category', icon: 'Tag' },
  scoring_weight: { label: 'Scoring Weight', icon: 'Scale' },
  team_weight_override: { label: 'Team Override', icon: 'Users' },
  experiment: { label: 'Experiment', icon: 'Beaker' },
};

/**
 * Helper to get a human-readable action verb
 */
export function getActionVerb(action: AuditAction): string {
  const verbs: Record<string, string> = {
    config_created: 'created',
    config_updated: 'updated',
    config_activated: 'activated',
    config_archived: 'archived',
    config_deleted: 'deleted',
    config_duplicated: 'duplicated',
    config_rolled_back: 'rolled back',
    template_created: 'created',
    template_updated: 'updated',
    template_published: 'published',
    template_archived: 'archived',
    template_deleted: 'deleted',
    rule_created: 'created',
    rule_updated: 'updated',
    rule_enabled: 'enabled',
    rule_disabled: 'disabled',
    rule_deleted: 'deleted',
    category_created: 'created',
    category_updated: 'updated',
    category_deleted: 'deleted',
    weight_updated: 'updated weights for',
    team_weight_created: 'created team override for',
    team_weight_updated: 'updated team override for',
    team_weight_reset: 'reset team weights for',
    experiment_created: 'created',
    experiment_updated: 'updated',
    experiment_activated: 'activated',
    experiment_paused: 'paused',
    experiment_resumed: 'resumed',
    experiment_completed: 'completed',
    experiment_winner_applied: 'applied winner for',
  };

  return verbs[action] || action.replace(/_/g, ' ');
}

/**
 * Helper to get a human-readable entity type label
 */
export function getEntityLabel(entityType: AuditEntityType): string {
  return AUDIT_ENTITY_CONFIGS[entityType]?.label || entityType.replace(/_/g, ' ');
}
