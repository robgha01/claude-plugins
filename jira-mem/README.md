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

## Which fetches nudge (configurable)

`getJiraIssue` is called for more than the initial load — the workflow also fetches
changelog and comments. jira-mem classifies each call and nudges only for the
classes you enable, then dedupes so you get **at most one nudge per ticket per
session**.

| Class | Detected by | Default |
|---|---|---|
| `full` | result carries a `summary` (or can't prove otherwise) | **on** |
| `changelog` | `expand` includes `changelog` | off |
| `comments` | restricted `fields` (no summary) incl. `comment` | off |
| `metadata` | restricted `fields`, no summary, no comment (e.g. `status`) | off |

Defaults nudge only substantive loads. A comments-/status-only fetch carries no
summary, so it's skipped **and leaves no dedup marker** — the real load that
follows still nudges.

### Config sources (highest precedence first)

1. OS env var (exported before launching Claude)
2. `settings.json` `env` block
3. project file `<cwd>/.jira-mem.json`
4. plugin data file `$CLAUDE_PLUGIN_DATA/config.json`
5. baked-in defaults

**Env (quick toggle):**

```jsonc
// settings.json — also nudge on comments; keep dedup
"env": { "JIRA_MEM_NUDGE": "full,comments" }
```

- `JIRA_MEM_NUDGE` — `full` · `full,comments` · `all` · `none`
- `JIRA_MEM_DEDUP` — `1` / `0`

**File (persistent / per-project):** `<repo>/.jira-mem.json`

```json
{
  "nudge": { "full": true, "changelog": true, "comments": true, "metadata": true },
  "dedup": false
}
```

## Behaviour notes

- **Fail-open.** Any error, bad config, or unparseable result degrades toward the
  safe default (nudge) and never blocks the fetch.
- **Dedup is per (session + ticket)** and marks only when it actually nudges, so a
  new session re-nudges and a different ticket still nudges.
- **Read-only.** Reads the tool event from stdin, writes a small marker in the OS
  temp dir (when dedup is on), and prints a reminder. Nothing else.

## Layout

```
jira-mem/
├── .claude-plugin/plugin.json
├── hooks/
│   ├── hooks.json              # PostToolUse + matcher (unchanged)
│   └── inject-mem-nudge.mjs    # classify + dedup + config, fail-open
└── README.md
```
