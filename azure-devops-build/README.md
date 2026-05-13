# 🔵 azure-devops-build

A Claude Code plugin that returns a Markdown build badge and a pipeline link for an Azure DevOps repository.

Designed to be **silent on no-op** so other skills (like `jira-ticket`) can call it unconditionally — if the current repo isn't on Azure DevOps, it just prints `not-azure` and exits.

---

## 🚀 Installation

```
/plugin marketplace add https://github.com/robgha01/claude-plugins.git
/plugin install azure-devops-build@robert-personal
/reload-plugins
```

---

## ⚡ Usage

Direct invocation:

```
/azure-devops-build           # uses current branch
/azure-devops-build main      # for a specific branch
```

Or just describe what you want:

> "get the build badge for this commit"
> "what's the CI status for main?"

Output is a strict two-line contract:

```
BADGE_MD: ![Build](https://dev.azure.com/comprend/SCA-dev/_apis/build/status/digitall-presentation?branchName=main)
PIPELINE_URL: https://dev.azure.com/comprend/SCA-dev/_build?definitionId=digitall-presentation
```

---

## ⚙️ Project Configuration

The skill reads optional directives from the **consuming repo's `CLAUDE.md`**:

| Directive | Effect |
|---|---|
| `azure-build-pipeline` | Pipeline name or definition ID to embed in the badge URL. Required to produce a live badge image; without it, only the pipelines page link is returned. |

Example snippet for the consuming repo's `CLAUDE.md`:

```
<!-- azure-devops-build -->
azure-build-pipeline: digitall-presentation
```

---

## 🔗 Orchestration

This skill is designed to be called from higher-level skills:

```
jira-ticket Step 5a (draft RFT comment)
  └─ invoke azure-devops-build for the merge commit's branch
     └─ if BADGE_MD non-empty: inject "Build: ![status](...)" line
     └─ always: include "([Pipelines](...))" link
```

---

## 🔒 Authentication

This v1 works **without authentication** for public projects, and for private projects that allow anonymous badge access (configurable in *Project Settings → Overview → Visibility*).

A future version may add PAT-based REST calls (via `AZURE_DEVOPS_PAT` env var) for richer information like the specific build run for a commit.
