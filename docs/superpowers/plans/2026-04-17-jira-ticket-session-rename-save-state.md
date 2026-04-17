# Jira Ticket — Session Rename + Save State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a session rename prompt and a progressive save state file to the jira-ticket skill so sessions are easy to identify and work can be resumed across days.

**Architecture:** All changes are confined to `jira-ticket/skills/jira-ticket/SKILL.md`. A new `## Save State Routine` section defines the file-writing logic once; milestones and on-demand triggers reference it. The rename prompt is a one-liner appended to Step 1.

**Tech Stack:** Markdown skill file, Bash (git commands), Write/Read/Edit tools for file I/O.

---

## File Map

| File | Change |
|---|---|
| `jira-ticket/skills/jira-ticket/SKILL.md` | 5 edits: rename prompt, save routine section, Step 2h wire-up, on-demand trigger, Step 5e wire-up |

No new files created. No other files touched.

---

### Task 1: Add rename prompt to Step 1

**Files:**
- Modify: `jira-ticket/skills/jira-ticket/SKILL.md`

The rename prompt goes immediately after the "On failure" block in Step 1 (currently ends around line 44). It must appear **only on success** — after ticket data is confirmed extracted.

- [ ] **Step 1: Open the skill file and locate the end of Step 1**

Read `jira-ticket/skills/jira-ticket/SKILL.md`. Find the line:
```
Do not touch git. Do not continue.
```
This is the last line of the "On failure" block. The rename prompt goes after the closing `---` that follows it... actually it goes BEFORE the closing `---` separator, as the final success action of Step 1.

- [ ] **Step 2: Add the rename prompt**

