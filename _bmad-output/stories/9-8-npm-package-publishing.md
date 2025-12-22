# Story 9.8: npm Package Publishing (@contextor/cli)

Status: Ready for Dev
Solo Dev: Yes
Epic: 9 - Production Deployment & Infrastructure
Depends On: Epic 3 (CLI implementation), Story 9.4 (CI/CD for automated publish)

## Story

**As a** solo developer,
**I want** to publish the CLI package to npm,
**So that** users can install Contextor with `npx @contextor/cli init`.

## Acceptance Criteria

1. **Given** an npm account
   **When** I set up the @contextor organization
   **Then** the organization is created
   **And** I can publish packages under @contextor scope

2. **Given** the CLI package in `packages/cli/`
   **When** I publish to npm
   **Then** the package is available as `@contextor/cli`
   **And** users can run `npx @contextor/cli --version`

3. **Given** a new version is ready
   **When** I create a GitHub release with a version tag
   **Then** GitHub Actions automatically publishes to npm
   **And** the version follows semantic versioning (e.g., 1.0.0)

4. **Given** the published package
   **When** users view it on npm
   **Then** they see a README with installation instructions
   **And** the package has appropriate keywords and metadata

## Tasks / Subtasks

- [ ] **Task 1: Create npm account and organization** (AC: #1)
  - [ ] Go to https://www.npmjs.com/
  - [ ] Create account or log in
  - [ ] Create organization: `contextor`
  - [ ] Go to Organizations > contextor > Settings
  - [ ] Verify organization can publish public packages

- [ ] **Task 2: Generate npm access token** (AC: #1)
  - [ ] Go to Access Tokens in npm profile
  - [ ] Generate new token:
    - [ ] Type: Automation (for CI/CD)
    - [ ] Scope: Read and write
  - [ ] Copy token immediately (only shown once)
  - [ ] Add to GitHub Secrets: `NPM_TOKEN`

- [ ] **Task 3: Prepare package.json for publishing** (AC: #2, #4)
  - [ ] Update `packages/cli/package.json`:
    ```json
    {
      "name": "@contextor/cli",
      "version": "1.0.0",
      "description": "CLI tool for installing Contextor prompt coaching in your projects",
      "main": "dist/index.js",
      "bin": {
        "contextor": "./dist/bin/contextor.js"
      },
      "files": [
        "dist",
        "README.md"
      ],
      "keywords": [
        "contextor",
        "claude",
        "prompts",
        "ai",
        "coaching",
        "cli"
      ],
      "repository": {
        "type": "git",
        "url": "https://github.com/YOUR_USERNAME/contextor.git",
        "directory": "packages/cli"
      },
      "homepage": "https://contextor.co",
      "author": "Edgars <your-email>",
      "license": "MIT",
      "publishConfig": {
        "access": "public"
      }
    }
    ```

- [ ] **Task 4: Create CLI README** (AC: #4)
  - [ ] Create `packages/cli/README.md`
  - [ ] Include:
    - [ ] Installation instructions
    - [ ] Usage examples
    - [ ] Available commands
    - [ ] Link to main documentation

- [ ] **Task 5: Test local publish** (AC: #2)
  - [ ] Login to npm: `npm login`
  - [ ] Dry run: `npm publish --dry-run`
  - [ ] Verify package contents look correct
  - [ ] Check no sensitive files included

- [ ] **Task 6: Create npm publish workflow** (AC: #3)
  - [ ] Create `.github/workflows/publish-cli.yml`
  - [ ] Trigger on release creation
  - [ ] Build, test, and publish to npm
  - [ ] See Dev Notes for workflow

- [ ] **Task 7: Publish initial version** (AC: #2, #3)
  - [ ] Ensure version is `1.0.0` (or `0.1.0` for beta)
  - [ ] Create GitHub release:
    - [ ] Tag: `cli-v1.0.0`
    - [ ] Title: `@contextor/cli v1.0.0`
    - [ ] Description: Initial release notes
  - [ ] Watch Actions for publish workflow
  - [ ] Verify on npm: https://www.npmjs.com/package/@contextor/cli

- [ ] **Task 8: Test installation** (AC: #2)
  - [ ] In a fresh directory: `npx @contextor/cli --version`
  - [ ] Verify version matches published version
  - [ ] Test `npx @contextor/cli init <token>` flow

## Dev Notes

### CRITICAL: API Endpoint Convention in CLI

**The CLI generates hooks that must use correct URL construction.**

The `API_ENDPOINT` stored in `.contextor/config.json` INCLUDES the `/api` prefix:
```json
{
  "api_endpoint": "https://contextor.co/api"
}
```

The capture hook in `packages/cli/src/lib/hooks.ts` must append ONLY the route:
```bash
# CORRECT (in generated hook):
curl "${API_ENDPOINT}/prompts/capture"
# Result: https://contextor.co/api/prompts/capture

# WRONG - causes silent 404 failures:
curl "${API_ENDPOINT}/api/prompts/capture"
# Result: https://contextor.co/api/api/prompts/capture
```

**Verify before publishing:** Test the generated hook with both local and production endpoints.

### npm Publish Workflow

```yaml
# .github/workflows/publish-cli.yml
name: Publish CLI to npm

on:
  release:
    types: [published]

jobs:
  publish:
    # Only run for CLI releases
    if: startsWith(github.event.release.tag_name, 'cli-v')
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'
          cache-dependency-path: packages/cli/package-lock.json

      - name: Install dependencies
        working-directory: packages/cli
        run: npm ci

      - name: Build
        working-directory: packages/cli
        run: npm run build

      - name: Run tests
        working-directory: packages/cli
        run: npm test

      - name: Publish to npm
        working-directory: packages/cli
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### CLI README Template

```markdown
# @contextor/cli

The official CLI for installing [Contextor](https://contextor.co) in your development projects.

## Installation

No installation required! Use npx to run directly:

\`\`\`bash
npx @contextor/cli init <install-token>
\`\`\`

## Usage

### Initialize Contextor

Get your install token from the [Contextor dashboard](https://contextor.co/projects),
then run:

\`\`\`bash
npx @contextor/cli init <your-install-token>
\`\`\`

This will:
- Create `.contextor/config.json` (shared project config)
- Create `.contextor/.user` (your personal config)
- Configure Claude Code hooks for automatic capture
- Test the connection to Contextor cloud

### Check Status

\`\`\`bash
npx @contextor/cli status
\`\`\`

### Uninstall

\`\`\`bash
npx @contextor/cli uninstall
\`\`\`

## Requirements

- Node.js 18+
- Claude Code installed (for hook integration)

## Documentation

Full documentation at [contextor.co/docs](https://contextor.co/docs)

## License

MIT
```

### Semantic Versioning Strategy

```
MAJOR.MINOR.PATCH

1.0.0 - Initial stable release
1.0.1 - Bug fixes
1.1.0 - New features (backward compatible)
2.0.0 - Breaking changes

For pre-release:
0.1.0 - Alpha/Beta
1.0.0-beta.1 - Pre-release
```

### Version Bump Process

1. Update version in `packages/cli/package.json`
2. Update CHANGELOG.md (if exists)
3. Commit: `git commit -m "chore(cli): bump version to X.Y.Z"`
4. Push to main
5. Create GitHub release with tag `cli-vX.Y.Z`
6. Workflow publishes automatically

### npm Commands Reference

```bash
# Login to npm
npm login

# View package info
npm view @contextor/cli

# Check who owns package
npm owner ls @contextor/cli

# Deprecate old version
npm deprecate @contextor/cli@"<1.0.0" "Please upgrade to 1.0.0"

# Unpublish (within 72 hours only)
npm unpublish @contextor/cli@1.0.0

# View download stats
npm stats @contextor/cli
```

### Package Files (.npmignore alternative)

Using `files` in package.json is preferred over `.npmignore`:

```json
{
  "files": [
    "dist",
    "README.md"
  ]
}
```

This ensures only these files are published:
- `dist/` - Compiled JavaScript
- `README.md` - Documentation
- `package.json` - Always included
- `LICENSE` - Always included if present

### Troubleshooting

**"You must be logged in to publish":**
```bash
npm login
npm whoami  # verify login
```

**"Package name already taken":**
- Use scoped package: `@contextor/cli`
- Verify organization exists and you have access

**"Cannot publish over existing version":**
- You cannot republish the same version
- Bump version number and try again

**"Missing required fields":**
- Ensure `name`, `version`, `main` are in package.json
- Run `npm publish --dry-run` to check

## Dependencies

- Story 9.4: CI/CD pipeline (for automated publishing)
- Epic 3: CLI implementation complete

## Definition of Done

- [ ] npm account created
- [ ] @contextor organization created
- [ ] NPM_TOKEN added to GitHub Secrets
- [ ] package.json configured for publishing
- [ ] CLI README created
- [ ] Publish workflow created
- [ ] Initial version published to npm
- [ ] `npx @contextor/cli --version` works
- [ ] Installation tested in fresh environment
