---
name: investigate
description: "Cross-repo investigation workflow. Spawn parallel investigators per repo, consolidate findings, and produce structured report."
disable-model-invocation: true
argument-hint: "[topic or question to investigate]"
---

# /investigate — Cross-Repo Investigation

Parallel cross-repo investigation following the Explore → Decide → Execute pattern.

## Usage

`/investigate [topic]`

## Context to Load

- `${CLAUDE_PLUGIN_DATA}/context/working-directories.md` (for repo paths and branch policies)

## Workflow

### Phase 1: EXPLORE (parallel subagents)

1. Read `${CLAUDE_PLUGIN_DATA}/context/working-directories.md` to identify relevant repos
2. For each relevant repo, use the **Agent tool** to spawn a `cross-repo-investigator` agent:
   - Set `subagent_type` to `cross-repo-investigator`
   - In the prompt, include:
     - The investigation topic/question
     - The **absolute path** of the repo to search (from working-directories.md `External repo` field)
     - Specific areas to focus on (if known from the topic)
   - Set `run_in_background: true` to enable parallel execution
3. All investigators MUST run in **parallel** — spawn all Agent calls in a single message
4. Each investigator returns: findings summary (<2,000 tokens)

### Phase 2: DECIDE (main conversation)

1. Collect all investigator results
2. Merge findings:
   - Identify cross-repo correlations
   - Highlight contradictions or inconsistencies
   - Rank findings by relevance and risk
3. Present consolidated findings to the user:
   ```
   Investigation: [topic]

   ### Summary
   [2-3 sentences]

   ### Key Findings
   1. [finding] — [repo] — [risk level]
   2. [finding] — [repo] — [risk level]

   ### Cross-Repo Patterns
   - [pattern]

   ### Recommended Actions
   1. [action] — Priority: [H/M/L]

   What would you like to do next? (dig deeper / execute actions / save report / done)
   ```
4. Wait for user direction

### Phase 3: EXECUTE (based on user's decision)

Report output directory: `investigations/` in the project root (create with `mkdir -p` if needed).

Options:
- **Save report**: Generate `[output-dir]/YYYY-MM-DD-[topic-slug].md` with YAML frontmatter (type: report, created_date, author, tags)
- **Take action**: Execute recommended fixes (with user's approval)
- **Done**: No further action needed
