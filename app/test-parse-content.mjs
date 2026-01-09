/**
 * Debug content escaping
 */

import * as fs from 'fs';

// Read a test file
const content = fs.readFileSync('/Users/edgars/.claude/projects/-Users-edgars-My-projects-2025-projects-DEV-HA-t97/9b8b7442-b9e0-40b4-99aa-f3b65ac8fdb8.jsonl', 'utf-8');

console.log('=== Original content (first 500 chars) ===');
console.log(content.substring(0, 500));
console.log('');

// Simulate what JSON.stringify does
const payload = JSON.stringify({
  content: content
});

console.log('=== After JSON.stringify (first 500 chars) ===');
console.log(payload.substring(0, 500));
console.log('');

// Parse it back
const parsed = JSON.parse(payload);

console.log('=== After JSON.parse (first 500 chars) ===');
console.log(parsed.content.substring(0, 500));
console.log('');

// Now parse the JSONL lines
const lines = parsed.content.split('\n').filter(l => l.trim());
console.log('=== Parsing JSONL lines ===');
console.log('Lines:', lines.length);

for (const line of lines) {
  try {
    const msg = JSON.parse(line);
    console.log('  Type:', msg.type, '| Has message.content:', !!msg.message?.content);
  } catch (e) {
    console.log('  PARSE ERROR:', e.message);
    console.log('  Line preview:', line.substring(0, 100));
  }
}
