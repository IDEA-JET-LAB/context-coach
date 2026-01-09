const fs = require('fs');
const path = require('path');

// Find a JSONL file
const claudeDir = process.env.HOME + '/.claude/projects';
let jsonlFile = null;

function findJsonl(dir, depth = 0) {
  if (depth > 3 || jsonlFile) return;
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          findJsonl(fullPath, depth + 1);
        } else if (item.endsWith('.jsonl') && !jsonlFile) {
          jsonlFile = fullPath;
        }
      } catch {}
    }
  } catch {}
}

findJsonl(claudeDir);

if (!jsonlFile) {
  console.log('No JSONL file found');
  process.exit(1);
}

const content = fs.readFileSync(jsonlFile, 'utf8');
const lines = content.split('\n').filter(l => l.trim());

console.log('Analyzing JSONL structure...\n');

for (const line of lines.slice(0, 50)) {
  try {
    const msg = JSON.parse(line);
    if (msg.type === 'assistant' && msg.message?.content) {
      const msgContent = msg.message.content;
      if (Array.isArray(msgContent)) {
        for (const block of msgContent) {
          if (block.type === 'thinking') {
            console.log('=== THINKING BLOCK ===');
            console.log('Has thinking text:', !!block.thinking);
            console.log('Length:', block.thinking?.length || 0);
            console.log('Preview:', (block.thinking || '').substring(0, 150));
            console.log('');
          } else if (block.type === 'tool_use') {
            console.log('=== TOOL_USE BLOCK ===');
            console.log('Tool ID:', block.id);
            console.log('Tool name:', block.name);
            console.log('Input keys:', Object.keys(block.input || {}));
            if (block.name === 'Bash') {
              console.log('Command:', block.input?.command?.substring(0, 80));
            } else if (block.name === 'Read') {
              console.log('File:', block.input?.file_path);
            }
            console.log('');
          }
        }
      }
    } else if (msg.type === 'user' && msg.message?.content) {
      // Check for tool results in user messages
      const userContent = msg.message.content;
      if (Array.isArray(userContent)) {
        for (const block of userContent) {
          if (block.type === 'tool_result') {
            console.log('=== TOOL_RESULT (in user msg) ===');
            console.log('Tool use ID:', block.tool_use_id);
            console.log('Is error:', block.is_error || false);
            const resultContent = typeof block.content === 'string'
              ? block.content
              : JSON.stringify(block.content);
            console.log('Result preview:', resultContent.substring(0, 100));
            console.log('');
          }
        }
      }
    }
  } catch {}
}
