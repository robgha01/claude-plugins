# jira-ticket Skill — Evaluation Summary

Two iterations of testing were run against the jira-ticket skill using three test cases. This document summarises what each test case checks, what the results were per iteration, and what was fixed.

---

## Test Cases

### TC-1 · `start on WEBR-696` — Bug ticket, Simple tier
Verifies the happy path for a Bug-type ticket: Jira fetch, correct branch prefix, tier assessment, and status transition.

**Assertions (8):**
1. Announces "Starting jira-ticket protocol for WEBR-696"
2. Calls `getJiraIssue` with WEBR-696
3. Checks for uncommitted changes before branching
4. Branch uses `bugfix/` prefix (not `feature/`) because issue type is Bug
5. Branch name contains WEBR-696
6. Tier assessed as Simple
7. Summary table printed with Ticket / Type / Branch / Tier fields
8. Calls `getTransitionsForJiraIssue` to attempt "In Progress" transition

---

### TC-2 · `let's work on WEBR-698` — Story ticket, tier assessment
Verifies that a lightweight Story (1 AC, no story points) is classified as Simple, not Complex. Also checks branch prefix and status transition.

**Assertions (8):**
1. Announces "Starting jira-ticket protocol for WEBR-698"
2. Calls `getJiraIssue` with WEBR-698
3. Checks for uncommitted changes before branching
4. Branch uses `feature/` prefix
5. Branch name contains WEBR-698
6. Summary table printed
7. Calls `getTransitionsForJiraIssue` to attempt "In Progress" transition
8. Tier is Simple (not Complex) — Story + 1 AC + unset points

---

### TC-3 · `begin WEBR-9999` — Non-existent ticket, error handling
Verifies that a failed Jira lookup stops all execution cleanly with the required error message and no git operations.

**Assertions (5):**
1. Attempts `getJiraIssue` for WEBR-9999
2. Output contains `Error: Could not fetch WEBR-9999`
3. Output contains `No git operations have been performed`
4. Zero git commands executed
5. No branch created or checked out

---

## Iteration 1

**Baseline:** with_skill (original v1) vs without_skill (no skill at all)  
**Environment issue:** Atlassian MCP not pre-approved for subagents — all `getJiraIssue` calls were blocked by a permission wall.

| Test Case | with_skill | without_skill |
|---|---|---|
| TC-1 WEBR-696 Bug | 2/7 (29%) | 0/7 (0%) |
| TC-2 WEBR-698 Story | 2/6 (33%) | 0/6 (0%) |
| TC-3 WEBR-9999 Error | 5/5 (100%) | 2/5 (40%) |
| **Mean** | **54%** | **13%** |

**TC-1 and TC-2 failures** were caused entirely by the MCP permission wall — the skill couldn't fetch the ticket so Steps 2 and 3 were never reached. The 2 passing assertions in each (announcement + attempted `getJiraIssue` call) were the only things that ran.

**TC-3 passed 5/5** in the with_skill run because error handling fires as soon as the fetch fails — it doesn't need Jira to succeed to be testable.

**Static analysis of the v1 skill** (done while MCP-blocked runs were in progress) identified four bugs:

| # | Bug | Impact |
|---|---|---|
| 1 | `Edit` and `Write` missing from `allowed-tools` | Simple-tier implementation steps would silently fail — skill can't edit files |
| 2 | Branch always used `feature/` prefix regardless of issue type | Bug tickets got `feature/` instead of `bugfix/`, Task tickets got `feature/` instead of `chore/` |
| 3 | No uncommitted changes guard before branching | Branch switch could silently carry or lose uncommitted work |
| 4 | No Jira status transition step | Ticket was never moved to "In Progress" after branch creation |

A fifth bug was confirmed by reasoning through the tier logic table:

| # | Bug | Impact |
|---|---|---|
| 5 | Story + ≤2 AC + unset story points fell through all tier rules → defaulted to Complex | Lightweight Story tickets triggered unnecessary brainstorming + planning overhead |

---

## Fixes Applied (v1 → v2)

All five issues were fixed in `jira-ticket/skills/jira-ticket/SKILL.md`:

**1. Added `Edit` and `Write` to `allowed-tools`**
```yaml
allowed-tools:
  - Bash
  - Read
  - Edit     # added
  - Write    # added
  - Grep
  - Glob
```

**2. Type-aware branch prefix**
Old: always `feature/<TICKET-ID>-<short-title>`
New:
- `Bug` → `bugfix/`
- `Task` → `chore/`
- `Story`, `Epic`, or anything else → `feature/`

**3. Step 2a — Uncommitted changes guard** (new step, inserted before branch search)
Runs `git status --porcelain`. If dirty, prompts the user:
- `[S]` Stash and continue
- `[C]` Continue anyway
- `[X]` Stop

**4. Step 2h — Jira "In Progress" transition** (new step, after branch checkout)
Calls `getTransitionsForJiraIssue`, finds the "In Progress" transition (case-insensitive), calls `transitionJiraIssue`. If no matching transition exists or the call fails, notes it in the summary and continues — branch setup is not blocked.

