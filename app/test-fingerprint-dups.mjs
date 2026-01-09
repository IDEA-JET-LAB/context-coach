/**
 * Check for duplicate fingerprints within the batch
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const CLAUDE_DIR = '/Users/edgars/.claude/projects/-Users-edgars-My-projects-2025-projects-DEV-HA-t97';
const USER_ID = '9d89a11c-4429-46bb-828f-f049dc0db00b';

function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block?.type === 'text' && typeof block.text === 'string') {
          return block.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function generateFingerprint(userId, timestamp, text) {
  const truncatedText = text.substring(0, 200);
  const minuteTimestamp = timestamp.substring(0, 16);
  const input = `${userId}:${minuteTimestamp}:${truncatedText}`;
  return crypto.createHash('md5').update(input).digest('hex').substring(0, 12);
}

// Collect all prompts
const fingerprints = new Map(); // fingerprint -> [{ file, text, timestamp }]

const files = fs.readdirSync(CLAUDE_DIR).filter(f => f.endsWith('.jsonl'));

for (const fileName of files) {
  const content = fs.readFileSync(path.join(CLAUDE_DIR, fileName), 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === 'user' && msg.message?.content) {
        const text = extractTextContent(msg.message.content);
        if (text && text.length > 0) {
          const timestamp = msg.timestamp || new Date().toISOString();
          const fp = generateFingerprint(USER_ID, timestamp, text);

          if (!fingerprints.has(fp)) {
            fingerprints.set(fp, []);
          }
          fingerprints.get(fp).push({
            file: fileName,
            text: text.substring(0, 50),
            timestamp: timestamp.substring(0, 19)
          });
        }
      }
    } catch {}
  }
}

// Find duplicates
console.log('=== Checking for duplicate fingerprints ===\n');

let dupCount = 0;
for (const [fp, entries] of fingerprints) {
  if (entries.length > 1) {
    dupCount++;
    console.log(`Fingerprint ${fp} appears ${entries.length} times:`);
    for (const entry of entries) {
      console.log(`  - ${entry.file} @ ${entry.timestamp}: "${entry.text}..."`);
    }
    console.log();
  }
}

console.log(`\nTotal unique fingerprints: ${fingerprints.size}`);
console.log(`Fingerprints with duplicates: ${dupCount}`);
