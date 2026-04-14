---
name: optimize-skill-description
description: Use this skill to optimize a skill's description field so it triggers at the right times — not too often, not too little. Provide a skill directory path and a labeled eval set of queries (should_trigger: true/false). Runs entirely inline without an API key or subprocess calls by using Claude's own trigger self-evaluation. Use when a skill is over-triggering, under-triggering, or when you want to tune a description after new use cases were added.
argument-hint: <skill-path> [--eval-set <path>] [--iterations N]
---

# Optimize Skill Description

Replicates the logic of the skill-creator's `run_loop.py` + `improve_description.py` pipeline — without needing an API key, subprocess calls, or platform-specific tooling.

**The key insight:** The original tool runs `claude -p <query>` for each test case and watches if the skill fires. You *are* Claude — you can evaluate your own trigger behavior inline, more accurately and without any platform limitations.

---

## Step 1 — Parse inputs

Read the argument. Extract:

- **`<skill-path>`** — path to the skill directory (must contain `SKILL.md`)
- **`--eval-set <path>`** — path to a JSON file with format:
  ```json
  [{"query": "...", "should_trigger": true}, ...]
  ```
  If omitted, look for `trigger-eval.json` as a sibling to the skill directory, or in the nearest `*-workspace/` directory. If none found, tell the user and stop.
- **`--iterations N`** — max loop iterations (default: 5)

---

## Step 2 — Read the skill

Read `SKILL.md` from the skill directory. Extract:
- `name:` from frontmatter
- `description:` from frontmatter — **this is the value being optimized**
- Full body content — used in the improvement step for context

---

## Step 3 — Self-evaluation

For each query in the eval set, answer this question honestly:

> I am a fresh Claude instance. My available skills list shows: **"[skill name]: [current description]"**. I just received this user message: *"[query]"*. Would I invoke this skill?

Evaluate based on the **description alone** — not on your knowledge of what the skill actually does, not on whether invoking it would be helpful. Would that title + description make you reach for it?

For each query record:
- `triggered` — YES if you'd invoke it, NO if you wouldn't
- `expected` — the `should_trigger` value from the eval set
- `result` — PASS (prediction matches expected) or FAIL

Print a results table:

```
Query (truncated 80 chars)                                         Expected  Got    Result
------------------------------------------------------------------ --------  -----  ------
start on WEBR-696                                                  YES       YES    PASS
what was fixed in AUTH-55 last quarter?                            NO        NO     PASS
I see a reference to PROJ-123 in the readme, is it relevant?       NO        YES    FAIL (false trigger)
begin SWBPAY-3021                                                   YES       NO     FAIL (missed trigger)
```

Report the score: `N/M passed (P%)`

Categorise failures:
- **Missed triggers** — `should_trigger: true` but you predicted NO
- **False triggers** — `should_trigger: false` but you predicted YES

If all pass: write "✓ Description already optimal — N/N passed. No changes made." and stop.

---

## Step 4 — Improve the description

Use this structured reasoning prompt (directly from `improve_description.py`) to generate a better description. Think carefully before writing — the quality here determines how many iterations you'll need.

```
Skill: "<name>"

Goal: Write a description that appears in Claude's available_skills list and causes
Claude to invoke the skill for relevant queries and not invoke it for irrelevant ones.

Current description:
"<current_description>"

Current score: <N>/<M>

MISSED TRIGGERS (should trigger but didn't):
  - "<query>"
  - ...

FALSE TRIGGERS (triggered but shouldn't):
  - "<query>"
  - ...

Previous attempts (do NOT repeat — try structurally different approaches):
  Score <X>/<M>: "<description>"
  ...

Skill content (for context — not visible during trigger decisions):
<full SKILL.md body>
```

Reasoning guidelines (from the original codebase):
- **Generalise from failures** — don't list specific queries, find the pattern. "User is starting work on a ticket" not "user says 'start on WEBR-696'"
- **Stay under 200 words** (hard limit: 1024 characters) — this description is injected into every conversation; keep it lean
- **Imperative voice** — "Use when the user..." not "This skill..."
- **User intent, not mechanics** — describe what the user is trying to *do*, not how the skill works
- **Be distinctive** — make it clear enough that it won't accidentally match adjacent skills
- **If stuck after 2–3 iterations** — change approach entirely, try different framing

Write the new description inside `<new_description>...</new_description>` tags.

If the result exceeds 1024 characters, rewrite it shorter before proceeding.

---

## Step 5 — Write and loop

1. Extract new description from the `<new_description>` tags
2. Write it into `SKILL.md` — replace only the `description:` frontmatter value (preserve everything else)
3. Track: iteration number, description, score, and per-query results in memory
4. Go back to **Step 3** with the new description

Stop when:
- All queries pass (100%), OR
- Max iterations reached

---

## Step 6 — Final report

Print a summary:

```
## Description Optimization Complete

Iterations run: N / max M
Best score: X/total (P%) — achieved at iteration K

Best description:
"<best description text>"

History:
  Iter 0 (original):  X/M — "<first 60 chars of description>..."
  Iter 1:             X/M — "..."
  ...
  Iter N (final):     X/M — "..."
```

If the best-scoring description is not the one currently in `SKILL.md`, revert the file to the best one and note which iteration it came from.

---

## How self-evaluation works (and why it's accurate)

The original `run_eval.py` creates a temp command file with the description and runs `claude -p <query>` in a subprocess, then watches whether the `Skill` or `Read` tool fires. This tests: *"Would Claude invoke this skill when given this description and query?"*

You are Claude. You can answer that question directly, without process spawning. When you evaluate a query, you are doing exactly what the subprocess test does — except inline, in one pass, for all queries simultaneously. This is not an approximation; it's the same operation.

The original also uses **extended thinking** (`budget_tokens: 10000`) in the improve step. Take your time in Step 4 — reason through why each failure happened before writing the new description.

---

## Notes

- Designed as a drop-in replacement for `run_loop.py` when running on Windows or without an `ANTHROPIC_API_KEY`
- Train/test splitting: for eval sets > 30 queries, consider splitting 60/40 to catch overfitting — optimize against the train set, report score against the held-out test set
- The skill writes directly to `SKILL.md` — commit or stash before running if you want to preserve the original
