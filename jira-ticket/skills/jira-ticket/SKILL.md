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

This prompts the user to name the session after the ticket for easy identification in `/resume`. It cannot be automated — `/rename` is processed client-side and is not callable by the LLM. Continue to Step 1b without waiting.

---

## Step 1b — View image attachments (if any)

Jira returns image attachments as `blob:https://media.staging.atl-paas.net/...` URLs inside the description markdown. These URLs **cannot be fetched directly** — they are scoped to an authenticated browser session. The text alone gives no visual context.

**Detection** — scan the description for the substring `blob:https://media`. If absent, skip this step.

**If a Chrome browser MCP is available** (e.g. `mcp__claude-in-chrome__*`):

1. Navigate (or reuse an existing tab) to `<cloud-base-url>/browse/<TICKET-ID>`.
2. Wait for the page to render (3s is usually enough; longer for slow connections).
3. Scroll down to bring the description into view, take a screenshot.
4. If more images are referenced, scroll further and screenshot each.
5. Read the rendered images directly — they reveal mockups, bug screenshots, annotations, and other context that the markdown description omits.

**If no Chrome MCP is available** — note the limitation in the Step 3 summary:

```
Note: ticket description references <N> image attachment(s) that could not be rendered.
You may want to open the ticket in your browser before continuing.
```

Then continue. Do not block on this.

**Why this matters** — three out of three tickets in our reference workflow had mockups or bug screenshots that were essential to understanding the task. Skipping this step leads to implementing against incomplete specs.

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

**First, check the current status** (from the ticket data fetched in Step 1):

- If status is already "In Progress" → **skip the transition entirely**; note `Status: In Progress (already)` in the Step 3 summary.
- If status is past In Progress (e.g. "Ready for test", "Done") → **skip the transition**; note `Status: <current> (not moving backwards)` and ask the user whether they intended to reopen the ticket.
- Otherwise → proceed with the transition:
  1. Call `getTransitionsForJiraIssue` to get the available transitions for this ticket.
  2. Find the transition whose name matches "In Progress" (case-insensitive). Common transition names include `"Work started"`, `"Start progress"`, `"In Progress"`.
  3. Call `transitionJiraIssue` with that transition ID.

If the MCP call fails or no matching transition exists, note it in the Step 3 summary but do not stop — branch setup already succeeded.

After the transition attempt (success, skipped, or failed), call the **Save State Routine** — unless the project's `CLAUDE.md` contains `jira-autosave: disabled`, in which case skip silently.

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

## On-Demand Save

**Triggers:** User says "save", "save state", "checkpoint", or "save progress".

Call the **Save State Routine** immediately. Do not perform any other action.

---

## Step 4.5 — Ship (optional)

**Triggers:** User says "ship it", "merge to main", "push to main", "deploy this", or similar shipping phrasing — OR the project's `ship-strategy:` directive is `direct-merge` or `pull-request` AND the user proceeds to Step 5 without manually merging first.

This step is **optional**. If the project has `ship-strategy: none` (the default), skip silently — the user will integrate the branch manually.

If `ship-branch` plugin is installed, invoke it. It will:
1. Read the project's `ship-strategy:`, `main-branch:`, and `merge-commit-format:` directives.
2. Merge the current feature branch to main (or open a PR) using the configured strategy.
3. Handle remote race conditions safely (clean rebase or guarded reset+remerge).
4. Print the merge commit SHA.

Capture the merge commit SHA for use in Step 5a's draft comment ("merged to main as `<sha>`").

If `ship-branch` is **not** installed but the project sets a `ship-strategy:` other than `none`, print:

```
Note: ship-strategy is "<strategy>" but the ship-branch plugin is not installed.
You can install it with /plugin install ship-branch@robert-personal, or merge manually.
```

…and continue to Step 5 without blocking.

---

## Step 5 — Completion Flow (Ready for Test)

**Triggers:** User says "ready for test", "move to ready for test", "done with the ticket", "mark as RFT", or similar completion phrasing.

### 5a. Draft completion comment

Build a comment summarizing what was implemented and verified. Base it on:
- The ticket description and acceptance criteria (from Step 1)
- What was actually changed (git diff or file inspection)
- Any verification evidence (environment URLs, computed values, test output)
- A build badge / pipeline link if `build-host` resolves (see "Optional: enrich with build badge" below)
- The `rft-comment-suffix` directive from the project's CLAUDE.md, if set — append it as the last paragraph (see [Project Configuration](#project-configuration) for named templates like `cloudflare-cache-hint`)

