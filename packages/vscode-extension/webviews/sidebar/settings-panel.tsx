import React, { useState } from 'react';
import {
  StatusIndicator,
  ConnectionStatus,
  UserIcon,
  LogoutIcon,
  CloudIcon,
  CloudOffIcon,
  ExternalLinkIcon,
  ContextorLogo,
} from '../components';

export interface User {
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface SettingsPanelProps {
  user?: User | null;
  isAuthenticated?: boolean;
  connectionStatus?: ConnectionStatus;
  coachingSensitivity?: number;
  notificationsEnabled?: boolean;
  realtimeCoachingEnabled?: boolean;
  version?: string;
  onLogin?: () => void;
  onLogout?: () => void;
  onSensitivityChange?: (value: number) => void;
  onNotificationsChange?: (enabled: boolean) => void;
  onRealtimeCoachingChange?: (enabled: boolean) => void;
  onOpenDocs?: () => void;
  onOpenSupport?: () => void;
}

// Avatar component
const Avatar: React.FC<{ user: User; size?: number }> = ({ user, size = 32 }) => {
  const fontSize = size * 0.4;

  if (user.avatarUrl) {
    return (
      <div className="settings-panel__avatar" style={{ width: size, height: size }}>
        <img
          src={user.avatarUrl}
          alt={user.name || user.email}
          className="settings-panel__avatar-img"
        />
      </div>
    );
  }

  const initials = (user.name || user.email)
    .split(/[\s@]/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <div className="settings-panel__avatar" style={{ width: size, height: size, fontSize }}>
      {initials}
    </div>
  );
};

// Toggle switch component
const Toggle: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ label, description, checked, onChange, disabled }) => {
  return (
    <div className="settings-panel__toggle">
      <div className="settings-panel__toggle-label-container">
        <div className={`settings-panel__toggle-label${description ? ' settings-panel__toggle-label--with-desc' : ''}`}>
          {label}
        </div>
        {description && <div className="settings-panel__toggle-description">{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`settings-panel__toggle-switch ${checked ? 'settings-panel__toggle-switch--checked' : 'settings-panel__toggle-switch--unchecked'}`}
      >
        <div className={`settings-panel__toggle-thumb ${checked ? 'settings-panel__toggle-thumb--checked' : 'settings-panel__toggle-thumb--unchecked'}`} />
      </button>
    </div>
  );
};

// Slider component
const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  labels?: string[];
  onChange: (value: number) => void;
}> = ({ label, value, min, max, labels, onChange }) => {
  const fillPercentage = ((value - min) / (max - min)) * 100;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newValue = Math.round(min + percentage * (max - min));
    onChange(Math.max(min, Math.min(max, newValue)));
  };

  return (
    <div className="settings-panel__slider">
      <div className="settings-panel__slider-header">
        <span className="settings-panel__slider-label">{label}</span>
        <span className="settings-panel__slider-value">{value}</span>
      </div>
      <div className="settings-panel__slider-track" onClick={handleClick}>
        <div className="settings-panel__slider-fill" style={{ width: `${fillPercentage}%` }} />
        <div className="settings-panel__slider-thumb" style={{ left: `${fillPercentage}%` }} />
      </div>
      {labels && (
        <div className="settings-panel__slider-labels">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  user,
  isAuthenticated = false,
  connectionStatus = 'disconnected',
  coachingSensitivity = 3,
  notificationsEnabled = true,
  realtimeCoachingEnabled = true,
  version = '1.0.0',
  onLogin,
  onLogout,
  onSensitivityChange,
  onNotificationsChange,
  onRealtimeCoachingChange,
  onOpenDocs,
  onOpenSupport,
}) => {
  const [sensitivity, setSensitivity] = useState(coachingSensitivity);
  const [notifications, setNotifications] = useState(notificationsEnabled);
  const [realtimeCoaching, setRealtimeCoaching] = useState(realtimeCoachingEnabled);

  return (
    <div>
      {/* Authentication Section */}
      <div className="settings-panel__section">
        <div className="settings-panel__section-title">Account</div>
        <div className="settings-panel__auth-card">
          {isAuthenticated && user ? (
            <>
              <div className="settings-panel__user-info">
                <Avatar user={user} size={36} />
                <div className="settings-panel__user-details">
                  {user.name && <div className="settings-panel__user-name">{user.name}</div>}
                  <div className="settings-panel__user-email">{user.email}</div>
                </div>
              </div>
              <button className="settings-panel__button settings-panel__button--secondary" onClick={onLogout}>
                <LogoutIcon size={14} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <div className="settings-panel__user-info">
                <div className="settings-panel__avatar settings-panel__avatar--placeholder" style={{ width: 36, height: 36 }}>
                  <UserIcon size={18} color="var(--ctx-foreground-muted)" />
                </div>
                <div className="settings-panel__user-details">
                  <div className="settings-panel__user-name settings-panel__user-name--muted">
                    Not signed in
                  </div>
                  <div className="settings-panel__user-email">Sign in to sync your data</div>
                </div>
              </div>
              <button className="settings-panel__button settings-panel__button--primary" onClick={onLogin}>
                Connect to Contextor
              </button>
            </>
          )}
        </div>
      </div>

      {/* Connection Status */}
      <div className="settings-panel__section">
        <div className="settings-panel__section-title">Connection</div>
        <div className="settings-panel__connection-row">
          <div className="settings-panel__connection-label">
            {connectionStatus === 'disconnected' ? (
              <CloudOffIcon size={16} color="var(--ctx-foreground-muted)" />
            ) : (
              <CloudIcon size={16} />
            )}
            Contextor Cloud
          </div>
          <StatusIndicator status={connectionStatus} showLabel size="md" />
        </div>
      </div>

      {/* Preferences Section */}
      <div className="settings-panel__section">
        <div className="settings-panel__section-title">Preferences</div>

        <Slider
          label="Coaching Sensitivity"
          value={sensitivity}
          min={1}
          max={5}
          labels={['Minimal', 'Balanced', 'Active']}
          onChange={(v) => {
            setSensitivity(v);
            onSensitivityChange?.(v);
          }}
        />

        <Toggle
          label="Notifications"
          description="Show notifications for new coaching suggestions"
          checked={notifications}
          onChange={(v) => {
            setNotifications(v);
            onNotificationsChange?.(v);
          }}
        />

        <Toggle
          label="Real-time Coaching"
          description="Analyze prompts as you type"
          checked={realtimeCoaching}
          onChange={(v) => {
            setRealtimeCoaching(v);
            onRealtimeCoachingChange?.(v);
          }}
        />
      </div>

      {/* About Section */}
      <div>
        <div className="settings-panel__section-title">About</div>
        <div className="settings-panel__about-card">
          <ContextorLogo size={24} color="var(--ctx-foreground-muted)" />
          <div className="settings-panel__about-details">
            <div className="settings-panel__about-name">Contextor</div>
            <div className="settings-panel__about-version">v{version}</div>
          </div>
        </div>

        <div className="settings-panel__links-container">
          <button className="settings-panel__link" onClick={onOpenDocs}>
            Documentation
            <ExternalLinkIcon size={12} />
          </button>
          <button className="settings-panel__link" onClick={onOpenSupport}>
            Support
            <ExternalLinkIcon size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
