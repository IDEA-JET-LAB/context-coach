import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

const GITIGNORE_ENTRY = '.contextor/.user';

/**
 * Check if .contextor/.user is already covered by gitignore patterns
 */
function isEntryCovered(content: string): boolean {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue;
    // Check for exact match or broader patterns
    if (
      trimmed === GITIGNORE_ENTRY ||
      trimmed === '.contextor/' ||
      trimmed === '.contextor' ||
      trimmed === '.contextor/*'
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Add the gitignore entry to existing content
 */
function addEntry(content: string): string {
  if (!content.trim()) {
    return `# Contextor user configuration (personal, not shared)\n${GITIGNORE_ENTRY}\n`;
  }
  // Ensure file ends with newline before adding our entry
  const base = content.endsWith('\n') ? content : content + '\n';
  return base + `\n# Contextor user configuration\n${GITIGNORE_ENTRY}\n`;
}

/**
 * Ensure .contextor/.user is in .gitignore
 * Returns true if .gitignore was modified, false otherwise
 */
export async function ensureGitignore(cwd: string): Promise<boolean> {
  const gitignorePath = join(cwd, '.gitignore');
  let content = '';
  let exists = false;

  try {
    await access(gitignorePath, constants.F_OK);
    content = await readFile(gitignorePath, 'utf-8');
    exists = true;
  } catch {
    exists = false;
  }

  // Check if entry is already covered
  if (isEntryCovered(content)) {
    return false;
  }

  // Add entry
  const newContent = addEntry(content);
  await writeFile(gitignorePath, newContent, 'utf-8');
  return true;
}
