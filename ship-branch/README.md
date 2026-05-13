# 🚢 ship-branch

A Claude Code plugin that merges a feature branch into the project's main branch using the project's configured ship strategy.

Handles **remote race conditions safely** — when origin/main has moved while you worked, it picks the right recovery strategy (clean rebase, guarded reset+remerge, or refuse-and-report) based on whether your local main has unique work to lose.

---

## 🚀 Installation

```
/plugin marketplace add https://github.com/robgha01/claude-plugins.git
/plugin install ship-branch@robert-personal
/reload-plugins
```

---

## ⚡ Usage

```
/ship-branch                              # ships current branch
/ship-branch feature/SSBP-112-foo         # ships a specific branch
```

Or just describe what you want:

> "ship it"
> "merge this to main"
> "push to main"

---

## ⚙️ Project Configuration

Reads optional directives from the consuming repo's `CLAUDE.md`:

| Directive | Default | Effect |
|---|---|---|
| `ship-strategy` | `none` | One of `direct-merge`, `pull-request`, `none`. |
| `main-branch` | `main` | Override if your project uses `master`, `trunk`, etc. |
| `merge-commit-format` | `Merge {BRANCH-LAST-SEGMENT}: {SUBJECT}` | Template with `{TICKET-ID}`, `{BRANCH}`, `{TITLE}`, `{SUBJECT}` placeholders. |

Example:

```
<!-- ship-branch -->
ship-strategy: direct-merge
merge-commit-format: Merge {TICKET-ID}: {TITLE}
```

---

## 🛡️ Safety Properties

- **Never force-pushes.**
- **Never `--no-verify`s** to skip hooks. If a hook fails, fix the cause.
- **Never `reset --hard`** unless the local refs have zero unique work outside the feature branch being shipped (and the safety check runs every time).
- **Never deletes** the feature branch after merging.

---

## 🔗 Orchestration

Designed to be called from higher-level workflow skills:

```
jira-ticket Step 4.5 (Ship)
  └─ ship-branch (if ship-strategy: direct-merge)
     └─ jira-ticket Step 5 (RFT)
        └─ comment includes merge commit SHA
```
