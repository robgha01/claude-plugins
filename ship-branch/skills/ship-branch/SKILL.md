---
name: ship-branch
description: Use when work on a feature/bugfix/chore branch is complete and the user wants to integrate it into the main branch — typical triggers are "ship it", "merge to main", "push to main", "deploy this", or orchestration from a higher-level skill (e.g. jira-ticket Step 4.5). Respects the project's configured ship strategy (direct-merge, pull-request, or none).
argument-hint: [<feature-branch>]
allowed-tools:
  - Bash
  - Read
  - Write
---

# Ship Branch

This skill integrates a feature branch into the project's main branch using the strategy declared in the project's `CLAUDE.md`. It handles remote race conditions (someone else pushed while you worked) **safely** — it never resets local refs when there is unique local work to lose.

---

## Step 1 — Resolve inputs

**Feature branch** — the argument to the skill, or the current branch from `git branch --show-current` if the argument is omitted. If the current branch IS the main branch, refuse:

```
Refusing to ship: you are currently on the main branch.
Switch to the feature branch first, then re-run the skill.
```

**Main branch** — `main` by default. Override via project `CLAUDE.md` directive `main-branch: <name>` (some projects use `master`, `trunk`, `develop`).

**Ship strategy** — read from project `CLAUDE.md` directive `ship-strategy:`. Values:
- `direct-merge` (default for personal projects) — merge to main locally and push.
- `pull-request` — push the feature branch and open a PR via `gh` or the host's CLI.
- `none` — refuse to ship; the user must do it manually.

**Merge commit format** — read `merge-commit-format:` from project `CLAUDE.md`. Default: `Merge {BRANCH-LAST-SEGMENT}: {SUBJECT}` where `{SUBJECT}` is the feature branch's most recent commit subject. Common templates:

| Template | Renders as |
|---|---|
| `Merge {TICKET-ID}: {TITLE}` | `Merge SSBP-117: Redesign My Products print layout` |
| `Merge branch '{BRANCH}'` | (git default) |
| `{SUBJECT}` | The squashed-style: just the work commit's subject |

When `{TICKET-ID}` is in the template, extract it from the branch name (e.g. `bugfix/SSBP-112-fix-foo` → `SSBP-112`). If the branch has no ticket ID and the template needs one, fall back to `Merge {BRANCH}`.

---

## Step 2 — Pre-flight checks

Refuse with a clear message if any check fails:

1. **Uncommitted changes** — `git status --porcelain` must be empty. If not:
   ```
   Refusing to ship: you have uncommitted changes on <branch>.
   Commit or stash them, then re-run the skill.
   ```

2. **Feature branch exists locally** — `git rev-parse --verify <feature-branch>` must succeed.

3. **Feature branch has commits ahead of main** — `git rev-list --count <main>..<feature-branch>` must be > 0. If 0:
   ```
   Refusing to ship: <feature-branch> has no commits beyond <main>.
   ```

4. **Remote `origin` exists** — required for the push step. If absent, only do the local merge and warn.

---

## Step 3 — Dispatch by strategy

### 3a. `ship-strategy: direct-merge`

Perform the merge locally, then push:

```bash
git fetch origin <main>
git checkout <main>
git merge --ff-only origin/<main>          # fast-forward to remote head
git merge --no-ff <feature-branch> -m "<rendered-merge-message>"
git push origin <main>
```

If the push is rejected (`! [rejected] main -> main (fetch first)`), proceed to **Step 4 — Race handling**.

### 3b. `ship-strategy: pull-request`

Push the feature branch, then open a PR:

```bash
git push -u origin <feature-branch>
```

Then detect the host (same logic as `azure-devops-build` host detection) and use the appropriate CLI:

| Host | Command |
|---|---|
| GitHub | `gh pr create --title "<TITLE>" --body "<BODY>" --base <main>` |
| Azure DevOps | `az repos pr create --title "<TITLE>" --description "<BODY>" --target-branch <main>` |
| GitLab | `glab mr create --title "<TITLE>" --description "<BODY>" --target-branch <main>` |

Use the same `{TICKET-ID}: {TITLE}` rendering for the PR title.

### 3c. `ship-strategy: none`

Refuse with:

```
Refusing to ship: this project sets ship-strategy: none.
The user must merge and push manually.
```

---

## Step 4 — Race condition handling (direct-merge only)

When the push is rejected because origin/main has new commits, choose the safest applicable strategy:

### 4a. Fast-path: clean rebase

If our local main has only **non-merge** commits beyond `origin/main` AND we have not yet created the merge commit, just rebase:

```bash
git pull --rebase origin <main>
git push origin <main>
```

If the rebase has conflicts, abort it (`git rebase --abort`) and fall through to 4b.

### 4b. Safer-path: reset + remerge

This path is appropriate when our local main has a single merge commit on top of origin/main, and that merge commit only adds the feature branch's content (no unique work).

**Safety check** — before any `reset --hard`, verify ALL of the following:

1. `git diff origin/<main>..<main> -- :!*` shows only changes that also appear in `git diff <main>..<feature-branch>`. In practice: `git log origin/<main>..<main> --not <feature-branch> --oneline` must be empty (no commits unique to local main).
2. The feature branch still exists: `git rev-parse --verify <feature-branch>` succeeds.
3. The feature branch's most recent work commit still exists: at least one commit beyond origin/main.

If any check fails, **refuse to reset**:

```
Refusing to reset local <main>: it contains commits not present on
<feature-branch>. Manual intervention required:
  1. Inspect: git log origin/<main>..<main> --not <feature-branch>
  2. Decide what to keep, then merge by hand.
```

If all checks pass, proceed:

```bash
git reset --hard origin/<main>
git merge --no-ff <feature-branch> -m "<rendered-merge-message>"
git push origin <main>
```

### 4c. Last resort: stop and report

If neither path applies (e.g. local main has unique non-merge work that isn't on the feature branch), stop and tell the user. Print the diverging commits and ask them to handle it manually.

---

## Step 5 — Confirm

Print:

```
✓ <feature-branch> merged into <main>
  Local merge:  <merge-commit-sha-short> <merge-commit-subject>
  Pushed to:    origin/<main>
```

The calling skill (e.g. `jira-ticket` Step 5) can now reference the merge commit SHA in its RFT comment.

---

## Notes

- This skill **does not delete** the feature branch after merging. Branch cleanup is intentionally out of scope — leave it to the user or to a follow-up `prune-merged-branches` skill.
- For `pull-request` strategy, the skill does not wait for the PR to be merged. It pushes the branch and opens the PR, then exits. The caller is responsible for follow-up.
- Force-push is **never** used by this skill.
- `--no-verify` (skipping hooks) is **never** used. If a hook fails, fix the underlying issue.
- The race-condition safety check in Step 4b is the same safety property we relied on when shipping SSBP-117 manually: the local merge commit must contain no unique work outside the feature branch being shipped.