Structure:
- What was done (brief, specific — mention themes/files if relevant)
- Verification results with environment and evidence
- Build link / badge paragraph (from `build-host`, if resolves)
- Deployment hint paragraph (from `rft-comment-suffix`, if set)

**Optional: enrich with build badge.**
Read the `build-host` directive (default `auto`). If set to `none`, skip. Otherwise:

1. If `auto`, run `git remote get-url origin` and dispatch to the matching host-specific skill:
   - `dev.azure.com` or `*.visualstudio.com` → `azure-devops-build`
   - (future) `github.com` → `github-build-status`
2. Invoke the resolved skill with the merge commit's branch (typically `main`).
3. Parse its two-line output:
   ```
   BADGE_MD: <markdown badge or empty>
   PIPELINE_URL: <pipeline URL>
   ```
4. If `BADGE_MD` is non-empty, add this paragraph to the draft:
   ```
   Build: <BADGE_MD>   ([Pipelines](<PIPELINE_URL>))
   ```
   If `BADGE_MD` is empty but `PIPELINE_URL` is present, add:
   ```
   Build: [Pipelines](<PIPELINE_URL>)
   ```
5. If the host-specific skill prints `not-azure` (or similar no-op signal) or isn't installed, silently skip — do not block on missing optional skills.

### 5b. Identify @mentions and reassignee

