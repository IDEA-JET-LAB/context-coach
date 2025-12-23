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
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: 'var(--ctx-button-bg)',
    color: 'var(--ctx-button-fg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.4,
    fontWeight: 600,
    overflow: 'hidden',
  };

  if (user.avatarUrl) {
    return (
      <div style={style}>
        <img
          src={user.avatarUrl}
          alt={user.name || user.email}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  }

  const initials = (user.name || user.email)
    .split(/[\s@]/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return <div style={style}>{initials}</div>;
};

// Toggle switch component
const Toggle: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ label, description, checked, onChange, disabled }) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '10px 0',
    gap: '12px',
  };

  const labelContainerStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--ctx-foreground)',
    marginBottom: description ? '2px' : 0,
  };

  const descStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--ctx-foreground-muted)',
    lineHeight: '1.4',
  };

  const switchStyle: React.CSSProperties = {
    position: 'relative',
    width: '32px',
    height: '18px',
    backgroundColor: checked ? 'var(--ctx-button-bg)' : 'var(--ctx-button-secondary-bg)',
    borderRadius: '9px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background-color 150ms ease',
    flexShrink: 0,
  };

  const thumbStyle: React.CSSProperties = {
    position: 'absolute',
    top: '2px',
    left: checked ? '16px' : '2px',
    width: '14px',
    height: '14px',
    backgroundColor: 'white',
    borderRadius: '50%',
    transition: 'left 150ms ease',
  };

  return (
    <div style={containerStyle}>
      <div style={labelContainerStyle}>
        <div style={labelStyle}>{label}</div>
        {description && <div style={descStyle}>{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        style={switchStyle}
      >
        <div style={thumbStyle} />
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
  const containerStyle: React.CSSProperties = {
    padding: '10px 0',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--ctx-foreground)',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '11px',
    fontFamily: 'var(--ctx-font-mono)',
    color: 'var(--ctx-foreground-muted)',
  };

  const trackStyle: React.CSSProperties = {
    position: 'relative',
    height: '4px',
    backgroundColor: 'var(--ctx-button-secondary-bg)',
    borderRadius: '2px',
    cursor: 'pointer',
  };

  const fillPercentage = ((value - min) / (max - min)) * 100;

  const fillStyle: React.CSSProperties = {
    position: 'absolute',
    height: '100%',
    width: `${fillPercentage}%`,
    backgroundColor: 'var(--ctx-button-bg)',
    borderRadius: '2px',
    transition: 'width 100ms ease',
  };

  const thumbStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: `${fillPercentage}%`,
    width: '14px',
    height: '14px',
    backgroundColor: 'var(--ctx-button-bg)',
    border: '2px solid var(--ctx-background)',
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
    cursor: 'grab',
    transition: 'transform 100ms ease',
  };

  const labelsStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '6px',
    fontSize: '9px',
    color: 'var(--ctx-foreground-muted)',
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newValue = Math.round(min + percentage * (max - min));
    onChange(Math.max(min, Math.min(max, newValue)));
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={labelStyle}>{label}</span>
        <span style={valueStyle}>{value}</span>
      </div>
      <div style={trackStyle} onClick={handleClick}>
        <div style={fillStyle} />
        <div style={thumbStyle} />
      </div>
      {labels && (
        <div style={labelsStyle}>
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

  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--ctx-border-subtle)',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ctx-foreground-muted)',
    marginBottom: '12px',
  };

  const authCardStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border-subtle)',
    borderRadius: '4px',
  };

  const userInfoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  };

  const userDetailsStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const userNameStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--ctx-foreground)',
    marginBottom: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const userEmailStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--ctx-foreground-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 500,
    borderRadius: '3px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 100ms ease',
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'var(--ctx-button-bg)',
    color: 'var(--ctx-button-fg)',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'var(--ctx-button-secondary-bg)',
    color: 'var(--ctx-button-secondary-fg)',
  };

  const connectionRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border-subtle)',
    borderRadius: '4px',
  };

  const connectionLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'var(--ctx-foreground)',
  };

  const linkStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 0',
    fontSize: '12px',
    color: 'var(--ctx-link)',
    textDecoration: 'none',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    transition: 'color 100ms ease',
  };

  const aboutStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'var(--ctx-surface)',
    border: '1px solid var(--ctx-border-subtle)',
    borderRadius: '4px',
  };

  const versionStyle: React.CSSProperties = {
    fontFamily: 'var(--ctx-font-mono)',
    fontSize: '10px',
    color: 'var(--ctx-foreground-muted)',
  };

  return (
    <div>
      {/* Authentication Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Account</div>
        <div style={authCardStyle}>
          {isAuthenticated && user ? (
            <>
              <div style={userInfoStyle}>
                <Avatar user={user} size={36} />
                <div style={userDetailsStyle}>
                  {user.name && <div style={userNameStyle}>{user.name}</div>}
                  <div style={userEmailStyle}>{user.email}</div>
                </div>
              </div>
              <button
                style={secondaryButtonStyle}
                onClick={onLogout}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--ctx-button-secondary-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--ctx-button-secondary-bg)';
                }}
              >
                <LogoutIcon size={14} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <div style={{ ...userInfoStyle, marginBottom: '12px' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: 'var(--ctx-button-secondary-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UserIcon size={18} color="var(--ctx-foreground-muted)" />
                </div>
                <div style={userDetailsStyle}>
                  <div style={{ ...userNameStyle, color: 'var(--ctx-foreground-muted)' }}>
                    Not signed in
                  </div>
                  <div style={userEmailStyle}>Sign in to sync your data</div>
                </div>
              </div>
              <button
                style={primaryButtonStyle}
                onClick={onLogin}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'brightness(1)';
                }}
              >
                Connect to Contextor
              </button>
            </>
          )}
        </div>
      </div>

      {/* Connection Status */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Connection</div>
        <div style={connectionRowStyle}>
          <div style={connectionLabelStyle}>
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
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Preferences</div>

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
        <div style={sectionTitleStyle}>About</div>
        <div style={aboutStyle}>
          <ContextorLogo size={24} color="var(--ctx-foreground-muted)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ctx-foreground)' }}>
              Contextor
            </div>
            <div style={versionStyle}>v{version}</div>
          </div>
        </div>

        <div style={{ marginTop: '12px' }}>
          <button
            style={linkStyle}
            onClick={onOpenDocs}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--ctx-link-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ctx-link)';
            }}
          >
            Documentation
            <ExternalLinkIcon size={12} />
          </button>
          <button
            style={linkStyle}
            onClick={onOpenSupport}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--ctx-link-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ctx-link)';
            }}
          >
            Support
            <ExternalLinkIcon size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
