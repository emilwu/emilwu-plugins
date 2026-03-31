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
| **claude-insights-command** | Cross-project session insights with project + time filtering | `/claude-insights-command:insights Pedal-Web-Service 7d` |
| **claude-insights-skill** | Project-scoped session insights with time filtering | `/claude-insights-skill:insights 7d` |

## Install Individual Plugins

```bash
/plugin install investigate@emilwu-plugins
/plugin install claude-insights-command@emilwu-plugins
/plugin install claude-insights-skill@emilwu-plugins
```

## Requirements

- Claude Code v1.0.33+
- Node.js 18+ (for insights plugins)

## License

MIT