**@mentions** — ask the user who to mention, or suggest based on:
- Anyone who gave direction in ticket comments
- The reporter (some teams want the reporter mentioned explicitly even though Jira auto-notifies; check project policy via the `rft-mention-reporter` directive — see [Project Configuration](#project-configuration))

**Reassignee** — determine who should own the ticket during testing. Read in this order, first match wins:
1. User's explicit instruction in this turn ("assign to X").
2. Project `CLAUDE.md` directive `rft-assignee:` — one of `reporter` | `current` | `<accountId>` | `<email>`.
3. Default: do not reassign; ask the user one short question before posting:
   ```
   Reassign to <reporter-name> (the reporter) for testing? (yes / no / someone else)
   ```

Look up account IDs with `lookupJiraAccountId`.

### 5c. Show draft for approval

Print the full comment exactly as it will appear, plus the planned reassignment:

```
Proposed comment for <TICKET-ID>:

@Name1 @Name2

<comment body>

Reassign to: <name | "no change">
Post this and move to Ready for Test? (yes / edit / cancel)
```

**Do not post or reassign anything until the user approves.**

- `yes` / `go` / `approve` → proceed with all three actions (comment, reassign, transition)
- `edit` + revised text → update draft, show again
- `cancel` / `no` → stop, nothing changes on the ticket

### 5d. Post comment

Call `addCommentToJiraIssue` with `contentFormat: "adf"` to preserve @mention formatting.

See the [ADF Comment Template](#adf-comment-template) section for the structure to use.

### 5e. Reassign (if planned)

If reassignment was confirmed in 5c, call `editJiraIssue` with:

```json
{
  "fields": { "assignee": { "accountId": "<accountId>" } }
}
```

Skip silently if "no change" was chosen.

### 5f. Transition to Ready for Test

1. Call `getTransitionsForJiraIssue`
2. Find the transition whose name contains "ready" and "test" (case-insensitive)
3. Call `transitionJiraIssue`

If no matching transition exists, list available options and ask the user which to apply.

Print confirmation:
```
✓ Comment posted to <TICKET-ID>
✓ Reassigned to <name>        (omit line if no change)
✓ Status → Ready for Test
```

Call the **Save State Routine** with status `COMPLETE ✓` — Step 5 is now complete — unless the project's `CLAUDE.md` contains `jira-autosave: disabled`, in which case skip silently.

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

If the file already exists, read it. Extract everything from `## Notes` to end of file — this is `<preserved-notes>`. If the file exists but contains no `## Notes` heading, `<preserved-notes>` is empty. If the file does not exist, `<preserved-notes>` is empty.

### SR-3. Determine completed steps

Evaluate which steps have been completed in this session:

| Step | Completed if... |
|---|---|
| Step 1 | Always true when this routine is called |
| Step 2 | A branch was checked out or created this session |
| Step 3 | Complexity tier was assessed and printed |
| Step 4 | Implementation commits exist on branch (`git log` from SR-4 shows at least one commit) |
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
- On-demand save and the existing file's header already shows `COMPLETE ✓` → retain `COMPLETE ✓`
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
<preserved-notes — if empty, write "*(none yet)*">
````

### SR-8. Confirm save

Print:
```
✓ State saved → <file-path>
```

---

## ADF Comment Template

`addCommentToJiraIssue` accepts either `markdown` or `adf` content format. **Use ADF** whenever the comment contains an `@mention` — markdown rendering of mentions is unreliable.

Minimal ADF skeleton for a comment with one mention and a few paragraphs:

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "mention", "attrs": { "id": "<accountId>", "text": "@<DisplayName>" } },
        { "type": "text", "text": " " }
      ]
    },
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "<First paragraph of body>" }]
    },
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "<Second paragraph>" }]
    }
  ]
}
```

To add a bullet list:

```json
{
  "type": "bulletList",
  "content": [
    {
      "type": "listItem",
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "<item 1>" }] }
      ]
    }
  ]
}
```

**Recipe for the standard RFT comment** — string together in order:
1. One `paragraph` containing the `mention` node(s) and a trailing space.
2. One `paragraph` with `<one-line summary including commit + merge SHAs>`.
3. Either more `paragraph` nodes or a `bulletList` describing the changes.
4. One `paragraph` with verification evidence (environment URL, what was tested).
5. One `paragraph` with the deployment hint from `rft-comment-suffix` if set (see Project Configuration).

---

## Project Configuration

Jira-ticket reads optional directives from the **consuming repo's `CLAUDE.md`** (the project being worked on, not the skill's own CLAUDE.md). Discovery order: walk up from the current working directory until a `CLAUDE.md` is found; check it for the directives below. If a workspace-level `CLAUDE.md` exists one level up, it provides defaults that can be overridden by the project-level file.

Directives are declared as `key: value` pairs in any code block or paragraph that begins with `<!-- jira-ticket -->` or on a line by themselves anywhere in the file.

| Directive | Values | Effect |
|---|---|---|
| `jira-autosave` | `enabled` (default) \| `disabled` | When `disabled`, skip the Save State Routine entirely. |
| `rft-assignee` | `reporter` \| `current` \| `<accountId>` \| `<email>` | Who to reassign to in Step 5e. Default: ask. |
| `rft-mention-reporter` | `always` \| `if-asked` (default) \| `never` | Whether to add the reporter as an `@mention` in the RFT comment. |
| `rft-comment-suffix` | free text or named template (e.g. `cloudflare-cache-hint`) | Extra paragraph appended to the RFT comment body. Useful for deployment quirks. |
| `merge-commit-format` | format string with `{TICKET-ID}` and `{TITLE}` placeholders | Used by `ship-branch` for the merge commit message. Default: `Merge {TICKET-ID}: {TITLE}`. |
| `ship-strategy` | `direct-merge` \| `pull-request` \| `none` | What Step 4.5 (Ship) does. Default: `none` (no shipping unless user asks). |
| `build-host` | `auto` (default) \| `azure-devops` \| `github` \| `gitlab` \| `none` | Which CI host to query for a build badge in Step 5a. `auto` runs `git remote get-url origin` and detects from the URL. |
| `branch-prefix-overrides` | YAML map (see example) | Override default branch prefixes per issue type. |

**Named templates** for `rft-comment-suffix`:

| Template name | Renders as |
|---|---|
| `cloudflare-cache-hint` | `Note: the Cloudflare cache may need to be cleared before the change is visible on test.` |
| `vercel-preview-hint` | `A preview deployment will be available at <preview-url> once the build completes.` |
| `manual-deploy-hint` | `This change requires a manual deploy — ping the on-call before testing.` |

**Example project CLAUDE.md snippet:**

```
<!-- jira-ticket -->
rft-assignee: reporter
rft-mention-reporter: always
rft-comment-suffix: cloudflare-cache-hint
ship-strategy: direct-merge
merge-commit-format: Merge {TICKET-ID}: {TITLE}
build-host: auto
```

With this configuration, the SCA workflow we documented becomes fully declarative — no per-ticket prompting needed for reassignment, cache hints, or merge format.
