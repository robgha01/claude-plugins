# 🎯 optimize-skill-description

A Claude Code plugin that iteratively improves a skill's `description:` field so it triggers at the right times — not too often, not too little.

Drop-in replacement for the skill-creator's `run_loop.py` + `improve_description.py` pipeline. Works entirely inline — no API key, no subprocess calls, no Windows compatibility issues.

---

## 🚀 Installation

### Step 1 — Add the marketplace

```
/plugin marketplace add https://github.com/robgha01/claude-plugins.git
```

### Step 2 — Install the plugin

```
/plugin install optimize-skill-description@robert-personal
```

### Step 3 — Reload

```
/reload-plugins
```

---

## ⚡ Usage

```
/optimize-skill-description <skill-path> [--eval-set <path>] [--iterations N]
```

**Examples:**

```
/optimize-skill-description ./my-plugin/skills/my-skill
```

```
/optimize-skill-description ./my-plugin/skills/my-skill --eval-set ./trigger-eval.json
```

```
/optimize-skill-description ./my-plugin/skills/my-skill --eval-set ./trigger-eval.json --iterations 3
```

**Arguments:**

| Argument | Required | Description |
|---|---|---|
| `<skill-path>` | Yes | Path to the skill directory containing `SKILL.md` |
| `--eval-set <path>` | No | Path to a trigger eval JSON file (see format below). If omitted, looks for `trigger-eval.json` near the skill. |
| `--iterations N` | No | Max optimization iterations (default: 5) |

---

## 📄 Eval Set Format

Create a JSON file with a list of queries labeled with whether the skill should trigger:

```json
[
  { "query": "start on WEBR-696", "should_trigger": true },
  { "query": "let's kick off SWBPAY-1234 today", "should_trigger": true },
  { "query": "what was fixed in AUTH-55 last quarter?", "should_trigger": false },
  { "query": "search the codebase for PROJ-123 references", "should_trigger": false }
]
```

Aim for a balanced set: roughly equal numbers of `true` and `false` cases, covering the edge cases where you want the skill to fire and the adjacent topics where it shouldn't.

---

## 🔄 What Happens

The skill runs an optimization loop up to N times:

**1. Read** — loads `description:` from the skill's `SKILL.md` frontmatter

**2. Self-evaluate** — for each query in the eval set, predicts whether the current description would cause Claude to invoke the skill. Prints a results table:

```
Query                                                              Expected  Got    Result
------------------------------------------------------------------ --------  -----  ------
start on WEBR-696                                                  YES       YES    PASS
what was fixed in AUTH-55 last quarter?                            NO        YES    FAIL (false trigger)
```

**3. Improve** — if any queries fail, applies the same structured improvement prompt used by `improve_description.py` to generate a better description. Generalises from failures rather than enumerating specific queries.

**4. Write & repeat** — writes the new description back to `SKILL.md` and re-evaluates.

**5. Report** — prints a summary of all iterations and applies the best-scoring description.

---

## 📊 Example Output

```
## Description Optimization Complete

Iterations run: 2 / max 5
Best score: 20/20 (100%) — achieved at iteration 0

Best description:
"Use when user provides a Jira ticket ID (pattern [A-Z]+-[0-9]+) in their
message, or when /jira-ticket is invoked. The ID format itself is the trigger
— no magic phrase needed. Skip only when the ID is clearly a reference, not a
task start."

History:
  Iter 0 (original):  20/20 — "Use when user provides a Jira ticket ID (pattern..."
```

---

## 🤔 Why This Works Without an API Key

The skill-creator's `run_eval.py` tests trigger behavior by spawning `claude -p <query>` as a subprocess and watching whether the Skill tool fires. This approach:
- Requires `select.select()` on subprocess pipes (broken on Windows)
- Needs `ANTHROPIC_API_KEY` for the description improvement step

This plugin skips the subprocess entirely. When Claude evaluates "would I invoke this skill given this description?", it's answering the exact same question the subprocess test is measuring — just inline, in one pass, without platform limitations.

---

## 📋 Requirements

- [Claude Code](https://claude.ai/code)
- A skill with a `SKILL.md` file containing a `description:` in the YAML frontmatter
- A trigger eval set (JSON file) with labeled queries

---

## 🔧 Troubleshooting

**"No eval set found"**
Either pass `--eval-set <path>` explicitly, or create a `trigger-eval.json` file as a sibling to your skill directory.

**Description keeps failing the same queries**
After 2–3 iterations without improvement, the skill will try structurally different description approaches rather than incremental tweaks. If you're still stuck, review whether the failing queries are genuinely ambiguous — some edge cases may be inherently hard to discriminate.

**Score is already 100% on first pass**
The description is already well-tuned. No changes are made.
