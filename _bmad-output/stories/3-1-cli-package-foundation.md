# Story 3.1: CLI Package Foundation

Status: ready-for-dev

## Story

**As a** developer,
**I want** to install Contextor using npx,
**So that** I don't need to globally install anything.

## Acceptance Criteria

1. **Given** I have Node.js 18+ installed
   **When** I run `npx @contextor/cli --version`
   **Then** I see the CLI version number (0.1.0)
   **And** no global installation is required

2. **Given** the CLI package structure
   **When** this story is complete
   **Then** `packages/cli/` exists with proper npm package configuration
   **And** the `bin/contextor.js` entry point is configured
   **And** the package can be published to npm
   **And** TypeScript compilation produces valid JavaScript
   **And** the CLI works on macOS, Linux, and Windows

## Tasks / Subtasks

- [ ] **Task 1: Initialize CLI package structure** (AC: #2)
  - [ ] Create `packages/cli/` directory at project root
  - [ ] Run `npm init` to create `package.json` with name `@contextor/cli`
  - [ ] Set package version to `0.1.0`
  - [ ] Add `description`: "CLI for installing Contextor in your projects"
  - [ ] Configure `bin` field: `{ "contextor": "./dist/bin/contextor.js" }`
  - [ ] Add `files` array: `["dist", "README.md"]`
  - [ ] Set `type: "module"` for ESM support
  - [ ] Set `engines: { "node": ">=18.0.0" }` (required by architecture)

- [ ] **Task 2: Configure TypeScript for CLI** (AC: #2)
  - [ ] Create `packages/cli/tsconfig.json`
  - [ ] Set `target: "ES2022"` and `module: "NodeNext"`
  - [ ] Set `outDir: "./dist"` and `rootDir: "./src"`
  - [ ] Enable `strict: true` mode
  - [ ] Set `moduleResolution: "NodeNext"`
  - [ ] Add `declaration: true` for type definitions
  - [ ] Add `esModuleInterop: true` for CommonJS interop
  - [ ] Add `skipLibCheck: true` for faster builds
  - [ ] Add `forceConsistentCasingInFileNames: true`

- [ ] **Task 3: Add package dependencies** (AC: #2)
  - [ ] Add `typescript` as dev dependency
  - [ ] Add `commander` for CLI argument parsing
  - [ ] Add `chalk` for colored terminal output
  - [ ] Add `ora` for spinner animations
  - [ ] Add `@types/node` as dev dependency
  - [ ] Add build script: `"build": "tsc"`
  - [ ] Add dev script: `"dev": "tsc --watch"`
  - [ ] Add postbuild script to set executable permissions (Unix)

- [ ] **Task 4: Create CLI entry point** (AC: #1, #2)
  - [ ] Create `packages/cli/src/bin/contextor.ts`
  - [ ] Add shebang: `#!/usr/bin/env node`
  - [ ] Import and initialize Commander program
  - [ ] Set program name to `contextor`
  - [ ] Set version from package.json (dynamic read)
  - [ ] Add description: "CLI for installing Contextor in your projects"
  - [ ] Add `--version` and `--help` flags (Commander provides these)
  - [ ] Call `program.parse()` to process arguments
  - [ ] Handle uncaught errors with user-friendly messages

- [ ] **Task 5: Create source directory structure** (AC: #2)
  - [ ] Create `packages/cli/src/commands/` directory
  - [ ] Create `packages/cli/src/lib/` directory
  - [ ] Create placeholder `packages/cli/src/commands/init.ts` (exports empty function)
  - [ ] Create placeholder `packages/cli/src/commands/status.ts` (exports empty function)
  - [ ] Create placeholder `packages/cli/src/commands/uninstall.ts` (exports empty function)

- [ ] **Task 6: Set up build and test workflow** (AC: #1, #2)
  - [ ] Run `npm run build` to verify TypeScript compiles without errors
  - [ ] Verify `dist/` directory is created with JavaScript files
  - [ ] Test `node dist/bin/contextor.js --version` outputs "0.1.0"
  - [ ] Test `node dist/bin/contextor.js --help` shows help text
  - [ ] Add `.npmignore` to exclude `src/`, `tsconfig.json`, `node_modules/`
  - [ ] Add `dist/` to `.gitignore`

- [ ] **Task 7: Configure npm publish settings** (AC: #2)
  - [ ] Set `publishConfig.access: "public"` for scoped package
  - [ ] Add `prepublishOnly` script to run build
  - [ ] Verify package.json has required fields: `name`, `version`, `main`, `bin`, `engines`
  - [ ] Test with `npm pack` to verify package contents
  - [ ] Verify tarball contains only `dist/` and `README.md`

## Dev Notes

### Critical Constraints

| Constraint | Value | Source |
|------------|-------|--------|
| Node.js | >= 18.0.0 | architecture.md |
| Module system | ESM only | architecture.md |
| TypeScript | strict mode | architecture.md |
| Package location | `packages/cli/` | project-context.md |

### Package.json Reference

```json
{
  "name": "@contextor/cli",
  "version": "0.1.0",
  "description": "CLI for installing Contextor in your projects",
  "type": "module",
  "main": "./dist/index.js",
  "bin": {
    "contextor": "./dist/bin/contextor.js"
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc",
    "postbuild": "chmod +x dist/bin/contextor.js 2>/dev/null || true",
    "dev": "tsc --watch",
    "prepublishOnly": "npm run build"
  },
  "publishConfig": {
    "access": "public"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": ["contextor", "cli", "prompt", "capture"],
  "license": "MIT"
}
```

### TypeScript Configuration Reference

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### CLI Entry Point Reference

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('contextor')
  .description('CLI for installing Contextor in your projects')
  .version(packageJson.version);

// Commands registered in subsequent stories (3.2-3.7)

program.parse();
```

### Directory Structure

```
packages/cli/
├── src/
│   ├── bin/
│   │   └── contextor.ts
│   ├── commands/
│   │   ├── init.ts        # Placeholder
│   │   ├── status.ts      # Placeholder
│   │   └── uninstall.ts   # Placeholder
│   └── lib/
├── dist/                   # Built output (gitignored)
├── package.json
├── tsconfig.json
├── .npmignore
└── README.md
```

### Dependencies

```bash
cd packages/cli
npm install commander chalk ora
npm install -D typescript @types/node
```

### Local Testing

```bash
cd packages/cli
npm run build
node dist/bin/contextor.js --version  # Expected: 0.1.0
node dist/bin/contextor.js --help     # Expected: Usage info

# Optional: Link for npx testing
npm link
npx @contextor/cli --version
npm unlink @contextor/cli  # Cleanup after testing
```

### Anti-Patterns to Avoid

1. **DO NOT** use CommonJS (`require`) - use ESM imports only
2. **DO NOT** forget the shebang line (`#!/usr/bin/env node`)
3. **DO NOT** hardcode version - read from package.json dynamically
4. **DO NOT** include source files in npm package - only dist/
5. **DO NOT** use `any` type - TypeScript strict mode required
6. **DO NOT** skip `engines` field - Node.js 18+ required

### Story Dependencies

- **Depends on:** None (first story in Epic 3)
- **Blocks:** Stories 3.2-3.7 (all CLI functionality)

### References

- Epic: [Epic 3: CLI Installation Experience](_bmad-output/epics.md)
- Architecture: [CLI Package Architecture](_bmad-output/architecture.md#cli-package-architecture)
- [Commander.js Documentation](https://github.com/tj/commander.js)
- [npm Package Configuration](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|
| | | |

### File List

*To be filled by dev agent - list all files created/modified*
