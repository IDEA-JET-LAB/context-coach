# Contextor - Prompt Analytics for VS Code

![Version](https://img.shields.io/visual-studio-marketplace/v/ideajetlab.contextor-vscode)
![Installs](https://img.shields.io/visual-studio-marketplace/i/ideajetlab.contextor-vscode)
![Rating](https://img.shields.io/visual-studio-marketplace/r/ideajetlab.contextor-vscode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Track, analyze, and improve your AI prompting skills directly in VS Code.**

Contextor captures your prompts and provides real-time analytics, scoring across 5 dimensions, and personalized coaching tips to help you become a better prompt engineer.

## Features

### Real-time Analytics Dashboard

View your prompt statistics without leaving VS Code:

- **Overall Score**: See your average prompt quality score at a glance
- **Trend Analysis**: Track improvement over time with visual sparklines
- **5-Dimension Breakdown**: Understand your strengths and weaknesses across Clarity, Context, Specificity, Actionability, and Efficiency
- **Recent Prompts**: Review your latest prompts with individual scores

![Analytics Dashboard](images/screenshot-analytics.png)

### 5-Dimension Scoring System

Every prompt is analyzed across five key dimensions:

| Dimension | Description |
|-----------|-------------|
| **Clarity** | How clear and unambiguous is your prompt? |
| **Context** | Does your prompt provide sufficient background information? |
| **Specificity** | How specific and detailed is your request? |
| **Actionability** | Can the AI immediately act on your prompt? |
| **Efficiency** | Is your prompt concise without unnecessary verbosity? |

### Personalized Coaching Tips

Get actionable suggestions to improve your prompts:

- Pattern-based recommendations tailored to your prompting style
- Dimension-specific tips for areas that need improvement
- Before/after examples showing how to apply suggestions
- Dismissible suggestions so you can focus on what matters

![Coaching Tips](images/screenshot-coaching.png)

### Team Insights

For team leads and managers:

- Team-wide analytics and average scores
- Individual team member progress tracking
- Prompt quality trends across your organization
- Identify coaching opportunities

### Status Bar Integration

- Quick access to your current score
- Visual indicator of connection status
- One-click access to the full dashboard

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "Contextor"
4. Click **Install**

### From Command Line

```bash
code --install-extension ideajetlab.contextor-vscode
```

### From VSIX File

1. Download the `.vsix` file from [GitHub Releases](https://github.com/IDEA-JET-LAB/context-coach/releases)
2. In VS Code, go to Extensions
3. Click the `...` menu and select "Install from VSIX..."
4. Select the downloaded file

## Getting Started

1. **Open the Sidebar**: Click the Contextor icon in the Activity Bar (left side)
2. **Sign In**: Click "Sign In" and authenticate with your Contextor account
3. **Install the CLI**: Run `npx @contextor/cli init <your-project-token>` in your project
4. **Start Prompting**: Your prompts will be automatically captured and analyzed

### First-time Setup

```bash
# Install the Contextor CLI in your project
npx @contextor/cli init <project-token>

# The CLI installs a hook that captures prompts from Claude Code
# Your prompts will automatically appear in the VS Code extension
```

Get your project token from [contextor.co/dashboard](https://contextor.co/dashboard).

## Configuration

Access settings via `File > Preferences > Settings` and search for "Contextor".

| Setting | Description | Default |
|---------|-------------|---------|
| `contextor.apiEndpoint` | API endpoint URL for Contextor service. Change for self-hosted installations. | `https://contextor.co/api` |
| `contextor.refreshInterval` | Analytics auto-refresh interval in seconds (minimum 15). | `30` |
| `contextor.showNotifications` | Show notification messages for successful operations. | `true` |
| `contextor.showStatusBarItem` | Show Contextor score in the status bar. | `true` |
| `contextor.autoRefreshEnabled` | Enable automatic refresh of analytics data. | `true` |

### Self-Hosted Deployments

If you're running a self-hosted Contextor instance:

```json
{
  "contextor.apiEndpoint": "https://your-instance.example.com/api"
}
```

## Commands

Access commands via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| `Contextor: Show Analytics` | Open the analytics dashboard |
| `Contextor: Show Settings` | Open extension settings |
| `Contextor: Sign In` | Authenticate with your Contextor account |
| `Contextor: Sign Out` | Sign out of your account |

## Privacy & Security

We take your privacy seriously:

- **Secure Authentication**: OAuth 2.0 with PKCE flow for maximum security
- **Token Storage**: Authentication tokens are stored in VS Code's SecretStorage (uses your OS keychain)
- **Data Encryption**: All data is encrypted in transit (HTTPS) and at rest
- **You Control Your Data**: Only prompts from projects with the CLI installed are captured
- **No Prompt Content Stored**: By default, we only store metadata and scores, not full prompt text

See our [Privacy Policy](https://contextor.co/privacy) for complete details.

## Requirements

- **VS Code**: Version 1.85.0 or higher
- **Node.js**: Version 18+ (for CLI features)
- **Account**: Free Contextor account ([sign up](https://contextor.co))

## Troubleshooting

### Extension Not Showing Analytics

1. Ensure you're signed in (check for "Sign In" button in the sidebar)
2. Verify the CLI is installed in your project: check for `.claude/hooks/contextor-capture.sh`
3. Check the Output panel (View > Output > Contextor) for error messages

### Connection Issues

1. Check your internet connection
2. Verify the API endpoint is correct in settings
3. Try signing out and signing back in

### Prompts Not Being Captured

1. Ensure the Contextor CLI is installed: `npx @contextor/cli status`
2. Check that Claude Code hooks are enabled
3. Verify your project token is valid

### Getting Help

- [Documentation](https://contextor.co/docs)
- [GitHub Issues](https://github.com/IDEA-JET-LAB/context-coach/issues)
- [Discussions](https://github.com/IDEA-JET-LAB/context-coach/discussions)

## Contributing

We welcome contributions! See our [Contributing Guide](https://github.com/IDEA-JET-LAB/context-coach/blob/main/CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/IDEA-JET-LAB/context-coach.git
cd context-coach/packages/vscode-extension

# Install dependencies
npm install

# Build the extension
npm run build:all

# Open in VS Code for debugging
code .
# Press F5 to launch Extension Development Host
```

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

### 0.1.0 (Initial Release)

- Real-time analytics dashboard with 5-dimension scoring
- OAuth 2.0 authentication with secure token storage
- Personalized coaching tips
- Configurable settings
- Status bar integration

## License

MIT - See [LICENSE](LICENSE) for details.

---

**Made with care by [IDEA JET LAB](https://github.com/IDEA-JET-LAB)**

[Website](https://contextor.co) | [Documentation](https://contextor.co/docs) | [GitHub](https://github.com/IDEA-JET-LAB/context-coach)
