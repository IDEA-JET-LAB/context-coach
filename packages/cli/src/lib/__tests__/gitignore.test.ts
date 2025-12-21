import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ensureGitignore } from '../gitignore.js';

describe('gitignore', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `contextor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('ensureGitignore', () => {
    it('creates .gitignore if not exists', async () => {
      const result = await ensureGitignore(testDir);

      expect(result).toBe(true);
      expect(existsSync(join(testDir, '.gitignore'))).toBe(true);
    });

    it('creates file with header comment and entry', async () => {
      await ensureGitignore(testDir);

      const content = readFileSync(join(testDir, '.gitignore'), 'utf-8');
      expect(content).toContain('# Contextor');
      expect(content).toContain('.contextor/.user');
    });

    it('appends to existing .gitignore', async () => {
      writeFileSync(join(testDir, '.gitignore'), 'node_modules/\n');

      const result = await ensureGitignore(testDir);

      expect(result).toBe(true);
      const content = readFileSync(join(testDir, '.gitignore'), 'utf-8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('.contextor/.user');
    });

    it('adds newline before entry if file does not end with newline', async () => {
      writeFileSync(join(testDir, '.gitignore'), 'node_modules/');

      await ensureGitignore(testDir);

      const content = readFileSync(join(testDir, '.gitignore'), 'utf-8');
      expect(content).toContain('node_modules/\n');
    });

    it('returns false if entry already exists', async () => {
      writeFileSync(join(testDir, '.gitignore'), '.contextor/.user\n');

      const result = await ensureGitignore(testDir);

      expect(result).toBe(false);
    });

    it('returns false if broader .contextor/ pattern exists', async () => {
      writeFileSync(join(testDir, '.gitignore'), '.contextor/\n');

      const result = await ensureGitignore(testDir);

      expect(result).toBe(false);
    });

    it('returns false if .contextor pattern exists', async () => {
      writeFileSync(join(testDir, '.gitignore'), '.contextor\n');

      const result = await ensureGitignore(testDir);

      expect(result).toBe(false);
    });

    it('returns false if .contextor/* pattern exists', async () => {
      writeFileSync(join(testDir, '.gitignore'), '.contextor/*\n');

      const result = await ensureGitignore(testDir);

      expect(result).toBe(false);
    });

    it('ignores comment lines when checking', async () => {
      writeFileSync(join(testDir, '.gitignore'), '# .contextor/.user\nnode_modules/\n');

      const result = await ensureGitignore(testDir);

      expect(result).toBe(true);
      const content = readFileSync(join(testDir, '.gitignore'), 'utf-8');
      expect(content.match(/\.contextor\/\.user/g)?.length).toBe(2); // Comment + actual entry
    });

    it('does not add duplicate entries', async () => {
      writeFileSync(join(testDir, '.gitignore'), '.contextor/.user\n');

      await ensureGitignore(testDir);
      await ensureGitignore(testDir);

      const content = readFileSync(join(testDir, '.gitignore'), 'utf-8');
      expect(content.match(/\.contextor\/\.user/g)?.length).toBe(1);
    });
  });
});
