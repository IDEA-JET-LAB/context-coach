# @contextor/cli

CLI for installing Contextor in your projects. Contextor is a prompt coaching system that helps development teams improve their AI prompting skills.

## Installation

No global installation required. Use `npx` to run the CLI:

```bash
npx @contextor/cli init <TOKEN>
```

## Requirements

- Node.js 18.0.0 or higher

## Commands

### `init <token>`

Initialize Contextor in your project using an install token from the dashboard.

```bash
npx @contextor/cli init ctx_abc123...
```

### `status`

Check the Contextor installation status and connection.

```bash
npx @contextor/cli status
```

### `uninstall`

Remove your personal Contextor configuration from the project.

```bash
npx @contextor/cli uninstall
```

## Getting Your Install Token

1. Log in to [app.contextor.co](https://app.contextor.co)
2. Navigate to your project settings
3. Copy the install token
4. Run `npx @contextor/cli init <token>`

## What Gets Created

- `.contextor/config.json` - Shared project configuration (committed to git)
- `.contextor/.user` - Personal configuration with API key (gitignored)
- `.claude/settings.json` - Claude Code hook configuration
- `.claude/hooks/contextor-capture.sh` - Capture script

## License

MIT