**5. Tier logic — Simple rule for lightweight Stories**

Old table (problematic):
| Tier | Rule |
|---|---|
| Complex | Epic, OR ≥5 points, OR ≥5 AC, OR vague description |
| Medium | Story AND 3–5 AC AND points 3–4 |
| Simple | Bug/Task AND ≤2 AC AND ≤2 points |
| **Complex** | **Fallback — Story+low-AC+unset hit this** |

New table (fixed):
| Tier | Rule |
|---|---|
| Complex | Epic, OR ≥5 points, OR ≥5 AC |
| Simple | Bug or Task AND ≤2 AC AND ≤2 points (or unset) |
| **Simple** | **Story AND ≤2 AC AND ≤2 points (or unset) — new rule** |
| Medium | Story AND 3–4 AC, OR points 3–4 |
| Complex | Fallback |

**Additional fix during iteration 2:** Added cloudId discovery hint to Step 1. Agents were guessing 3–5 Atlassian cloud IDs before finding the right one. The skill now instructs agents to call `getAccessibleAtlassianResources` first; if denied, infer from the project key prefix.

---

## Iteration 2

**Baseline:** with_skill (v2, post-fixes) vs old_skill (v1, pre-fixes)  
**Environment fix:** Atlassian MCP tools added to `permissions.allow` in `~/.claude/settings.json` so subagents can call them without per-call approval.

| Test Case | v2 (with_skill) | v1 (old_skill) | Delta |
|---|---|---|---|
| TC-1 WEBR-696 Bug | 8/8 (100%) | 5/8 (62.5%) | +37.5% |
| TC-2 WEBR-698 Story | 7/8 (87.5%) | 5/8 (62.5%) | +25% |
| TC-3 WEBR-9999 Error | 5/5 (100%) | 5/5 (100%) | 0% (no regression) |
| **Mean** | **95.8%** | **75.0%** | **+20.8%** |

**TC-1 (WEBR-696) — 8/8 for v2:**
All four fixes confirmed working live: `bugfix/` prefix used, `git status` ran and reported uncommitted changes, `getTransitionsForJiraIssue` called (gracefully degraded — test ticket has no "In Progress" transition), tier correctly Simple.

**TC-1 (WEBR-696) — 5/8 for v1:**
Exactly the 3 missing features failed: no uncommitted changes check, `feature/` prefix instead of `bugfix/`, no transition attempt.

**TC-2 (WEBR-698) — 7/8 for v2:**
Tier correctly Simple (1 AC, unset points). One failure: Bash was denied in the subagent due to a timing race with the settings update — the `git status` check was inferred rather than actually run. This is an eval environment artefact, not a real skill bug.

**TC-2 (WEBR-698) — 5/8 for v1:**
Tier assessed as **Complex** via fallback — the exact bug that was fixed. Also missing uncommitted guard and Jira transition.

**TC-3 (WEBR-9999):** Unchanged 5/5 in both — error handling was already correct in v1 and stayed correct in v2.

---

---

## Iteration 3

**Scope:** Validation of the two new edge-case paths added in v2 — both require environment setup so they were run as a separate iteration.  
**Baseline:** No comparison run — these scenarios did not exist in v1 at all.

### TC-4 · `start on WEBR-696` (dirty git state) — Uncommitted stash flow

Verifies the Step 2a guard when uncommitted changes are present and the user chooses `[S]` to stash.

| Test Case | with_skill (v2) |
|---|---|
| TC-4 Uncommitted stash flow | 8/8 (100%) |
| TC-5 Existing branch checkout | 8/8 (100%) |
| **Mean** | **100%** |

**TC-4 key results:**
- Dirty state detected by `git status --porcelain` (6 uncommitted items)
- `[S] / [C] / [X]` prompt presented before branch operations
- `git stash` ran successfully; stash confirmed before any branch search
- `bugfix/WEBR-696-...` created after stash (Bug prefix, correct)
- Tier: Simple (Bug, 0 AC, unset points)
- `getTransitionsForJiraIssue` called; graceful degradation on no "In Progress"

**TC-5 key results:**
- `git branch --list "*WEBR-698*"` found pre-existing `feature/WEBR-698-existing-test`
- Authorship confirmed: `git log -1 --format="%an"` matched `git config user.name` (both "Robert Ghafoor")
- Decision table correctly routed to `git checkout` (not `checkout -b`) — no new branch created
- Summary said `(switched to existing branch)` not `(created)`
- Tier: Simple (Story, 1 AC, unset points)

---

## Overall Progression

| Metric | Iteration 1 (vs no-skill) | Iteration 2 (v2 vs v1) | Iteration 3 (new paths) |
|---|---|---|---|
| with_skill mean pass rate | 54% | 95.8% | 100% |
| baseline mean pass rate | 13% | 75.0% | n/a (new scenarios) |
| Delta | +41% | +21% | — |
| MCP reachable | No | Yes | Yes |
| Bugs confirmed live | 0 (all blocked) | 4 of 5 bugs confirmed | All new paths confirmed |
