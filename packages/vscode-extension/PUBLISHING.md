# Publishing Guide for Contextor VS Code Extension

This document outlines the steps required to publish the Contextor VS Code extension to the marketplace.

## Prerequisites

### 1. Azure DevOps Publisher Account

1. Go to [Azure DevOps](https://dev.azure.com)
2. Create an organization (if you don't have one): `ideajetlab`
3. Go to [VS Code Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers)
4. Create a publisher with ID: `ideajetlab`
5. Fill in publisher details:
   - Display Name: IDEA JET LAB
   - Description: Developer tools and productivity extensions

### 2. Create Personal Access Token (PAT)

1. In Azure DevOps, go to User Settings > Personal Access Tokens
2. Create a new token with:
   - Name: `VSCE Publishing Token`
   - Organization: All accessible organizations
   - Scopes: Marketplace > Manage (check this specific scope)
   - Expiration: 1 year (renew before expiry)
3. Copy the token immediately (you can't see it again)

### 3. Store Token as GitHub Secret

Add to repository secrets (Settings > Secrets and Variables > Actions):
- `VSCE_PAT`: Your Azure DevOps Personal Access Token

### 4. Open VSX Registry (Optional - for Cursor, VSCodium)

1. Go to [Open VSX](https://open-vsx.org/)
2. Sign in with GitHub
3. Go to Settings > Access Tokens
4. Create a new token
5. Add to GitHub secrets as `OVSX_PAT`

## Required Screenshots

Before publishing, capture the following screenshots and place them in `images/`:

| File | Description | Dimensions | Notes |
|------|-------------|------------|-------|
| `screenshot-analytics.png` | Analytics dashboard with scores | 800x600+ | Show overall score, 5-dimension breakdown |
| `screenshot-coaching.png` | Coaching tips panel | 800x600+ | Show 2-3 coaching suggestions |
| `screenshot-prompt-detail.png` | Recent prompts list | 800x600+ | Show prompt cards with scores |
| `screenshot-auth.png` | Sign-in flow | 800x600+ | Show the sign-in button or OAuth screen |

### Screenshot Guidelines

1. Use a clean VS Code theme (Dark+ or Light+ preferred)
2. Use realistic but non-sensitive data
3. Ensure text is readable at thumbnail size
4. Show the extension in context (full VS Code window)
5. Use 2x resolution for retina displays (1600x1200 rendered at 800x600)

## Manual Publishing Steps

### Local Testing

```bash
# 1. Install dependencies
cd packages/vscode-extension
npm install
cd webviews/analytics && npm install && cd ../..

# 2. Build everything
npm run build:all

# 3. Package
npx vsce package

# 4. Test locally - install the VSIX
# In VS Code: Extensions > ... > Install from VSIX
# Select: contextor-vscode-0.1.0.vsix

# 5. Verify:
# - Icon appears in Activity Bar
# - Click icon to open sidebar
# - Sign in works
# - Analytics display correctly
```

### Publishing to VS Code Marketplace

```bash
# Login (requires PAT)
npx vsce login ideajetlab
# Enter your PAT when prompted

# Publish
npx vsce publish

# Or publish with version bump
npx vsce publish patch  # 0.1.0 -> 0.1.1
npx vsce publish minor  # 0.1.0 -> 0.2.0
npx vsce publish major  # 0.1.0 -> 1.0.0
```

### Publishing to Open VSX

```bash
# Using the VSIX file
npx ovsx publish contextor-vscode-0.1.0.vsix -p $OVSX_PAT
```

## Automated Publishing (GitHub Actions)

The extension is automatically published when:
1. A GitHub Release is created with a tag like `vscode-v0.1.0`
2. The workflow `.github/workflows/publish-vscode.yml` runs
3. Extension is published to both marketplaces

### Create a Release

```bash
# 1. Update version in package.json
npm version patch  # or minor/major

# 2. Commit and push
git add .
git commit -m "chore(vscode): bump version to 0.1.1"
git push

# 3. Create and push tag
git tag vscode-v0.1.1
git push --tags

# 4. Create GitHub Release
# Go to GitHub > Releases > New Release
# Select the tag, add release notes, publish
```

## Post-Publishing Checklist

- [ ] Verify listing appears at: https://marketplace.visualstudio.com/items?itemName=ideajetlab.contextor-vscode
- [ ] Install from marketplace on fresh VS Code
- [ ] Verify icon and branding appear correctly
- [ ] Test all features work
- [ ] Check Open VSX listing (if published)
- [ ] Update website/documentation with install button

## Troubleshooting

### "The Personal Access Token verification has failed"
- Token may be expired - create a new one
- Token may not have Marketplace scope - recreate with correct scope

### "Error: Extension 'ideajetlab.contextor-vscode' was not found"
- Publisher ID doesn't match - verify `ideajetlab` is your publisher ID
- Extension name must match package.json `name` field

### "ERROR  Extension already exists"
- Bump version number before publishing again
- Use `vsce publish patch` to auto-bump

### Screenshots not appearing
- Images must be in the `images/` folder
- Reference with relative paths in README: `![alt](images/screenshot.png)`
- Images must be included in the VSIX (check `.vscodeignore`)

## Maintenance

### Updating the Extension

1. Make changes
2. Update CHANGELOG.md
3. Bump version: `npm version patch`
4. Create release tag: `git tag vscode-v0.x.x`
5. Push and create GitHub Release

### Renewing PAT Token

Azure DevOps PAT tokens expire. Set a calendar reminder to:
1. Create new token before expiry
2. Update `VSCE_PAT` secret in GitHub
3. Test with manual workflow dispatch

### Removing Preview Flag

After the extension is stable (v1.0.0+):
1. Edit package.json
2. Remove `"preview": true` line
3. Publish new version
