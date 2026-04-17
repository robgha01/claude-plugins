---
name: jira-ticket
description: Use when user provides a Jira ticket ID (pattern [A-Z]+-[0-9]+) in their message, or when /jira-ticket is invoked. The ID format itself is the trigger — no magic phrase needed. Skip only when the ID is clearly a reference, not a task start.
argument-hint: <TICKET-ID>
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
---

# Jira Ticket Protocol

**Announce at start:** "Starting jira-ticket protocol for <TICKET-ID>."

---

## Step 1 — Jira Lookup

Fetch the ticket using the Atlassian MCP tool `getJiraIssue`. Pass the ticket ID exactly as provided (e.g., `SWBPAY-1234`).

**Finding the cloud ID:** `getJiraIssue` requires an Atlassian cloud ID. Call `getAccessibleAtlassianResources` first to discover the correct cloud ID for the user's Jira instance. If that tool is unavailable or denied, infer the company name from the project key prefix and try `<company>.atlassian.net` (e.g., project key `WEBR-696` → try `comprend.atlassian.net` or similar).

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

**On success** — when ticket data is confirmed extracted, print:

```
→ /rename <TICKET-ID>
```

This prompts the user to name the session after the ticket for easy identification in `/resume`. It cannot be automated — `/rename` is processed client-side and is not callable by the LLM. Continue to Step 2 without waiting.

---

## Step 2 — Branch Check & Create

### 2a. Check for uncommitted changes

Run:
```bash
git status --porcelain
```

If there are uncommitted changes, print a warning and ask before proceeding:

```
Warning: you have uncommitted changes on <current-branch>.
Switching branches may carry these changes across or fail.
  [S] Stash them and continue
  [C] Continue anyway (unstaged changes will follow)
  [X] Stop — I'll commit or stash manually
```

Wait for the user's choice:
- `[S]` → run `git stash`, then continue
- `[C]` → continue without stashing
- `[X]` → stop here, print "No branch operations performed."

### 2c. Search for existing branches

Run both commands and collect all matching branch names:

```bash
git branch --list "*<TICKET-ID>*"
git ls-remote --heads origin "*<TICKET-ID>*" | awk '{print $2}' | sed 's|refs/heads/||'
```

Deduplicate the results (same branch may appear in both).

### 2d. Check authorship of each found branch

For each found branch name, run:

```bash
git log -1 --format="%an" <branch-name>
```

Get the current user's name:

```bash
git config user.name
```

Compare. A branch "belongs to" the current user if the last committer name matches `git config user.name`.

### 2e. Apply decision table

| Situation | Action |
|---|---|
| No matching branch anywhere | Create `<prefix>/<TICKET-ID>-<short-title>` (see 2f) |
| Current user's branch exists locally | `git checkout <branch>` |
| Current user's branch exists on remote only | `git checkout --track origin/<branch>` |
| Only other users' branches exist | Show conflict prompt (2g), wait for choice |
| Branches from current user AND others | Use current user's branch, mention others exist in summary |
| Current user has multiple matching branches | List all, ask which to use |

### 2f. Branch naming (when creating new)

Format: `<prefix>/<TICKET-ID>-<short-title>`

Choose prefix by issue type:
- `Bug` → `bugfix/`
- `Task` → `chore/`
- `Story`, `Epic`, or anything else → `feature/`

Rules for `<short-title>`:
- Source: ticket `title` field from Step 1
- Lowercase everything
- Replace spaces and special characters with hyphens
- Collapse consecutive hyphens into one
- Strip leading and trailing hyphens
- Truncate to 40 characters at the nearest word boundary

Example:
- Title: `"Add CTA block with icon support"`, type Story
- Short title: `add-cta-block-with-icon-support`
- Branch: `feature/SWBPAY-1234-add-cta-block-with-icon-support`

Example:
- Title: `"Null pointer on login"`, type Bug
- Branch: `bugfix/SWBPAY-1235-null-pointer-on-login`

Create the branch:
```bash
git checkout -b <prefix>/<TICKET-ID>-<short-title>
```

### 2g. Conflict prompt (when only other users' branches exist)

Print this and wait for user input before proceeding:

```
Found existing branches for <TICKET-ID>:

  1. <branch-1> (<author-1>, <relative-age-1>)
  2. <branch-2> (<author-2>, <relative-age-2>)

Create your own branch, or work from one of these?
  [1] Use <author-1>'s branch
  [2] Use <author-2>'s branch
  [N] Create my own: <prefix>/<TICKET-ID>-<short-title>
```

Act on the user's choice:
- `[1]` or `[2]` etc. → `git checkout <chosen-branch>` (add `--track origin/` prefix if remote-only)
- `[N]` or "create my own" → proceed with 2f

### 2h. Transition ticket to In Progress

After the branch is checked out or created, transition the Jira ticket to "In Progress" using `transitionJiraIssue`.

1. Call `getTransitionsForJiraIssue` to get the available transitions for this ticket.
2. Find the transition whose name matches "In Progress" (case-insensitive).
3. Call `transitionJiraIssue` with that transition ID.

If the MCP call fails or the "In Progress" transition doesn't exist, note it in the summary but do not stop — branch setup already succeeded.

---

## Step 3 — Complexity Assessment & Context Summary

### 3a. Assess tier from ticket data

Evaluate in order — first matching rule wins:

