# Insight Section Prompts

Each section below is sent to a sub-agent with aggregated data context.
Sub-agents should return ONLY valid JSON.

---

## project_areas

Analyze this Claude Code usage data and identify project areas.

RESPOND WITH ONLY A VALID JSON OBJECT:
```json
{
  "areas": [
    {"name": "Area name", "session_count": N, "description": "2-3 sentences about what was worked on and how Claude Code was used."}
  ]
}
```

Include 4-5 areas.

---

## interaction_style

Analyze this Claude Code usage data and describe the user's interaction style.

RESPOND WITH ONLY A VALID JSON OBJECT:
```json
{
  "narrative": "2-3 paragraphs analyzing HOW the user interacts with Claude Code. Use second person 'you'. Describe patterns. Use **bold** for key insights.",
  "key_pattern": "One sentence summary of most distinctive interaction style"
}
```

---

## what_works

Analyze this Claude Code usage data and identify what's working well. Use second person ("you").

RESPOND WITH ONLY A VALID JSON OBJECT:
```json
{
  "intro": "1 sentence of context",
  "impressive_workflows": [
    {"title": "Short title (3-6 words)", "description": "2-3 sentences describing the impressive workflow. Use 'you' not 'the user'."}
  ]
}
```

Include 3 impressive workflows.

---

## friction_analysis

Analyze this Claude Code usage data and identify friction points. Use second person ("you").

RESPOND WITH ONLY A VALID JSON OBJECT:
```json
{
  "intro": "1 sentence summarizing friction patterns",
  "categories": [
    {"category": "Concrete category name", "description": "1-2 sentences. Use 'you' not 'the user'.", "examples": ["Specific example", "Another example"]}
  ]
}
```

Include 3 friction categories with 2 examples each.

---

## suggestions

Analyze this Claude Code usage data and suggest improvements.

### CC FEATURES REFERENCE (pick from these for features_to_try):

1. **MCP Servers**: Connect Claude to external tools via Model Context Protocol.
   - `claude mcp add <server-name> -- <command>`
2. **Custom Skills**: Reusable prompts as markdown files.
   - Create `.claude/skills/commit/SKILL.md` → type `/commit` to run
3. **Hooks**: Shell commands that auto-run at lifecycle events.
   - Add to `.claude/settings.json` under "hooks"
4. **Headless Mode**: Run Claude non-interactively.
   - `claude -p "fix lint errors" --allowedTools "Edit,Read,Bash"`
5. **Task Agents**: Sub-agents for parallel work.
   - Ask "use an agent to explore X"

RESPOND WITH ONLY A VALID JSON OBJECT:
```json
{
  "claude_md_additions": [
    {"addition": "Specific line to add to CLAUDE.md", "why": "1 sentence why", "prompt_scaffold": "Where to add"}
  ],
  "features_to_try": [
    {"feature": "Feature name", "one_liner": "What it does", "why_for_you": "Why this helps YOU", "example_code": "Command to copy"}
  ],
  "usage_patterns": [
    {"title": "Short title", "suggestion": "1-2 sentences", "detail": "3-4 sentences", "copyable_prompt": "Prompt to try"}
  ]
}
```

PRIORITIZE claude_md_additions that appear MULTIPLE TIMES across sessions.

---

## on_the_horizon

Analyze this Claude Code usage data and identify future opportunities.

RESPOND WITH ONLY A VALID JSON OBJECT:
```json
{
  "intro": "1 sentence about evolving AI-assisted development",
  "opportunities": [
    {"title": "Short title (4-8 words)", "whats_possible": "2-3 ambitious sentences", "how_to_try": "1-2 sentences", "copyable_prompt": "Detailed prompt to try"}
  ]
}
```

Include 3 opportunities. Think BIG.

---

## fun_ending

Find a memorable moment from the session data.

RESPOND WITH ONLY A VALID JSON OBJECT:
```json
{
  "headline": "A memorable QUALITATIVE moment — not a statistic.",
  "detail": "Brief context"
}
```

---

## at_a_glance (runs AFTER all other sections complete)

Write an "At a Glance" summary using 4 parts:

1. **What's working** — User's unique style + impactful things done
2. **What's hindering you** — (a) Claude's fault, (b) user-side friction
3. **Quick wins to try** — Specific CC features
4. **Ambitious workflows for better models** — Future possibilities

Keep each section to 2-3 sentences. Coaching tone.

RESPOND WITH ONLY A VALID JSON OBJECT:
```json
{
  "whats_working": "...",
  "whats_hindering": "...",
  "quick_wins": "...",
  "ambitious_workflows": "..."
}
```
