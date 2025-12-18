# Context Coach Journal Writer

**Version:** 0.2.0

This document contains instructions for BMAD agents to log prompts to the Context Coach journal.

## Integration Instructions

Add the following step to any BMAD agent's activation sequence:

```xml
<step n="context-coach">
  BEFORE proceeding with the user's request, check for Context Coach:
  1. Check if file exists: {project-root}/.bmad/context-coach/config.yaml
  2. If exists, read it and check if enabled: true
  3. If enabled, execute the Journal Write Protocol below
  4. Then proceed with normal agent operation
</step>
```

---

## Journal Write Protocol

When Context Coach is enabled, execute these steps **silently** (do not mention to user):

### Step 1: Gather Data

Collect the following information:
- **timestamp**: Current time in ISO 8601 format (e.g., `2025-12-18T14:32:15.000Z`)
- **user_id**: From config.yaml
- **project_path**: Current working directory (absolute path)
- **project_name**: Last segment of project path
- **git_branch**: Run `git branch --show-current` if in git repo, otherwise null
- **prompt_text**: The user's message/prompt that triggered this agent
- **agent_id**: This agent's file path (from `<agent id="...">` tag)
- **agent_name**: This agent's name

### Step 2: Extract File References

Parse the user's prompt for file paths. Look for:
- Paths starting with `src/`, `lib/`, `app/`, `components/`, etc.
- Relative paths like `./file.ts`
- Absolute paths like `/Users/.../file.ts`
- Backtick references like \`filename.ts\`

Store as array: `["src/auth.ts", "lib/utils.ts"]`

### Step 3: Detect Image References

Check if prompt mentions images (screenshot, image, picture, photo, png, jpg, attached, etc.)
Set `has_images: true` or `has_images: false`

### Step 4: Generate Deterministic ID

**CRITICAL:** Use this exact formula to match the Claude Code hook:

```
ID = "cc-" + first_12_chars_of_MD5(timestamp_minute + ":" + first_200_chars_of_prompt)

Where:
- timestamp_minute = YYYYMMDDHHMM (e.g., "202512181432")
- prompt = user's prompt text
- hash_input = timestamp_minute + ":" + prompt[0:200]
```

Example:
- Timestamp minute: `202512181432`
- Prompt: `"Help me refactor the auth module"`
- Hash input: `"202512181432:Help me refactor the auth module"`
- MD5: `a7b3c9d2e4f5...`
- ID: `cc-a7b3c9d2e4f5`

### Step 5: Construct JSON Entry

Build a **single-line** JSON object with schema version 1.1:

```json
{"id":"cc-a7b3c9d2e4f5","version":"1.1","timestamp":"2025-12-18T14:32:15.000Z","user_id":"edgars","source":"bmad-agent","project":{"path":"/path/to/project","name":"project-name","git_branch":"main"},"prompt":{"text":"user prompt here","char_count":123,"word_count":20,"has_images":false,"referenced_files":["src/auth.ts"]},"context":{"agent_id":".bmad/bmm/agents/dev.md","agent_name":"dev"}}
```

### Step 6: Write to Journal (With Overwrite)

1. Determine journal file path: `{project-root}/.bmad/context-coach/journal/{YYYY-MM-DD}.jsonl`
2. Create the journal directory if it doesn't exist
3. **Check if entry with same ID exists:**
   - Read the journal file
   - If a line contains `"id":"cc-XXXX"` matching our ID:
     - **Remove that line** (it's from the hook, we're replacing it)
   - Write/append our new entry
4. This ensures BMAD entry (with agent metadata) takes priority

### Step 7: Continue

Proceed with normal agent operation. **Do not mention the logging to the user.**

---

## Priority Behavior

| Scenario | Result |
|----------|--------|
| Hook writes first, then BMAD activates | BMAD overwrites with richer metadata |
| BMAD writes first, hook tries later | Hook skips (ID exists) |
| Non-BMAD prompt (no agent) | Hook entry preserved |

**Why BMAD has priority:** BMAD entries contain `agent_id` and `agent_name`, which are valuable for understanding which agent handled the prompt.

---

## Example Implementation (Pseudocode)

```python
def log_to_context_coach(user_prompt, agent_id, agent_name):
    config_path = "{project_root}/.bmad/context-coach/config.yaml"

    if not file_exists(config_path):
        return  # Context Coach not installed

    config = read_yaml(config_path)
    if not config.get("enabled", False):
        return  # Disabled

    # Generate deterministic ID
    timestamp_minute = now().format("YYYYMMDDHHMM")
    hash_input = f"{timestamp_minute}:{user_prompt[:200]}"
    entry_id = "cc-" + md5(hash_input)[:12]

    # Extract file references
    referenced_files = extract_file_paths(user_prompt)
    has_images = detect_image_mentions(user_prompt)

    # Build entry
    entry = {
        "id": entry_id,
        "version": "1.1",
        "timestamp": now().iso8601(),
        "user_id": config["user_id"],
        "source": "bmad-agent",
        "project": {
            "path": get_cwd(),
            "name": get_project_name(),
            "git_branch": get_git_branch()
        },
        "prompt": {
            "text": user_prompt,
            "char_count": len(user_prompt),
            "word_count": count_words(user_prompt),
            "has_images": has_images,
            "referenced_files": referenced_files
        },
        "context": {
            "agent_id": agent_id,
            "agent_name": agent_name
        }
    }

    # Write to journal (overwriting any hook entry with same ID)
    journal_file = f".bmad/context-coach/journal/{today()}.jsonl"

    # Remove existing entry with same ID if present
    if file_exists(journal_file):
        lines = read_lines(journal_file)
        lines = [l for l in lines if f'"id":"{entry_id}"' not in l]
        write_lines(journal_file, lines)

    # Append new entry
    append_line(journal_file, json.dumps(entry))
```

---

## File Reference Patterns

The following patterns are detected in prompts:

| Pattern | Example | Extracted |
|---------|---------|-----------|
| Common directories | `src/auth/login.ts` | `src/auth/login.ts` |
| Relative paths | `./utils/helper.js` | `./utils/helper.js` |
| Absolute paths | `/Users/me/project/file.py` | `/Users/me/project/file.py` |
| Backtick references | \`config.yaml\` | `config.yaml` |

---

## Image Detection Keywords

Prompts containing these terms set `has_images: true`:
- screenshot, image, picture, photo
- png, jpg, jpeg, gif, svg
- "look at this", "attached", "see the"

---

## Verification

To verify Context Coach is working:

```bash
# Check today's journal
cat .bmad/context-coach/journal/$(date +%Y-%m-%d).jsonl | jq .

# Count entries by source
cat .bmad/context-coach/journal/*.jsonl | jq -r '.source' | sort | uniq -c

# Show entries with agent info
cat .bmad/context-coach/journal/*.jsonl | jq 'select(.source == "bmad-agent")'
```

---

## Notes

- **Silent Operation**: Never mention logging to the user
- **Fail Gracefully**: If logging fails, continue with agent operation
- **Performance**: Keep logging fast - don't block user interaction
- **Deterministic ID**: Must match hook's algorithm exactly for deduplication
