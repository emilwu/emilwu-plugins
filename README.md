# emilwu-plugins

Unified Claude Code plugin marketplace.

## Installation

```bash
/plugin marketplace add emilwu/emilwu-plugins
```

## Available Plugins

| Plugin | Description | Usage |
|--------|-------------|-------|
| **investigate** | Cross-repo investigation — spawn parallel investigators, consolidate findings | `/investigate:investigate` |
| **claude-insights-command** | Cross-project session insights with project + time + language filtering | `/claude-insights-command:insights Pedal-Web-Service 7d` |
| **claude-insights-skill** | Project-scoped session insights with time + language filtering | `/claude-insights-skill:insights 7d` |

## Install Individual Plugins

```bash
/plugin install investigate@emilwu-plugins
/plugin install claude-insights-command@emilwu-plugins
/plugin install claude-insights-skill@emilwu-plugins
```

## Requirements

- Claude Code v1.0.33+
- Node.js 18+ (for insights plugins)

## Changelog (claude-insights)

### v1.2.1

- Report language selection: asks user before generating, default English
- Supports any language (繁體中文, 日本語, 한국어, Español, etc.)
- AI-generated narrative content in chosen language; chart labels remain English
- Unified distribution via emilwu-plugins marketplace

### v1.1.0

- Output directory moved from `~/.claude/` to `./insights-report/` in current working directory
- Eliminates repeated permission prompts when writing files
- Reports, cache, and intermediate files all stored locally alongside the project

### v1.0.0

- Initial release
- Cross-project analysis (command version) and project-scoped analysis (skill version)
- Project filtering (fuzzy match) and time range filtering (7d, 30d, 60d)
- 5-phase pipeline: scan → facet extraction → aggregate → insights → HTML report
- SessionStart hook auto-compiles TypeScript dependencies

## License

MIT
