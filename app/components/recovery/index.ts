// Recovery components for interrupted session handling

// Recovery Banner and variants
export {
  RecoveryBanner,
  RecoveryPrompt,
  RecoveryToast,
  type RecoveryBannerProps,
  type RecoveryPromptProps,
  type RecoveryToastProps,
  type InterruptedSession,
} from './recovery-banner';

// Session Snapshot
export { SessionSnapshot, type SessionSnapshotProps } from './session-snapshot';

// Recovery Detail Modal
export {
  RecoveryDetail,
  type RecoveryDetailProps,
  type RecoveryPromptItem,
  type RecoveryContext,
  type RecoveryOption,
} from './recovery-detail';

// VS Code Extension Notification Components
export {
  RecoveryNotification,
  RecoverySidebarIndicator,
  QuickResumeAction,
  NoRecoverySessions,
  type RecoveryNotificationProps,
  type RecoverySidebarIndicatorProps,
  type QuickResumeActionProps,
  type NoRecoverySessionsProps,
  type NotificationSeverity,
} from './recovery-notification';
