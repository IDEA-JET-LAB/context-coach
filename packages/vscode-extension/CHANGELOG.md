# Changelog

All notable changes to the Contextor VS Code Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-12-24

### Added

- **Analytics Dashboard**: Real-time prompt analytics directly in VS Code sidebar
  - Overall score display with visual gauge
  - 5-dimension breakdown (Clarity, Context, Specificity, Actionability, Efficiency)
  - Trend sparklines showing score progression
  - Recent prompts list with individual scores

- **Authentication System**: Secure OAuth 2.0 authentication
  - Sign in with Contextor account
  - OAuth 2.0 with PKCE flow for enhanced security
  - Tokens stored in VS Code SecretStorage (OS keychain)
  - Automatic session persistence

- **Personalized Coaching**: AI-powered coaching tips
  - Pattern-based recommendations
  - Dimension-specific improvement suggestions
  - Before/after examples
  - Dismissible suggestions

- **Sidebar Panel**: Dedicated sidebar view
  - Activity Bar icon for quick access
  - Tabbed interface (Analytics, Coaching, Settings)
  - Connection status indicator
  - Responsive design

- **Settings & Configuration**: Customizable behavior
  - Configurable API endpoint for self-hosted instances
  - Adjustable auto-refresh interval (15-300 seconds)
  - Toggle notifications on/off
  - Status bar visibility control
  - Auto-refresh enable/disable

- **Status Bar Integration**: Quick status overview
  - Current score display
  - Connection status indicator
  - Click to open dashboard

### Security

- OAuth 2.0 with PKCE flow for secure authentication
- Tokens stored in VS Code SecretStorage (uses OS keychain)
- CSRF protection on authentication flow
- All API communication over HTTPS

### Technical

- Built with TypeScript and React
- Webview-based UI with VS Code theming support
- esbuild for fast compilation
- Vite for webview development

---

[Unreleased]: https://github.com/IDEA-JET-LAB/context-coach/compare/vscode-v0.1.0...HEAD
[0.1.0]: https://github.com/IDEA-JET-LAB/context-coach/releases/tag/vscode-v0.1.0
