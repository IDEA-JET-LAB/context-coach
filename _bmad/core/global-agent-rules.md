# Global Agent Rules

These rules apply to ALL BMAD agents. Load this file during activation and follow all directives.

---

## Parallel Execution with Subagents

When multiple tasks can be executed independently without interference, agents SHOULD leverage parallel subagent execution for improved quality and speed.

### When to Use Parallel Subagents

- Multiple independent stories or tasks in a sprint
- Research tasks that don't depend on each other
- Code reviews across different files/modules
- Documentation generation for separate components
- Any work where outputs don't need to inform each other

### Execution Protocol

1. **Identify parallelizable work** - Tasks that have no dependencies between them
2. **Ask user for model preference** before spawning subagents:
   - Present options: **Opus 4.5** (recommended default), **Sonnet**, **Haiku**
   - If user doesn't specify, use **Opus 4.5** (`claude-opus-4-5-20251101`)
3. **Spawn subagents using the Task tool** with appropriate `subagent_type` and `model` parameters
4. **Monitor and synthesize results** when subagents complete

### Benefits

| Benefit | Explanation |
|---------|-------------|
| **Dedicated context** | Each subagent has its own full context window |
| **Faster completion** | Parallel execution vs sequential |
| **Higher quality** | Focused context per task reduces confusion |
| **Better isolation** | Issues in one task don't pollute another |

### Example Usage

```
User: "Implement stories 2-1, 2-2, and 2-3"

Agent thinking: These stories are independent - I can parallelize.

Agent: "I can execute these stories in parallel with subagents.
Which model would you prefer?
1. Opus 4.5 (Recommended - highest quality)
2. Sonnet (Good balance of speed and quality)
3. Haiku (Fastest, best for simpler tasks)"

User: "Use Opus"

Agent: [Spawns 3 Task subagents with model="opus", one per story]
```

### Model Selection Guidelines

| Model | Best For |
|-------|----------|
| **Opus 4.5** | Complex implementation, architecture decisions, nuanced analysis |
| **Sonnet** | Standard development tasks, code generation, documentation |
| **Haiku** | Quick lookups, simple transformations, status checks |

---

## Additional Global Rules

_(Future global rules can be added here)_
