---
name: jira-ticket
description: Use when user provides a Jira ticket ID (pattern [A-Z]+-[0-9]+) in their message, or when /jira-ticket is invoked. The ID format itself is the trigger — no magic phrase needed. Skip only when the ID is clearly a reference, not a task start.
---

# Jira Ticket Protocol

**Announce at start:** "Starting jira-ticket protocol for <TICKET-ID>."

---

## Step 1 — Jira Lookup

Fetch the ticket using the Atlassian MCP tool `getJiraIssue`. Pass the ticket ID exactly as provided (e.g., `SWBPAY-1234`).

Extract and record:
- `title`
- `description`
- `acceptanceCriteria` (look in description body or dedicated custom field)
- `issueType` (Bug / Task / Story / Epic)
- `status`
- `assignee`
- `storyPoints` (if set — may be null)
- `comments` (if any — useful context for understanding prior decisions)

**On failure** — if the ticket does not exist or the Atlassian MCP is not connected, stop immediately and print:

```
Error: Could not fetch <TICKET-ID>.
Reason: <MCP not connected | Ticket not found | <error message>>
No git operations have been performed.
```

Do not touch git. Do not continue.

---

## Step 2 — Branch Check & Create

### 2a. Search for existing branches

Run both commands and collect all matching branch names:

```bash
git branch --list "*<TICKET-ID>*"
git ls-remote --heads origin "*<TICKET-ID>*" | awk '{print $2}' | sed 's|refs/heads/||'
```

Deduplicate the results (same branch may appear in both).

### 2b. Check authorship of each found branch

For each found branch name, run:

```bash
git log -1 --format="%an" <branch-name>
```

Get the current user's name:

```bash
git config user.name
```

Compare. A branch "belongs to" the current user if the last committer name matches `git config user.name`.

### 2c. Apply decision table

| Situation | Action |
|---|---|
| No matching branch anywhere | Create `feature/<TICKET-ID>-<short-title>` (see 2d) |
| Current user's branch exists locally | `git checkout <branch>` |
| Current user's branch exists on remote only | `git checkout --track origin/<branch>` |
| Only other users' branches exist | Show conflict prompt (2e), wait for choice |
| Branches from current user AND others | Use current user's branch, mention others exist in summary |
| Current user has multiple matching branches | List all, ask which to use |

### 2d. Branch naming (when creating new)

Format: `feature/<TICKET-ID>-<short-title>`

Rules for `<short-title>`:
- Source: ticket `title` field from Step 1
- Lowercase everything
- Replace spaces and special characters with hyphens
- Collapse consecutive hyphens into one
- Strip leading and trailing hyphens
- Truncate to 40 characters at the nearest word boundary

Example:
- Title: `"Add CTA block with icon support"`
- Short title: `add-cta-block-with-icon-support`
- Branch: `feature/SWBPAY-1234-add-cta-block-with-icon-support`

Create the branch:
```bash
git checkout -b feature/<TICKET-ID>-<short-title>
```

### 2e. Conflict prompt (when only other users' branches exist)

Print this and wait for user input before proceeding:

```
Found existing branches for <TICKET-ID>:

  1. <branch-1> (<author-1>, <relative-age-1>)
  2. <branch-2> (<author-2>, <relative-age-2>)

Create your own branch, or work from one of these?
  [1] Use <author-1>'s branch
  [2] Use <author-2>'s branch
  [N] Create my own: feature/<TICKET-ID>-<short-title>
```

Act on the user's choice:
- `[1]` or `[2]` etc. → `git checkout <chosen-branch>` (add `--track origin/` prefix if remote-only)
- `[N]` or "create my own" → proceed with 2d

---

## Step 3 — Complexity Assessment & Context Summary

### 3a. Assess tier from ticket data

Evaluate in order — first matching rule wins:

| Tier | Rule |
|---|---|
| **Complex** | issueType is Epic, OR storyPoints ≥ 5, OR acceptance criteria count ≥ 5, OR description is vague/missing |
| **Medium** | issueType is Story, AND 3–5 acceptance criteria, AND storyPoints is 3 or 4 |
| **Simple** | issueType is Bug or Task, AND ≤2 acceptance criteria, AND storyPoints ≤ 2 (or unset for a clearly small task) |

When story points are unset and type/AC signals are mixed, default to **Complex** (safer to over-process than under-process).

### 3b. Print summary

Always print this before invoking any workflow:

```
Ticket:  <TICKET-ID> — <title>
Type:    <issueType> | Points: <storyPoints or "unset"> | Status: <status> | Assignee: <assignee>
Branch:  <branch-name> (<created | switched to | checked out>)
Tier:    <Simple | Medium | Complex> — <one-line workflow description>
         (<reason: e.g. "Bug, 1 point, 1 acceptance criterion">)

→ Reply to override tier (simple / medium / complex), or just continue with your task
```

Wait one turn. Accept:
- `simple`, `medium`, or `complex` → apply that tier instead and continue
- Any other message (the user continuing their task) → treat as no override, proceed with assessed tier

---

## Step 4 — Workflow Handoff

### Simple tier

Proceed directly to implementation — no skill invocation needed.
Read the relevant files, make the targeted change, keep scope tight.
When done, invoke `superpowers:verification-before-completion`.

### Medium tier

Invoke `superpowers:brainstorming`.
Open the brainstorming session with ticket context already provided — include ticket title, description, and acceptance criteria in your opening context message so brainstorming starts informed rather than from scratch.
After brainstorming design is approved, implement directly (no formal plan needed for medium scope).
When done, invoke `superpowers:verification-before-completion`.

### Complex tier

Invoke `superpowers:brainstorming` with full ticket context pre-loaded (same as Medium).
After brainstorming design is approved, invoke `superpowers:writing-plans`.
Execute the resulting plan via `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`.
When done, invoke `superpowers:verification-before-completion`.
