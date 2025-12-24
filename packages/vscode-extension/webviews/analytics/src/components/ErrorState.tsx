import React from "react";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  onSignOut?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, onSignOut }) => {
  // Check if this is an auth-related error
  const isAuthError = message.toLowerCase().includes("token") ||
                      message.toLowerCase().includes("auth") ||
                      message.toLowerCase().includes("expired") ||
                      message.toLowerCase().includes("sign in");

  return (
    <div className="error-container">
      <div className="error-icon">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="error-title">Something went wrong</h3>
      <p className="error-message">{message}</p>
      <div className="error-actions">
        {onRetry && (
          <button className="retry-button" onClick={onRetry}>
            Try Again
          </button>
        )}
        {isAuthError && onSignOut && (
          <button className="sign-out-text-button" onClick={onSignOut}>
            Sign Out & Sign In Again
          </button>
        )}
      </div>
    </div>
  );
};
