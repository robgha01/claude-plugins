# jira-mem

Bridges Jira and your long-term memory. When a Jira ticket is fetched, `jira-mem`
reminds the agent to pull **related past work** from memory (e.g.
[claude-mem](https://github.com/thedotmack/claude-mem)) — at the exact moment the
ticket's content becomes known.

## The problem it solves

Prompt-time semantic injection (claude-mem) fires **once, on your first prompt**.
If that prompt is just a ticket id —

> "let's work on BBB-454"

— there's nothing meaningful to match on yet, so the injected context is
nearest-neighbour noise. The injection does **not** re-run later when the
`jira-ticket` skill fetches the real ticket description. So you can end up working
a ticket with no relevant memory surfaced, which defeats the point.

A bare ticket number is also a **weak semantic signal**: searching `"BBB-454"`
returns other dense tickets, not the work actually related to it. Memory recall
works on the *meaning* of the problem, not the identifier.

## How it works

`jira-mem` ships a single `PostToolUse` hook:

| | |
|---|---|
| **Matcher** | `mcp__.*getJiraIssue` (any Atlassian MCP server prefix) |
| **Fires** | the moment a Jira ticket is fetched — mid-turn, after the description is known |
| **Action** | injects `additionalContext` (a model-visible system reminder) telling the agent to run a semantic memory search **by the ticket's problem/topic, not its number** |

The agent then performs the retrieval with whatever memory tool it has
(`mem-search` / `search`). The hook itself does **not** call claude-mem — it only
nudges at the right time, so it has no hard dependency on it.

```
fetch ticket (getJiraIssue)
        │
        ▼
PostToolUse hook ──► "search memory by this ticket's topic, now"
        │
        ▼
agent runs mem-search ──► related past fixes / decisions / files surface
```

## Why a hook (not an edit to `jira-ticket`)

- **No coupling.** The `jira-ticket` skill never references claude-mem. This hook
  *observes* the fetch instead of being *called by* it.
- **claude-mem stays optional.** No memory tool present → the nudge is a harmless
  no-op; nothing breaks.
- **Correct timing, guaranteed.** Fires exactly when the ticket content lands,
  not on a soft "remember to do this" instruction.
- **Additive.** Plugin hooks merge with your user/project hooks — it doesn't
  replace anything.

## Install

Add the `robert-personal` marketplace and enable the plugin:

```
/plugin marketplace add C:\Workspace\claude-plugins
/plugin install jira-mem@robert-personal
```

Requires Node (already required by Claude Code). Pairs with claude-mem but does
not require it.

## Behaviour notes

- **Fail-open.** Any error in the hook → exits cleanly with no output. It never
  blocks or delays the ticket fetch.
- **Read-only.** It only reads the tool event from stdin and prints a reminder.
- **Re-fires.** `getJiraIssue` is also called later for changelog/comments, so the
  nudge may appear more than once per workflow. It's cheap, and the agent won't
  re-search if it already has. (A future version could dedupe per ticket via
  `CLAUDE_PLUGIN_DATA`.)

## Layout

```
jira-mem/
├── .claude-plugin/plugin.json
├── hooks/
│   ├── hooks.json              # PostToolUse + matcher
│   └── inject-mem-nudge.mjs    # emits additionalContext, fail-open
└── README.md
```
