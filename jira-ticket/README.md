# jira-ticket-skill

A Claude Code plugin that automates the workflow for starting Jira tickets.

## What it does

When you mention any Jira ticket ID (e.g., `SWBPAY-1234`, `PAY-56`) in Claude Code:

1. Fetches ticket details from Jira (title, description, acceptance criteria, type, points)
2. Checks for existing branches — avoids duplicates, handles multi-author conflicts
3. Creates a branch named `feature/<TICKET-ID>-<short-title>` if none exists
4. Assesses ticket complexity and selects the right workflow tier:
   - **Simple** (bug/task, ≤2 AC, ≤2 points) → implement directly
   - **Medium** (story, 3–5 AC, 3–4 points) → light brainstorm → implement
   - **Complex** (epic, 5+ AC, 5+ points) → full brainstorm → plan → execute

Works with any Jira project prefix — not hardcoded to any team or project.

## Requirements

- [Claude Code](https://claude.ai/code) with the [Superpowers plugin](https://github.com/anthropics/claude-plugins-official/tree/main/superpowers) installed
- Atlassian MCP connected (for Jira lookups)
- Git

## Installation

Add to `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "robert-personal": {
      "source": { "source": "github", "repo": "robgha01/jira-ticket-skill" }
    }
  },
  "enabledPlugins": {
    "jira-ticket-skill@robert-personal": true
  }
}
```

Then restart Claude Code.

## Usage

Just mention a Jira ticket ID anywhere in your message:

```
SWBPAY-1234
let's work on SWBPAY-1234
SWBPAY-1234 implement the new CTA block
```

Or use the slash command explicitly:

```
/jira-ticket SWBPAY-1234
```
