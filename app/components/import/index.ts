// Import components for transcript import and history management

// Legacy components (for backwards compatibility)
export { SessionPreviewCard, type SessionPreviewCardProps, type SessionPreviewData, type ImportStatus } from './session-preview-card';
export { ImportProgressBar, type ImportProgressBarProps, type ImportPhase } from './progress-bar';
export { FileTree, type FileTreeProps, type FileTreeNode } from './file-tree';

// New import modal and flow components
export {
  ImportModal,
  ImportTriggerButton,
  type ImportModalProps,
  type ImportTriggerButtonProps,
  type ImportStep,
} from './import-modal';

export {
  TranscriptBrowser,
  type TranscriptBrowserProps,
  type TranscriptFile,
  type TranscriptFolder,
  type TranscriptStatus,
} from './transcript-browser';

export {
  ImportPreview,
  type ImportPreviewProps,
  type SessionPreview,
  type SessionPromptSample,
  type SessionDuplicateStatus,
  type ConflictResolution,
} from './import-preview';

export {
  ImportProgress,
  ImportCompleteSummary,
  type ImportProgressProps,
  type ImportCompleteSummaryProps,
  type ImportProgressState,
  type ImportFileProgress,
  type FileImportStatus,
} from './import-progress';

export {
  ImportHistory,
  type ImportHistoryProps,
  type ImportBatch,
  type ImportBatchFile,
  type ImportBatchStatus,
} from './import-history';
