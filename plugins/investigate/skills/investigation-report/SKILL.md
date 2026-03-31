---
name: investigation-report
description: "Report generation methodology for cross-repo investigations. Defines output formats for findings, risk assessment, and action items."
portable: true
user-invocable: false
---

# Investigation Report Skill

Knowledge skill: methodology and templates for structuring cross-repo investigation
findings into readable, actionable reports.

## Purpose

This skill provides report formats for the `cross-repo-investigator` agent.
Focused on code investigation output — not for daily operations or email/meeting summaries.

## Report Types

### 1. Quick Findings

3-5 bullet points for fast review.

```markdown
## Quick Findings: [repo-name]

- **Key finding 1** — [risk level]
- **Key finding 2** — [risk level]
- **Pattern detected** — [description]
- **Recommendation** — [one-liner]
```

### 2. Detailed Investigation Report

Full investigation with evidence, suitable for saving as a file.

```markdown
## Investigation: [Topic]

**Date**: YYYY-MM-DD
**Repos scanned**: [list]
**Investigator**: Claude Code

### Summary
[2-3 sentence overview]

### Findings by Repo

#### [repo-name]
- **Relevant files**: [paths]
- **Key observations**: [bullet points]
- **Recent changes**: [commits/PRs]
- **Risk level**: [HIGH/MEDIUM/LOW]

### Cross-Repo Correlations
- [patterns spanning multiple repos]

### Risk Assessment

| Risk | Repo | File | Severity | Description |
| ---- | ---- | ---- | -------- | ----------- |
| R-1 | repo-a | path/to/file | HIGH | [description] |
| R-2 | repo-b | path/to/config | MEDIUM | [description] |

### Recommended Actions

| # | Action | Priority | Repo | Effort |
| - | ------ | -------- | ---- | ------ |
| 1 | [action] | HIGH | repo-a | [S/M/L] |
| 2 | [action] | MEDIUM | repo-b | [S/M/L] |

### Open Questions
- [items needing human judgment]
```

### 3. Action Items Only

Extract only actionable items — suitable for task tracking.

```markdown
## Action Items: [Topic]

### Immediate (HIGH)
- [ ] [repo]: [action] — [file/context]

### Short-term (MEDIUM)
- [ ] [repo]: [action] — [file/context]

### Backlog (LOW)
- [ ] [repo]: [action] — [file/context]

### Needs Discussion
- [ ] [question requiring team input]
```

## Frontmatter for Saved Reports

When saving an investigation report as a file, use this frontmatter:

```yaml
---
type: report
created_date: YYYY-MM-DD
updated_date: YYYY-MM-DD
author: claude
tags: [investigation, cross-repo, [topic-keywords]]
---
```

## Selection Heuristic

Choose report type based on context:
- **Quick Findings**: agent returning results to parent (< 2,000 tokens)
- **Detailed Report**: user requests "save report" in Phase 3
- **Action Items Only**: user requests actionable output or task tracking
