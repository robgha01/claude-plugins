# Jira Ticket Skill — Session Rename + Save State

**Date:** 2026-04-17
**Scope:** Two additions to the existing `jira-ticket` skill

---

## Feature 1 — Session Rename Prompt

### Goal
Make it trivial to identify which Claude session is working on which ticket.

### Mechanism
At the end of Step 1 (after ticket data is extracted), the skill outputs a single prominent line:

```
→ /rename <TICKET-ID>
```

Example: `→ /rename SCA-420`

### Why not fully automatic
`/rename` is processed client-side by the Claude Code terminal before it reaches the LLM. No tool, Bash command, hook, or IPC mechanism can invoke it programmatically from within a running session (confirmed via GitHub issues #29355, #33165, #34243, #35316 — all open as of April 2026). The one-liner prompt is the closest available solution and works 100% of the time.

### Placement in skill
Added as the final line of Step 1, after the ticket data summary is printed.

---

## Feature 2 — Save State File

### Goal
Persist work progress to a markdown file so sessions can be resumed or reviewed across days.

### File location
```
<git-root>/jira-state/<TICKET-ID>.md
```

Git root is detected via `git rev-parse --show-toplevel` at save time. Example: `C:\Workspace\sca\jira-state\SCA-420.md`

### File structure

```markdown
# <TICKET-ID> — <title>

## Status: <IN PROGRESS | COMPLETE ✓>

**Jira:** https://<company>.atlassian.net/browse/<TICKET-ID>
**Type:** <issueType> | **Assignee:** <assignee>
**Jira Status:** <status>
**Claude Session ID:** `<omitted — not exposed via env in current Claude Code versions>`

---

## Step Progress

- [x] Step 1 — Jira lookup
- [x] Step 2 — Branch created & ticket transitioned to In Progress
- [ ] Step 3 — Complexity assessed (<tier>)
- [ ] Step 4 — Implemented
- [ ] Step 5 — Ready for Test

---

## Description
<ticket description from Jira>

## Acceptance Criteria
<extracted from ticket>

## Git
| | |
|---|---|
| **Branch** | `<branch-name>` |
| **Commit** | `<hash> <message>` or *(pending)* |

---

## Notes
*(freeform — preserved across saves)*
```

All values are dynamic — populated from Jira API data (Step 1), git commands, and session state. Nothing is hardcoded.

### Progressive update approach
The file is **created once and updated at milestones** — not regenerated from scratch. This preserves any manual content the user adds to the Notes section between saves.

### Save triggers

| Trigger | When | What gets written |
|---|---|---|
| **Auto — Step 2** | After branch created + ticket transitioned to In Progress | File created: ticket metadata, Steps 1+2 checked, branch name |
| **Auto — Step 5** | After RFT comment posted + ticket transitioned | Status → `COMPLETE ✓`, Step 5 checked, commit/merge info added |
| **On-demand** | User says "save", "checkpoint", or "save state" | Full refresh: re-checks completed steps, updates git info, preserves Notes |

### On-demand detection
Added as a trigger at the top of the skill (alongside the Step 5 completion trigger). Phrases: "save", "save state", "checkpoint", "save progress".

### Git info at save time
Run `git log -1 --format="%h %s"` to get the latest commit hash and message. If no commits yet on the branch, write `*(pending)*`.

### Notes section preservation
When updating an existing file, the content between `## Notes` and end-of-file is read first and re-written verbatim — never overwritten by an auto-save.

---

## Changes to SKILL.md

1. **Step 1** — append rename prompt after ticket data is extracted
2. **New trigger section** (alongside Step 5 trigger) — on-demand save handler
3. **Step 2h** — add auto-save call after branch + transition complete
4. **Step 5e** — add auto-save call after ticket transitioned to Ready for Test
5. **allowed-tools** — no change needed; `Write` is already present in the skill