| Tier | Rule |
|---|---|
| **Complex** | issueType is Epic, OR storyPoints ≥ 5, OR acceptance criteria count ≥ 5 |
| **Simple** | issueType is Bug or Task, AND ≤ 2 acceptance criteria, AND storyPoints ≤ 2 (or unset) |
| **Simple** | issueType is Story, AND ≤ 2 acceptance criteria, AND storyPoints ≤ 2 (or unset) |
| **Medium** | issueType is Story, AND 3–4 acceptance criteria, OR storyPoints is 3 or 4 |
| **Complex** | Fallback for anything not matched above (missing/vague description with Epic-like scope) |

Rationale: a Story with few acceptance criteria and no story points is a lightweight ticket — it should be Simple, not Complex. The old default-to-Complex on mixed signals was over-cautious and added unnecessary process overhead to straightforward work.

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

---

## Step 5 — Completion Flow (Ready for Test)

**Triggers:** User says "ready for test", "move to ready for test", "done with the ticket", "mark as RFT", or similar completion phrasing.

### 5a. Draft completion comment

Build a comment summarizing what was implemented and verified. Base it on:
- The ticket description and acceptance criteria (from Step 1)
- What was actually changed (git diff or file inspection)
- Any verification evidence (environment URLs, computed values, test output)

Structure:
- What was done (brief, specific — mention themes/files if relevant)
- Verification results with environment and evidence

### 5b. Identify @mentions

Ask the user who to mention, or suggest based on:
- Anyone who gave direction in ticket comments
- The reporter (only if they asked a specific question — Jira notifies them automatically)

Look up account IDs with `lookupJiraAccountId`.

### 5c. Show draft for approval

Print the full comment exactly as it will appear:

```
Proposed comment for <TICKET-ID>:

@Name1 @Name2

<comment body>

Post this and move to Ready for Test? (yes / edit / cancel)
```

**Do not post anything until the user approves.**

- `yes` / `go` / `approve` → proceed
- `edit` + revised text → update draft, show again
- `cancel` / `no` → stop, nothing posted

### 5d. Post comment

Call `addCommentToJiraIssue` with `contentFormat: "adf"` to preserve @mention formatting.

### 5e. Transition to Ready for Test

1. Call `getTransitionsForJiraIssue`
2. Find the transition whose name contains "ready" and "test" (case-insensitive)
3. Call `transitionJiraIssue`

If no matching transition exists, list available options and ask the user which to apply.

Print confirmation:
```
✓ Comment posted to <TICKET-ID>
✓ Status → Ready for Test
```

---

## Save State Routine

Called at milestones and on-demand. Writes or updates `<git-root>/jira-state/<TICKET-ID>.md`.

### SR-1. Resolve file path

```bash
git rev-parse --show-toplevel
```

File path: `<git-root>/jira-state/<TICKET-ID>.md`

Create directory if needed:
```bash
mkdir -p "<git-root>/jira-state"
```

### SR-2. Preserve existing Notes

If the file already exists, read it. Extract everything from `## Notes` to end of file — this is `<preserved-notes>`. If the file does not exist, `<preserved-notes>` is empty.

### SR-3. Determine completed steps

Evaluate which steps have been completed in this session:

| Step | Completed if... |
|---|---|
| Step 1 | Always true when this routine is called |
| Step 2 | A branch was checked out or created this session |
| Step 3 | Complexity tier was assessed and printed |
| Step 4 | Implementation work was done (commits exist on branch beyond base) |
| Step 5 | Ticket was transitioned to Ready for Test |

Use `[x]` for completed steps and `[ ]` for pending.

### SR-4. Get current git info

```bash
git branch --show-current
git log -1 --format="%h %s" 2>/dev/null || echo "pending"
```

If output is "pending" or empty, use `*(pending)*` for the commit field.

### SR-5. Determine status line

- Called from Step 5 completion → `COMPLETE ✓`
- All other cases → `IN PROGRESS`

### SR-6. Construct Jira browse URL

Use the Atlassian cloud base URL discovered in Step 1 (e.g. `https://<your-domain>.atlassian.net`):
```
<cloud-base-url>/browse/<TICKET-ID>
```

### SR-7. Write the file

Write the complete file using the template below. All `<placeholders>` are replaced with real values from Steps 1–6 above.

````markdown
# <TICKET-ID> — <title>

## Status: <IN PROGRESS | COMPLETE ✓>

**Jira:** <cloud-base-url>/browse/<TICKET-ID>
**Type:** <issueType> | **Assignee:** <assignee>
**Jira Status:** <current Jira status>

---

## Step Progress

- <[x]|[ ]> Step 1 — Jira lookup
- <[x]|[ ]> Step 2 — Branch created & ticket transitioned to In Progress
- <[x]|[ ]> Step 3 — Complexity assessed (<tier or "pending">)
- <[x]|[ ]> Step 4 — Implemented
- <[x]|[ ]> Step 5 — Ready for Test

---

## Description
<ticket description from Jira — plain text, not ADF>

## Acceptance Criteria
<acceptance criteria, one item per line with - prefix>

## Git
| | |
|---|---|
| **Branch** | `<branch-name>` |
| **Commit** | `<hash message or *(pending)*>` |

---

## Notes
<preserved-notes>
````

### SR-8. Confirm save

Print:
```
✓ State saved → <file-path>
```
