/**
 * Test server parsing logic locally
 * This mirrors exactly what the server does
 */

import * as fs from 'fs';
import * as path from 'path';

const CLAUDE_DIR = '/Users/edgars/.claude/projects/-Users-edgars-My-projects-2025-projects-DEV-HA-t97';

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

function parseJsonlContent(content, fileName) {
  const lines = content.split('\n').filter((line) => line.trim());

  let userMessageCount = 0;
  let assistantMessageCount = 0;
  let otherTypeCount = 0;
  let parseErrorCount = 0;
  let userMessages = [];

  for (const line of lines) {
    try {
      const message = JSON.parse(line);

      if (message.type === 'user' && message.message?.content) {
        const text = extractTextContent(message.message.content);
        if (text && text.length > 0) {
          userMessageCount++;
          userMessages.push(text.substring(0, 50));
        }
      } else if (message.type === 'assistant' && message.message) {
        assistantMessageCount++;
      } else {
        otherTypeCount++;
      }
    } catch (e) {
      parseErrorCount++;
    }
  }

  return {
    fileName,
    totalLines: lines.length,
    userMessages: userMessageCount,
    assistantMessages: assistantMessageCount,
    otherTypes: otherTypeCount,
    parseErrors: parseErrorCount,
    firstPrompts: userMessages.slice(0, 2)
  };
}

// Simulate what Node.js test sends
const files = fs.readdirSync(CLAUDE_DIR).filter(f => f.endsWith('.jsonl'));

console.log('=== Testing server parsing logic ===\n');

let totalUsers = 0;
let totalFiles = 0;

for (const fileName of files) {
  const content = fs.readFileSync(path.join(CLAUDE_DIR, fileName), 'utf-8');

  // Simulate JSON round-trip (what happens over the network)
  const payload = JSON.stringify({ content });
  const parsed = JSON.parse(payload);
  const receivedContent = parsed.content;

  const result = parseJsonlContent(receivedContent, fileName);
  totalUsers += result.userMessages;
  totalFiles++;

  if (result.userMessages > 0 || result.parseErrors > 0) {
    console.log(`${fileName}:`);
    console.log(`  Lines: ${result.totalLines}, Users: ${result.userMessages}, Errors: ${result.parseErrors}`);
    if (result.firstPrompts.length > 0) {
      console.log(`  First: "${result.firstPrompts[0]}..."`);
    }
  }
}

console.log(`\n=== Summary ===`);
console.log(`Total files: ${totalFiles}`);
console.log(`Total user messages: ${totalUsers}`);
