# 🎫 jira-ticket

A Claude Code plugin that automates the workflow for starting Jira tickets.

When you mention any Jira ticket ID, it fetches the ticket from Jira, ensures a correctly-named branch exists, assesses complexity, and hands off to the right superpowers workflow tier — automatically.

Works with **any Jira project prefix** (`SWBPAY-`, `PAY-`, `PLAT-`, etc.).

---

## 🚀 Installation

### Step 1 — Add the marketplace

```
/plugin marketplace add https://github.com/robgha01/claude-plugins.git
```

### Step 2 — Install the plugin

```
/plugin install jira-ticket@robert-personal
```

### Step 3 — Reload

```
/reload-plugins
```

---

## 📋 Requirements

- [Claude Code](https://claude.ai/code)
- [Superpowers plugin](https://github.com/anthropics/claude-plugins-official) installed and enabled
- Atlassian MCP connected (provides Jira access)
- Git

---

## ⚡ Usage

Just mention a Jira ticket ID anywhere in your message — no magic phrase needed:

```
SWBPAY-1234
```

```
let's start SWBPAY-1234
```

```
SWBPAY-1234 implement the new CTA block
```

Or use the explicit slash command:

```
/jira-ticket SWBPAY-1234
```

---

## 🔄 What Happens

Once triggered, the protocol runs through these steps automatically:

**1. Jira Lookup**
Fetches ticket title, description, acceptance criteria, type, status, assignee, and story points via the Atlassian MCP. Stops immediately with a clear error if the ticket doesn't exist or MCP is not connected — no git operations performed.

**1b. View image attachments**
Detects `blob:` URLs in the description. If a Chrome browser MCP is connected, opens the ticket in the browser and screenshots the rendered images (mockups, bug screenshots). Without Chrome MCP, prints a note that images are unrendered so you can open the ticket yourself.

**2. Branch Check & Create**
Searches local and remote branches for any match on the ticket ID. Checks authorship of found branches:
- Your branch exists → switch to it
- Someone else's branch exists → shows a list, asks whether to use theirs or create your own
- No branch exists → creates `feature/<TICKET-ID>-<short-title>`

**3. Complexity Assessment**
Evaluates ticket type, story points, and acceptance criteria count to assign a tier:

| Tier | Signals | Workflow |
|---|---|---|
| 🟢 Simple | Bug/Task, ≤2 AC, ≤2 pts | Implement directly → verify |
| 🟡 Medium | Story, 3–5 AC, 3–4 pts | Light brainstorm → implement → verify |
| 🔴 Complex | Epic, 5+ AC, 5+ pts, or unclear scope | Full brainstorm → plan → execute → verify |

You can override the assessed tier before anything proceeds.

**4. Workflow Handoff**
Hands off to the appropriate superpowers skill (`brainstorming`, `writing-plans`, `executing-plans`) with ticket context pre-loaded, so the workflow starts informed rather than from scratch.

**5. Ready for Test (on completion)**
When you say "ready for test" or similar, drafts a completion comment (with `@mentions` and an optional project-configured suffix like a Cloudflare cache hint), shows it for approval, posts via ADF, optionally reassigns the ticket per the `rft-assignee:` directive, and transitions status. Idempotent — won't re-transition tickets already In Progress.

---

## ⚙️ Project Configuration

The plugin reads optional directives from the **consuming repo's `CLAUDE.md`** to adapt to per-project conventions without hard-coding them.

Example snippet to drop into your project's `CLAUDE.md`:

```
<!-- jira-ticket -->
rft-assignee: reporter
rft-mention-reporter: always
rft-comment-suffix: cloudflare-cache-hint
ship-strategy: direct-merge
merge-commit-format: Merge {TICKET-ID}: {TITLE}
build-host: auto
```

| Directive | Effect |
|---|---|
| `rft-assignee` | `reporter` \| `current` \| `<accountId>` \| `<email>` — who to reassign to in Step 5 |
| `rft-mention-reporter` | `always` \| `if-asked` \| `never` — auto-mention the reporter in RFT comments |
| `rft-comment-suffix` | Named template (`cloudflare-cache-hint`, `vercel-preview-hint`, `manual-deploy-hint`) or free text appended to RFT comments |
| `merge-commit-format` | Template with `{TICKET-ID}` / `{TITLE}` placeholders for the merge commit message (used by `ship-branch`) |
| `ship-strategy` | `direct-merge` \| `pull-request` \| `none` (default) — what the optional Ship step does |
| `build-host` | `auto` (default) \| `azure-devops` \| `github` \| `gitlab` \| `none` — which CI host to query for a build badge |
| `jira-autosave` | `enabled` (default) \| `disabled` — toggle the state file written to `jira-state/<TICKET-ID>.md` |

Full schema and the available named-suffix templates are documented in the [skill's SKILL.md](skills/jira-ticket/SKILL.md#project-configuration).

---

## 📊 Context Summary

Before invoking any workflow, the plugin always prints:

```
Ticket:  SWBPAY-1234 — Add CTA block with icon support
Type:    Story | Points: 5 | Status: In Progress | Assignee: Robert
Branch:  feature/SWBPAY-1234-add-cta-block-with-icon-support (created)
Tier:    Complex — full brainstorm → plan → execute
         (Story, 5 points, 4 acceptance criteria)

→ Reply to override tier (simple / medium / complex), or just continue with your task
```

---

## 🔧 Troubleshooting

**Skill not triggering automatically**
Ensure the plugin is enabled and Claude Code has been reloaded:
```
/reload-plugins
```

**Jira lookup failing**
Check that the Atlassian MCP is connected. The plugin will print a clear error and stop before touching git if it can't reach Jira.

**Wrong branch detected**
The branch search matches on `*<TICKET-ID>*`. If you have branches with similar IDs, the authorship check will identify which belongs to you.
