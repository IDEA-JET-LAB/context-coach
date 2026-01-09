/**
 * Node.js test that mimics VS Code extension's import behavior
 */

import * as fs from 'fs';
import * as path from 'path';

const API_ENDPOINT = 'http://127.0.0.1:3050/api';
const TOKEN = '3c9e5be3-f075-4d9c-8fe0-f9580f34ebfa';
const TEAM_ID = '6c52481b-3303-431c-8d3b-375469096799';
const CLAUDE_DIR = '/Users/edgars/.claude/projects/-Users-edgars-My-projects-2025-projects-DEV-HA-t97';
const PROJECT_PATH = '/Users/edgars/My-projects/2025-projects/DEV/HA-t97';

async function main() {
  // Read files exactly like VS Code does
  const filesPayload = [];
  const files = fs.readdirSync(CLAUDE_DIR).filter(f => f.endsWith('.jsonl'));

  console.log('Reading', files.length, 'files from', CLAUDE_DIR);

  for (const fileName of files) {
    const filePath = path.join(CLAUDE_DIR, fileName);
    const content = fs.readFileSync(filePath, 'utf-8');

    filesPayload.push({
      projectPath: PROJECT_PATH,
      fileName,
      content,
    });

    console.log('  ', fileName, '-', content.length, 'bytes');
  }

  // Build payload exactly like VS Code does
  const body = JSON.stringify({
    teamId: TEAM_ID,
    files: filesPayload,
  });

  console.log('\nPayload size:', body.length, 'bytes');
  console.log('First 500 chars:', body.substring(0, 500));
  console.log('\nSending to API...');

  const response = await fetch(API_ENDPOINT + '/import/upload', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + TOKEN,
      'Content-Type': 'application/json',
    },
    body,
  });

  const result = await response.json();
  console.log('\nResult:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
