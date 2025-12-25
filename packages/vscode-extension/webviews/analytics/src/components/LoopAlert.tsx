import React from "react";

interface LoopAlertProps {
  /** Number of detected debugging loops */
  loopCount: number;
  /** Callback when user clicks to view details */
  onViewDetails?: () => void;
  /** Callback to dismiss the alert */
  onDismiss?: () => void;
  /** Current session/conversation with a loop */
  sessionName?: string;
}

/**
 * LoopAlert - Alert banner for debugging loop detection
 *
 * Displays a warning when the system detects a debugging loop pattern
 * in the user's conversation. Offers quick actions to view details or dismiss.
 */
export const LoopAlert: React.FC<LoopAlertProps> = ({
  loopCount,
  onViewDetails,
  onDismiss,
  sessionName,
}) => {
  if (loopCount === 0) return null;

  return (
    <div className="loop-alert">
      <div className="loop-alert-icon">
        <WarningIcon />
      </div>
      <div className="loop-alert-content">
        <div className="loop-alert-title">
          Debugging Loop Detected
        </div>
        <div className="loop-alert-message">
          {sessionName ? (
            <>Found in <strong>{sessionName}</strong></>
          ) : (
            <>{loopCount} loop{loopCount !== 1 ? "s" : ""} detected</>
          )}
        </div>
      </div>
      <div className="loop-alert-actions">
        {onViewDetails && (
          <button
            className="loop-alert-btn primary"
            onClick={onViewDetails}
            title="View loop details"
          >
            View
          </button>
        )}
        {onDismiss && (
          <button
            className="loop-alert-btn dismiss"
            onClick={onDismiss}
            title="Dismiss alert"
          >
            <DismissIcon />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * LoopAlertCompact - Smaller inline version for tab badges
 */
export const LoopAlertCompact: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null;

  return (
    <span className="loop-alert-badge" title={`${count} debugging loop${count !== 1 ? "s" : ""} detected`}>
      <WarningIcon />
      {count}
    </span>
  );
};

/**
 * LoopAlertToast - Toast notification variant
 */
export const LoopAlertToast: React.FC<{
  message: string;
  sessionId: string;
  onView: (sessionId: string) => void;
  onDismiss: () => void;
}> = ({ message, sessionId, onView, onDismiss }) => {
  return (
    <div className="loop-alert-toast">
      <div className="loop-alert-toast-header">
        <WarningIcon />
        <span>Debugging Loop Alert</span>
        <button className="toast-dismiss" onClick={onDismiss}>
          <DismissIcon />
        </button>
      </div>
      <div className="loop-alert-toast-body">
        <p>{message}</p>
        <button
          className="loop-alert-btn primary"
          onClick={() => onView(sessionId)}
        >
          View Conversation
        </button>
      </div>
    </div>
  );
};

// Icon components
const WarningIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const DismissIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default LoopAlert;
