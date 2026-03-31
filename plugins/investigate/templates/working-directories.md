# Working Directories — Template

> **This is a placeholder.** Fill in your own project-to-repo mapping before using `/investigate`.

## Purpose

This file maps project names to their local repo paths. The `/investigate` command reads
this file to determine which repos to scan when you run an investigation.

## Structure

```yaml
## Active Projects

### [project-name]
- **Workspace path**: [path in this workspace, e.g., projects/my-project/]
- **External repo**: [absolute path to local clone, e.g., ~/Projects/my-app/]
- **GitHub**: [org/repo, e.g., my-org/my-app]
- **Main branch**: main
- **Status**: active

### [another-project]
- **Workspace path**: projects/another-project/
- **External repo**: ~/Projects/another-project/
- **GitHub**: my-org/another-project
- **Main branch**: main
- **Status**: active
```

## Example

```markdown
### erp-platform
- **Workspace path**: projects/erp-platform/
- **External repo**: ~/Projects/erp-platform/
- **GitHub**: MyCompany/erp-platform
- **Main branch**: main
- **Status**: active

### api-gateway
- **Workspace path**: projects/api-gateway/
- **External repo**: ~/Projects/api-gateway/
- **GitHub**: MyCompany/api-gateway
- **Main branch**: main
- **Status**: active
```

## Rules

- Every active repo you want `/investigate` to scan must be listed here
- `External repo` must be an **absolute path** to a local git clone
- The repo must already be cloned on your machine — `/investigate` uses local Glob/Grep, not remote API
- `GitHub` field is used by `cross-repo-investigator` agent for `gh pr list` commands
