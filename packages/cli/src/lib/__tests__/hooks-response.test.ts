import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getResponseScriptContent,
  createResponseScript,
  configureStopHook,
  removeStopHook,
  CLAUDE_DIR,
  HOOKS_DIR,
  RESPONSE_SCRIPT,
  type ClaudeSettings,
  type HookEntry,
} from '../hooks.js';

// Helper to create a hook entry in the new format
function createHookEntry(command: string, timeout?: number): HookEntry {
  const hook: { type: 'command'; command: string; timeout?: number } = { type: 'command', command };
  if (timeout) hook.timeout = timeout;
  return { matcher: '.*', hooks: [hook] };
}

describe('hooks-response', () => {
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

  describe('getResponseScriptContent', () => {
    it('returns a bash script', () => {
      const content = getResponseScriptContent();
      expect(content.startsWith('#!/bin/bash')).toBe(true);
    });

    it('contains response capture header comment', () => {
      const content = getResponseScriptContent();
      expect(content).toContain('Contextor Response Capture');
      expect(content).toContain('Stop hook');
    });

    // AC #2: Hook Input Parsing
    describe('hook input parsing', () => {
      it('reads input from stdin', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('HOOK_INPUT=$(cat)');
      });

      it('extracts transcript_path from input JSON', () => {
        const content = getResponseScriptContent();
        expect(content).toContain("TRANSCRIPT_PATH=$(echo \"$HOOK_INPUT\" | jq -r '.transcript_path // empty')");
      });

      it('validates transcript_path is provided', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('[[ -z "$TRANSCRIPT_PATH" ]]');
      });

      it('validates transcript file exists', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('[[ ! -f "$TRANSCRIPT_PATH" ]]');
      });

      it('exits silently if transcript_path missing', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('exit 0');
      });
    });

    // AC #3: Last Assistant Message Extraction
    describe('last assistant message extraction', () => {
      it('uses grep to filter assistant messages', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('grep \'"type":"assistant"\'');
      });

      it('uses tail to get last matching line', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('tail -1');
      });

      it('handles empty result gracefully', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('[[ -z "$LAST_ASSISTANT" ]]');
      });
    });

    // AC #4: Response Data Extraction
    describe('response data extraction', () => {
      it('extracts text content with jq', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('.message.content[]?');
        expect(content).toContain('select(.type == "text")');
        expect(content).toContain('.text');
      });

      it('extracts thinking content with jq', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('select(.type == "thinking")');
        expect(content).toContain('.thinking');
      });

      it('extracts tool uses with jq', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('select(.type == "tool_use")');
        expect(content).toContain('{name, id}');
      });

      it('extracts model from message', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('.message.model');
      });

      it('extracts usage statistics', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('.message.usage');
      });

      it('extracts stop_reason', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('.message.stop_reason');
      });

      it('extracts message UUID', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('.uuid');
      });

      it('calculates thinking summary (first 500 chars)', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('THINKING_SUMMARY="${THINKING_TEXT:0:500}"');
      });

      it('calculates thinking word count', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('THINKING_WORD_COUNT');
        expect(content).toContain('wc -w');
      });
    });

    // AC #5: API Call
    describe('API call', () => {
      it('contains curl command', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('curl');
      });

      it('posts to /responses/capture endpoint', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('${API_ENDPOINT}/responses/capture');
      });

      it('includes Authorization header with Bearer token', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('-H "Authorization: Bearer ${API_KEY}"');
      });

      it('runs curl in background (non-blocking)', () => {
        const content = getResponseScriptContent();
        // Look for the background execution pattern
        expect(content).toContain('} &');
      });

      it('uses 10-second timeout', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('--max-time 10');
      });

      it('includes all required payload fields', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('session_id');
        expect(content).toContain('message_uuid');
        expect(content).toContain('response_text');
        expect(content).toContain('thinking_summary');
        expect(content).toContain('thinking_word_count');
        expect(content).toContain('tools_used');
        expect(content).toContain('model');
        expect(content).toContain('usage');
        expect(content).toContain('stop_reason');
      });
    });

    // AC #6: Silent Failure
    describe('silent failure', () => {
      it('exits with code 0 on all error paths', () => {
        const content = getResponseScriptContent();
        // Should not have any "exit 1" statements
        expect(content).not.toContain('exit 1');
        // Should always exit 0
        const exitStatements = content.match(/exit 0/g) || [];
        expect(exitStatements.length).toBeGreaterThan(0);
      });

      it('checks for jq dependency', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('command -v jq');
      });

      it('checks for curl dependency', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('command -v curl');
      });

      it('checks for config files', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('${USER_CONFIG}');
        expect(content).toContain('${SHARED_CONFIG}');
      });

      it('includes debug logging function', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('debug_log()');
        expect(content).toContain('DEBUG_CONTEXTOR');
      });

      it('writes debug logs to .contextor/.debug.log', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('DEBUG_LOG="${PROJECT_ROOT}/.contextor/.debug.log"');
      });
    });

    // Session ID extraction
    describe('session ID extraction', () => {
      it('extracts session ID from transcript filename', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('SESSION_ID=$(basename "$TRANSCRIPT_PATH" .jsonl)');
      });
    });

    // Config reading
    describe('config reading', () => {
      it('reads API key from user config', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('API_KEY=$(jq -r \'.api_key // empty\' "${USER_CONFIG}")');
      });

      it('reads API endpoint from shared config', () => {
        const content = getResponseScriptContent();
        expect(content).toContain('API_ENDPOINT=$(jq -r \'.api_endpoint // empty\' "${SHARED_CONFIG}")');
      });
    });
  });

  describe('createResponseScript', () => {
    it('creates hooks directory', async () => {
      await createResponseScript(testDir);
      expect(existsSync(join(testDir, CLAUDE_DIR, HOOKS_DIR))).toBe(true);
    });

    it('creates response script', async () => {
      await createResponseScript(testDir);
      const scriptPath = join(testDir, CLAUDE_DIR, HOOKS_DIR, RESPONSE_SCRIPT);
      expect(existsSync(scriptPath)).toBe(true);
    });

    it('makes script executable', async () => {
      await createResponseScript(testDir);
      const scriptPath = join(testDir, CLAUDE_DIR, HOOKS_DIR, RESPONSE_SCRIPT);
      const stats = statSync(scriptPath);
      // Check executable bit (0o755 = 493 in decimal)
      expect(stats.mode & 0o755).toBe(0o755);
    });

    it('script contains valid bash content', async () => {
      await createResponseScript(testDir);
      const scriptPath = join(testDir, CLAUDE_DIR, HOOKS_DIR, RESPONSE_SCRIPT);
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content.startsWith('#!/bin/bash')).toBe(true);
    });
  });

  describe('configureStopHook', () => {
    it('adds Stop hook to empty settings', () => {
      const settings: ClaudeSettings = {};
      const result = configureStopHook(settings);

      expect(result.hooks?.Stop).toHaveLength(1);
      expect(result.hooks?.Stop?.[0].hooks[0].command).toContain('contextor-response');
    });

    it('preserves existing Stop hooks', () => {
      const settings: ClaudeSettings = {
        hooks: {
          Stop: [createHookEntry('./scripts/my-stop-hook.sh')],
        },
      };
      const result = configureStopHook(settings);

      expect(result.hooks?.Stop).toHaveLength(2);
      expect(result.hooks?.Stop?.[0].hooks[0].command).toBe('./scripts/my-stop-hook.sh');
      expect(result.hooks?.Stop?.[1].hooks[0].command).toContain('contextor-response');
    });

    it('updates existing Contextor Stop hook', () => {
      const settings: ClaudeSettings = {
        hooks: {
          Stop: [
            createHookEntry('./scripts/my-stop-hook.sh'),
            createHookEntry('./old/contextor-response.sh'),
          ],
        },
      };
      const result = configureStopHook(settings);

      expect(result.hooks?.Stop).toHaveLength(2);
      expect(result.hooks?.Stop?.[1].hooks[0].command).toContain('contextor-response.sh');
    });

    it('preserves other hook types', () => {
      const settings: ClaudeSettings = {
        hooks: {
          UserPromptSubmit: [createHookEntry('test')],
        },
      };
      const result = configureStopHook(settings);

      expect(result.hooks?.UserPromptSubmit).toHaveLength(1);
      expect(result.hooks?.Stop).toHaveLength(1);
    });
  });

  describe('removeStopHook', () => {
    it('removes Contextor Stop hook', () => {
      const settings: ClaudeSettings = {
        hooks: {
          Stop: [
            createHookEntry('./scripts/my-stop-hook.sh'),
            createHookEntry('./.claude/hooks/contextor-response.sh'),
          ],
        },
      };
      const result = removeStopHook(settings);

      expect(result.hooks?.Stop).toHaveLength(1);
      expect(result.hooks?.Stop?.[0].hooks[0].command).toBe('./scripts/my-stop-hook.sh');
    });

    it('cleans up empty Stop array', () => {
      const settings: ClaudeSettings = {
        hooks: {
          Stop: [createHookEntry('./.claude/hooks/contextor-response.sh')],
        },
      };
      const result = removeStopHook(settings);

      expect(result.hooks?.Stop).toBeUndefined();
    });

    it('cleans up empty hooks object', () => {
      const settings: ClaudeSettings = {
        hooks: {
          Stop: [createHookEntry('./.claude/hooks/contextor-response.sh')],
        },
      };
      const result = removeStopHook(settings);

      expect(result.hooks).toBeUndefined();
    });

    it('handles missing hooks gracefully', () => {
      const settings: ClaudeSettings = {};
      const result = removeStopHook(settings);
      expect(result).toEqual({});
    });
  });
});
