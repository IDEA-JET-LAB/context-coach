import React, { useState } from "react";

export type FeedbackCategory = "suggestion" | "question" | "bug" | "feature-request" | "other";

interface FeedbackPanelProps {
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (category: FeedbackCategory, message: string) => void;
  submitResult: { success: boolean; message: string } | null;
}

const CATEGORIES: { value: FeedbackCategory; label: string; placeholder: string }[] = [
  {
    value: "suggestion",
    label: "Suggestion",
    placeholder: "Share your idea for improving Contextor...",
  },
  {
    value: "question",
    label: "Question",
    placeholder: "What would you like to know about Contextor?",
  },
  {
    value: "bug",
    label: "Bug Report",
    placeholder: "Describe the issue you encountered. Include steps to reproduce if possible...",
  },
  {
    value: "feature-request",
    label: "Feature Request",
    placeholder: "Describe the feature you'd like to see in Contextor...",
  },
  {
    value: "other",
    label: "Other",
    placeholder: "Tell us what's on your mind...",
  },
];

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({
  isOpen,
  isLoading,
  onClose,
  onSubmit,
  submitResult,
}) => {
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [message, setMessage] = useState("");

  const selectedCategory = CATEGORIES.find((c) => c.value === category);
  const canSubmit = message.trim().length >= 10 && !isLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      onSubmit(category, message.trim());
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setCategory("suggestion");
      setMessage("");
      onClose();
    }
  };

  if (!isOpen) return null;

  // Show success state
  if (submitResult?.success) {
    return (
      <div className="feedback-overlay" onClick={handleClose}>
        <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
          <div className="feedback-success">
            <div className="feedback-success-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3>Thank You!</h3>
            <p>{submitResult.message}</p>
            <button className="feedback-close-btn" onClick={handleClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-overlay" onClick={handleClose}>
      <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-header">
          <h3>Send Feedback</h3>
          <button
            className="feedback-close-x"
            onClick={handleClose}
            disabled={isLoading}
            title="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="feedback-field">
            <label htmlFor="feedback-category">Category</label>
            <select
              id="feedback-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              disabled={isLoading}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="feedback-field">
            <label htmlFor="feedback-message">Message</label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={selectedCategory?.placeholder}
              rows={6}
              maxLength={2000}
              disabled={isLoading}
            />
            <span className="feedback-char-count">
              {message.length}/2000
            </span>
          </div>

          {submitResult && !submitResult.success && (
            <div className="feedback-error">
              {submitResult.message}
            </div>
          )}

          <div className="feedback-actions">
            <button
              type="button"
              className="feedback-cancel-btn"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="feedback-submit-btn"
              disabled={!canSubmit}
            >
              {isLoading ? (
                <>
                  <span className="feedback-spinner" />
                  Sending...
                </>
              ) : (
                "Send Feedback"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