Insert the following block immediately before the `---` separator that ends Step 1 (after the `Do not touch git. Do not continue.` line — that line is the last thing in Step 1's failure block):

```markdown
**On success** — after ticket data is extracted, print:

```
→ /rename <TICKET-ID>
```

This prompts the user to name the session after the ticket for easy identification in `/resume`. It cannot be automated — `/rename` is processed client-side and is not callable by the LLM.
```

- [ ] **Step 3: Verify placement**

Read the modified file. Confirm:
- The rename prompt block appears inside Step 1, after the failure block
- It does NOT appear inside the failure path (which ends with "Do not continue.")
- The `---` separator still correctly closes Step 1

- [ ] **Step 4: Commit**

```bash
git add jira-ticket/skills/jira-ticket/SKILL.md
git commit -m "feat(jira-ticket): add session rename prompt to Step 1"
```

---

### Task 2: Add Save State Routine section

**Files:**
- Modify: `jira-ticket/skills/jira-ticket/SKILL.md`

This section is the single definition of save logic. All triggers reference it by name. It goes after Step 5 (after line 293, end of file).

- [ ] **Step 1: Append the Save State Routine section**

Add the following to the end of `jira-ticket/skills/jira-ticket/SKILL.md`:

````markdown

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

Use the Atlassian cloud base URL discovered in Step 1 (e.g. `https://comprend.atlassian.net`):
```
<cloud-base-url>/browse/<TICKET-ID>
```

### SR-7. Write the file

Write the complete file using the template below. All `<placeholders>` are replaced with real values from Steps 1–6 above.

```markdown
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
```

### SR-8. Confirm save

Print:
```
✓ State saved → <file-path>
```
````

- [ ] **Step 2: Verify the section was appended cleanly**

Read the end of the file. Confirm:
- `## Save State Routine` appears after the Step 5 closing `---`
- All 8 sub-steps (SR-1 through SR-8) are present
- The template uses `<placeholders>` consistently (no hardcoded values like `comprend`)
- The Notes preservation logic handles both "file exists" and "file does not exist" cases

- [ ] **Step 3: Commit**

```bash
git add jira-ticket/skills/jira-ticket/SKILL.md
git commit -m "feat(jira-ticket): add Save State Routine section"
```

---

### Task 3: Wire auto-save to Step 2h

**Files:**
- Modify: `jira-ticket/skills/jira-ticket/SKILL.md`

Step 2h currently ends after the "note it in the summary but do not stop" line. Add a save call after it.

- [ ] **Step 1: Locate the end of Step 2h**

Find this text in the skill:
```
If the MCP call fails or the "In Progress" transition doesn't exist, note it in the summary but do not stop — branch setup already succeeded.
```

- [ ] **Step 2: Append save call to Step 2h**

Immediately after that line, add:

```markdown

After the transition attempt (success or failure), call the **Save State Routine**.
```

- [ ] **Step 3: Verify**

Read Step 2h. Confirm:
- Save call appears after the transition attempt line
- It is clear the save happens regardless of whether the transition succeeded

- [ ] **Step 4: Commit**

```bash
git add jira-ticket/skills/jira-ticket/SKILL.md
git commit -m "feat(jira-ticket): auto-save state after Step 2 branch setup"
```

---

### Task 4: Add on-demand save trigger

**Files:**
- Modify: `jira-ticket/skills/jira-ticket/SKILL.md`

The on-demand trigger goes at the top of the skill alongside the Step 5 trigger. Step 5 is already a trigger section — add the save trigger in the same pattern, just above or below it.

- [ ] **Step 1: Locate the Step 5 trigger header**

Find this line in the skill:
```
**Triggers:** User says "ready for test", "move to ready for test", "done with the ticket", "mark as RFT", or similar completion phrasing.
```

- [ ] **Step 2: Add the on-demand save trigger section**

Insert the following block immediately BEFORE `## Step 5 — Completion Flow (Ready for Test)`:

```markdown
## On-Demand Save

**Triggers:** User says "save", "save state", "checkpoint", or "save progress".

Call the **Save State Routine** immediately. Do not perform any other action.

---

```

- [ ] **Step 3: Verify**

Read the area around the new section. Confirm:
- The on-demand trigger section appears before Step 5
- It contains exactly the four trigger phrases
- It calls the Save State Routine and does nothing else
- The `---` separator cleanly separates it from Step 5

- [ ] **Step 4: Commit**

```bash
git add jira-ticket/skills/jira-ticket/SKILL.md
git commit -m "feat(jira-ticket): add on-demand save trigger"
```

---

### Task 5: Wire auto-save to Step 5e

**Files:**
- Modify: `jira-ticket/skills/jira-ticket/SKILL.md`

Step 5e currently ends after printing the confirmation block. Add a save call with COMPLETE status.

- [ ] **Step 1: Locate the end of Step 5e**

Find this text in the skill:
```
✓ Comment posted to <TICKET-ID>
✓ Status → Ready for Test
```
(This is inside the confirmation print block at the end of Step 5e.)

- [ ] **Step 2: Append save call after the confirmation block**

Immediately after the closing triple-backtick of that confirmation block, add:

```markdown

Call the **Save State Routine** with status `COMPLETE ✓` — Step 5 is now complete.
```

- [ ] **Step 3: Verify**

Read Step 5e. Confirm:
- The save call appears after the `✓ Status → Ready for Test` confirmation
- It explicitly names `COMPLETE ✓` so the routine sets the correct status
- Nothing else changed in Step 5

- [ ] **Step 4: Final read of complete skill**

Read the entire `SKILL.md` from top to bottom. Verify:
1. Step 1 ends with the rename prompt (on success path only)
2. Step 2h ends with a Save State Routine call
3. On-demand save trigger section exists before Step 5
4. Step 5e ends with a Save State Routine call specifying `COMPLETE ✓`
5. Save State Routine section exists at end of file with all 8 sub-steps
6. No hardcoded company names, URLs, or ticket IDs anywhere in new text

- [ ] **Step 5: Commit**

```bash
git add jira-ticket/skills/jira-ticket/SKILL.md
git commit -m "feat(jira-ticket): auto-save state on Step 5 completion"
```
