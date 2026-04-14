# claude-plugins

Personal Claude Code plugins for [@robgha01](https://github.com/robgha01).

## Plugins

| Plugin | Description |
|---|---|
| [jira-ticket](jira-ticket/) | Auto-starts the right workflow when a Jira ticket ID is mentioned |

## Installation

Add to `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "robert-personal": {
      "source": { "source": "github", "repo": "robgha01/claude-plugins" }
    }
  },
  "enabledPlugins": {
    "jira-ticket@robert-personal": true
  }
}
```

Then restart Claude Code.
