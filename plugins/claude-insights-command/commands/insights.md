---
description: Cross-project Claude Code session insights with project and time filtering
---

# /insights — Claude Code Session Insights

Generate an interactive HTML report analyzing Claude Code sessions.
Supports cross-project analysis and time filtering.

## Arguments: $ARGUMENTS

Parse the arguments as: `[project_name] [time_range]`

Examples:
- `/claude-insights-command:insights` → all projects, all time
- `/claude-insights-command:insights 7d` → all projects, last 7 days
- `/claude-insights-command:insights Pedal-Web-Service 7d` → specific project, last 7 days
- `/claude-insights-command:insights Pedal-Web-Service 30d` → specific project, last 30 days
- `/claude-insights-command:insights Pedal-App` → specific project, all time

**Parsing rules**:
- If an argument ends with `d` and starts with a number (e.g. `7d`, `30d`, `60d`), it's the time range
- Everything else is the project name filter
- Both are optional

## Execution Flow

Scripts are compiled in `${CLAUDE_PLUGIN_DATA}` (auto-installed via SessionStart hook).
Prompts are at `${CLAUDE_PLUGIN_ROOT}/prompts/`.
All output goes to `./insights-report/` in the current working directory (no writes to `~/.claude/`).

First, ensure the working directory exists: `mkdir -p ./insights-report/cache/session-meta ./insights-report/cache/facets`

### Step 0: Determine Filters

- **Project**: From parsed arguments. Maps to `--project` flag (fuzzy match on directory name).
- **Days**: From parsed time range. Maps to `--days` flag.
- **Date label**: Today's date in `YYYY-MM-DD` format.

Build the output filename pattern:
- With project + days: `{ProjectName}_{date}_{days}d` (e.g. `Pedal-Web-Service_2026-04-01_7d`)
- With project only: `{ProjectName}_{date}_all`
- With days only: `all_{date}_{days}d`
- Neither: `all_{date}_all`

### Phase 1: Scan Sessions (script)

```bash
node "${CLAUDE_PLUGIN_DATA}/scripts/dist/scan-sessions.js" \
  [--project "{ProjectName}"] \
  [--days {N}] \
  --max 200 \
  --cache-dir "./insights-report/cache/session-meta" \
  --output "./insights-report/{filename}_metas.json"
```

Only include `--project` and `--days` flags if the user specified them.
Read the output to check session count. If 0, inform the user and stop.

### Phase 2: Facet Extraction (sub-agents)

For sessions that need qualitative analysis:

1. Read `./insights-report/{filename}_metas.json` to get the session list
2. For each session (up to 30, most recent first):
   a. Check if cached facet exists at `./insights-report/cache/facets/{session_id}.json`
   b. If not cached, read the session `.jsonl` file
      - The actual file is at `~/.claude/projects/{project_path}/{session_id}.jsonl`
   c. Use the **Agent tool** (`subagent_type: "general-purpose"`) to spawn a sub-agent. Provide it:
      - The session transcript (user messages + assistant tool calls, truncated to 30k chars)
      - The facet extraction prompt from `${CLAUDE_PLUGIN_ROOT}/prompts/facet-extraction.md`
      - Instruction to return ONLY a valid JSON object
   d. Parse the sub-agent's JSON response → save to `./insights-report/cache/facets/{session_id}.json`
3. Collect all facets into `./insights-report/{filename}_facets.json` (JSON array)

**Parallelism**: Use the Agent tool to spawn up to 5 sub-agents concurrently (multiple Agent tool calls in a single message).

### Phase 3: Aggregate (script)

```bash
node "${CLAUDE_PLUGIN_DATA}/scripts/dist/aggregate.js" \
  --metas "./insights-report/{filename}_metas.json" \
  --facets "./insights-report/{filename}_facets.json" \
  --output "./insights-report/{filename}_aggregated.json"
```

### Phase 4: Generate Insights (sub-agents)

Read `./insights-report/{filename}_aggregated.json` and `./insights-report/{filename}_facets.json`.

Build a data context string with: aggregated stats, up to 50 session summaries, up to 20 friction details.

Use the **Agent tool** (`subagent_type: "general-purpose"`) to spawn **parallel sub-agents** — one per section, all in a single message. Each sub-agent receives the data context + its section prompt from `${CLAUDE_PLUGIN_ROOT}/prompts/insight-sections.md`:
1. `project_areas` — What the user works on
2. `interaction_style` — How they use Claude Code
3. `what_works` — Impressive workflows
4. `friction_analysis` — Pain points
5. `suggestions` — Features to try, CLAUDE.md additions
6. `on_the_horizon` — Future opportunities
7. `fun_ending` — Memorable moment

After all complete, generate `at_a_glance` (needs all other sections' results).

Save to `./insights-report/{filename}_insights.json`.

### Phase 5: Render Report (script)

```bash
node "${CLAUDE_PLUGIN_DATA}/scripts/dist/render-html.js" \
  --data "./insights-report/{filename}_aggregated.json" \
  --insights "./insights-report/{filename}_insights.json" \
  --output "./insights-report/{filename}.html"
```

### Phase 6: Present Results

1. Open: `open "./insights-report/{filename}.html"`
2. Show summary:
   - Filters used (project, time range)
   - Session count, message count, date range
   - At a Glance highlights
   - Path to HTML report
   - List other `.html` reports in `./insights-report/` for comparison
3. Suggest adding `insights-report/` to `.gitignore` if not already there
