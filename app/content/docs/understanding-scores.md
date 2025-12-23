# Understanding Scores

Contextor analyzes each prompt across five quality dimensions to provide actionable feedback. This guide explains what each dimension measures, how to interpret scores, and how to improve.

## The Five Dimensions

Every prompt is scored on these five dimensions, each measuring a different aspect of prompt quality:

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| **Clarity** | 25% | How clear and unambiguous is the prompt? |
| **Context** | 25% | Is sufficient background information provided? |
| **Specificity** | 20% | Are requirements detailed and concrete? |
| **Goal** | 15% | Is the desired outcome clearly stated? |
| **Constraints** | 15% | Are limitations and boundaries defined? |

The weights determine how each dimension contributes to your overall score. Clarity and Context are weighted highest because they have the most impact on AI response quality.

## Scoring Scale

All dimensions use a 1-10 scale:

| Score Range | Rating | Meaning |
|-------------|--------|---------|
| **9-10** | Excellent | Best practices followed, minimal improvement possible |
| **7-8** | Good | Solid prompt with minor areas for refinement |
| **5-6** | Average | Adequate but has clear opportunities for improvement |
| **3-4** | Below Average | Missing important elements, likely to get suboptimal responses |
| **1-2** | Poor | Fundamental issues that will lead to poor AI responses |

Your **overall score** is a weighted average of all five dimensions, rounded to one decimal place.

## Dimension Details

### Clarity (25% weight)

**What it measures:** How easily the AI can understand your request without guessing.

**High Clarity (8-10):**
- Single, unambiguous interpretation
- Clear sentence structure
- Precise language with no jargon unless defined

**Low Clarity (1-4):**
- Multiple possible interpretations
- Confusing or run-on sentences
- Undefined abbreviations or ambiguous pronouns

**Example - Low Clarity (Score: 3):**
> "Fix the thing in the code that's broken"

**Example - High Clarity (Score: 9):**
> "Fix the null pointer exception in the UserService.authenticate() method that occurs when the email parameter is empty"

**Tips to improve:**
- Be explicit about what "it" or "this" refers to
- Use technical terms precisely
- Break complex requests into numbered steps

### Context (25% weight)

**What it measures:** Whether you provide enough background for the AI to understand the situation.

**High Context (8-10):**
- Relevant background information included
- Technology stack mentioned when applicable
- Current state and desired state explained

**Low Context (1-4):**
- AI must make assumptions about your environment
- Missing relevant history or constraints
- No explanation of what has already been tried

**Example - Low Context (Score: 2):**
> "Why isn't my function working?"

**Example - High Context (Score: 9):**
> "I'm working on a Next.js 14 app with TypeScript. My `getServerSideProps` function is returning data correctly (I can see it in the server logs), but the component is receiving undefined for the props. I've already verified the export is correct."

**Tips to improve:**
- Mention your tech stack and versions
- Explain what you have already tried
- Describe the current behavior vs expected behavior

### Specificity (20% weight)

**What it measures:** How detailed and concrete your requirements are.

**High Specificity (8-10):**
- Concrete details rather than vague generalizations
- Measurable or observable outcomes
- Examples or sample data included when helpful

**Low Specificity (1-4):**
- Vague terms like "better" or "fast" without definition
- No examples to clarify intent
- Missing key details needed to complete the task

**Example - Low Specificity (Score: 3):**
> "Make the API faster"

**Example - High Specificity (Score: 9):**
> "Optimize the /api/users endpoint to return within 200ms. Currently it takes 2-3 seconds due to the N+1 query problem in the Prisma query. The response should still include the user's team and role data."

**Tips to improve:**
- Replace vague adjectives with measurements
- Include sample input/output when helpful
- Specify file names, function names, or line numbers

### Goal (15% weight)

**What it measures:** Whether the desired outcome is clearly stated and success can be recognized.

**High Goal Definition (8-10):**
- Clear end state described
- Success criteria that can be verified
- Explanation of how you will know when done

**Low Goal Definition (1-4):**
- No clear endpoint
- Unclear what "done" looks like
- Ambiguous about what success means

**Example - Low Goal (Score: 3):**
> "Help me with the authentication"

**Example - High Goal (Score: 9):**
> "Implement JWT refresh token rotation so that: (1) access tokens expire after 15 minutes, (2) refresh tokens expire after 7 days, (3) a new refresh token is issued with each access token refresh, and (4) old refresh tokens are invalidated immediately"

**Tips to improve:**
- Start with "The goal is..." or "I want to achieve..."
- List specific acceptance criteria
- Describe how you will verify success

### Constraints (15% weight)

**What it measures:** Whether limitations, boundaries, and preferences are defined.

**High Constraint Definition (8-10):**
- Technical constraints specified (versions, libraries, patterns)
- Scope boundaries clear (what NOT to change)
- Preferences stated (style, approach, format)

**Low Constraint Definition (1-4):**
- Open-ended with no boundaries
- No indication of what to avoid
- Missing preferences that lead to unwanted suggestions

**Example - Low Constraints (Score: 2):**
> "Add logging to the app"

**Example - High Constraints (Score: 9):**
> "Add structured JSON logging using Winston to the Express middleware. Do not modify the existing error handler. Use log levels: error for 5xx, warn for 4xx, info for 2xx. Logs should include request ID, user ID (if authenticated), and response time."

**Tips to improve:**
- Mention what should NOT be changed
- Specify libraries or patterns to use (or avoid)
- Define format, style, or approach preferences

## Improvement Suggestions

Each analyzed prompt includes:

1. **Dimension-specific suggestions** - Actionable tips for each dimension that scored below 8
2. **Examples** - Specific rewrites showing how to improve the prompt
3. **Priority order** - Dimensions are listed in order of impact, so you know what to focus on first

### Understanding Suggestion Types

| Type | Icon | Meaning |
|------|------|---------|
| **Improvement** | Warning | This dimension needs work - follow the suggestion |
| **Reinforcement** | Checkmark | You did well here - keep doing this |

## Tracking Progress

The dashboard provides several views to track your improvement:

- **Score Trend** - Line chart showing your overall score over time
- **Dimension Breakdown** - Bar chart comparing your averages across dimensions
- **Activity Heatmap** - See when you are most active and how scores vary by time
- **Team Comparison** - See how your scores compare to team averages

## Common Patterns

### The Assumption Trap

Low scores often result from assuming the AI knows things it does not. You have been working on your codebase for weeks, but the AI sees each prompt in isolation.

**Fix:** Pretend you are explaining to a new team member who has never seen the code.

### The Vague Goal

Prompts like "help me with X" or "improve Y" score low on Goal because success is undefined.

**Fix:** State what the end result should look like and how you will verify it.

### The Missing Constraints

Without constraints, the AI may suggest approaches that do not fit your situation (wrong library, wrong version, wrong pattern).

**Fix:** Always mention your tech stack and any patterns you follow.

## Next Steps

- **[CLI Installation](/docs/cli-installation)** - Set up prompt capture
- **[Team Management](/docs/team-management)** - Learn from your team's prompts
- **[FAQ](/docs/faq)** - Common questions about scoring
