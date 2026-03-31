---
description: Analyze Claude Code sessions for the current project and generate an interactive HTML report with usage patterns, friction analysis, and suggestions
---

# /insights — Project-Scoped Session Insights

Generate an interactive HTML report analyzing Claude Code sessions **for the current project**.

This is the project-scoped version — it automatically filters to the project directory where it's running.
For cross-project analysis, use the command version (`claude-insights-command`).

## Arguments: $ARGUMENTS

The user may specify a time range:

```
/claude-insights-skill:insights           ← all sessions for this project
/claude-insights-skill:insights 7d        ← last 7 days
/claude-insights-skill:insights 30d       ← last 30 days
/claude-insights-skill:insights 60d       ← last 60 days
```

Parse the number from the argument. If no argument, analyze all available sessions.

## Execution Flow

Scripts are compiled in `${CLAUDE_PLUGIN_DATA}` (auto-installed via SessionStart hook).
Prompts are at `${CLAUDE_PLUGIN_ROOT}/prompts/`.
Output goes to `${CLAUDE_PLUGIN_DATA}/output/`.

### Step 0: Determine Filters

- **Project**: Detect the current working directory. Extract the project name for `--project` filter.
  - e.g. if cwd is `/Users/someone/projects/my-app`, use `--project my-app`
- **Days**: Parse from user argument (e.g. `7d` → `--days 7`). If none, omit.
- **Date label**: Today's date in `YYYY-MM-DD` format.

Build the output filename pattern: `{ProjectName}_{date}_{days}d` (e.g. `my-app_2026-04-01_7d`)
If no days filter: `{ProjectName}_{date}_all`

### Phase 1: Scan Sessions (script)

```bash
node "${CLAUDE_PLUGIN_DATA}/scripts/dist/scan-sessions.js" \
  --project "{ProjectName}" \
  [--days {N}] \
  --max 200 \
  --cache-dir "${CLAUDE_PLUGIN_DATA}/output/cache/session-meta" \
  --output "${CLAUDE_PLUGIN_DATA}/output/{filename}_metas.json"
```

Read the output to check how many sessions were found. If 0, inform the user and stop.

### Phase 2: Facet Extraction (sub-agents)

For sessions that need qualitative analysis:

1. Read `${CLAUDE_PLUGIN_DATA}/output/{filename}_metas.json` to get the session list
2. For each session (up to 30, most recent first):
   a. Check if cached facet exists at `${CLAUDE_PLUGIN_DATA}/output/cache/facets/{session_id}.json`
   b. If not cached, read the session `.jsonl` file
      - The actual file is at `~/.claude/projects/{project_path}/{session_id}.jsonl`
   c. Use the **Agent tool** (`subagent_type: "general-purpose"`) to spawn a sub-agent. Provide it:
      - The session transcript (user messages + assistant tool calls, truncated to 30k chars)
      - The facet extraction prompt from `${CLAUDE_PLUGIN_ROOT}/prompts/facet-extraction.md`
      - Instruction to return ONLY a valid JSON object
   d. Parse the sub-agent's JSON response → save to `${CLAUDE_PLUGIN_DATA}/output/cache/facets/{session_id}.json`
3. Collect all facets into `${CLAUDE_PLUGIN_DATA}/output/{filename}_facets.json` (JSON array)

**Parallelism**: Use the Agent tool to spawn up to 5 sub-agents concurrently (multiple Agent tool calls in a single message).

### Phase 3: Aggregate (script)

```bash
node "${CLAUDE_PLUGIN_DATA}/scripts/dist/aggregate.js" \
  --metas "${CLAUDE_PLUGIN_DATA}/output/{filename}_metas.json" \
  --facets "${CLAUDE_PLUGIN_DATA}/output/{filename}_facets.json" \
  --output "${CLAUDE_PLUGIN_DATA}/output/{filename}_aggregated.json"
```

### Phase 4: Generate Insights (sub-agents)

Read `${CLAUDE_PLUGIN_DATA}/output/{filename}_aggregated.json` and `${CLAUDE_PLUGIN_DATA}/output/{filename}_facets.json`.

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

Save to `${CLAUDE_PLUGIN_DATA}/output/{filename}_insights.json`.

### Phase 5: Render Report (script)

```bash
node "${CLAUDE_PLUGIN_DATA}/scripts/dist/render-html.js" \
  --data "${CLAUDE_PLUGIN_DATA}/output/{filename}_aggregated.json" \
  --insights "${CLAUDE_PLUGIN_DATA}/output/{filename}_insights.json" \
  --output "${CLAUDE_PLUGIN_DATA}/output/reports/{filename}.html"
```

### Phase 6: Present Results

1. Open: `open "${CLAUDE_PLUGIN_DATA}/output/reports/{filename}.html"`
2. Show summary:
   - Project name, time range, session count
   - At a Glance highlights
   - Path to HTML report
   - Mention previous reports in `${CLAUDE_PLUGIN_DATA}/output/reports/` if they exist for comparison
