---
name: azure-devops-build
description: Use when you need a build status badge or pipeline link for a commit/branch in an Azure DevOps repository — typical triggers are "get the build badge", "what's the CI status", or orchestration from a higher-level skill (e.g. jira-ticket Step 5). Silently no-ops if the current repo isn't on Azure DevOps.
argument-hint: [<branch-or-commit>]
allowed-tools:
  - Bash
  - Read
---

# Azure DevOps Build Badge

This skill returns a Markdown build badge and a pipeline link for an Azure DevOps repository. It is designed to be **silent on no-op** so it can be safely orchestrated from other skills without extra branching — if the repo isn't on Azure DevOps, this skill prints `not-azure` and exits.

---

## Step 1 — Detect the host

Run:

```bash
git remote get-url origin 2>/dev/null
```

Examine the returned URL. Azure DevOps URLs match one of:

| Pattern | Example | Form |
|---|---|---|
| `dev.azure.com/<org>/<project>/_git/<repo>` | `https://dev.azure.com/comprend/SCA-dev/_git/digitall-presentation` | New-style |
| `<org>@vs-ssh.visualstudio.com:v3/<org>/<project>/<repo>` | SSH form | New-style SSH |
| `<org>.visualstudio.com/<project>/_git/<repo>` | `https://comprend.visualstudio.com/SCA-dev/_git/digitall-presentation` | Legacy |

If the URL matches none of these, print:

```
not-azure
```

…and stop. The calling skill should treat that as "no badge to inject" and continue.

---

## Step 2 — Parse the URL

Extract `<org>`, `<project>`, `<repo>` from the matched pattern. Examples:

- `https://dev.azure.com/comprend/SCA-dev/_git/digitall-presentation`
  → org: `comprend`, project: `SCA-dev`, repo: `digitall-presentation`
- `https://comprend.visualstudio.com/SCA-dev/_git/digitall-presentation`
  → org: `comprend`, project: `SCA-dev`, repo: `digitall-presentation`

URL-encode any spaces in org/project/repo (Azure DevOps allows spaces; use `%20`).

---

## Step 3 — Resolve the branch and pipeline

**Branch** — the argument to the skill, or `git rev-parse --abbrev-ref HEAD` if not given. URL-encode it (`/` becomes `%2F`).

**Pipeline name or ID** — read in this order, first match wins:

1. Skill argument flag `--pipeline <name>` if the caller provides it.
2. Project `CLAUDE.md` directive `azure-build-pipeline: <name-or-id>`.
3. Workspace-level `CLAUDE.md` directive `azure-build-pipeline:`.
4. Fallback: omit the pipeline; produce a pipelines-page link only (no live badge).

---

## Step 4 — Emit the badge

If a pipeline was resolved, output **exactly two lines**:

```
BADGE_MD: ![Build](https://dev.azure.com/<org>/<project>/_apis/build/status/<pipeline>?branchName=<branch>)
PIPELINE_URL: https://dev.azure.com/<org>/<project>/_build?definitionId=<pipeline-or-name>
```

If no pipeline could be resolved, output:

```
BADGE_MD:
PIPELINE_URL: https://dev.azure.com/<org>/<project>/_build
```

The empty `BADGE_MD:` line tells the caller "no live badge available — use the pipeline URL instead."

**Output contract:**

- Always two lines.
- Each line starts with the key, a colon, and a space (or nothing after the colon for the empty case).
- No additional prose. The caller will parse these two lines programmatically.

---

## Step 5 — Optional: include in a comment

When orchestrated from another skill (e.g. `jira-ticket` Step 5a), the caller appends the parsed values to its draft comment, typically as a separate paragraph:

```
Build: ![Build](https://...)   ([Pipelines](https://...))
```

…or just the pipelines link when no live badge is available.

The skill itself does **not** post anything. It only returns the values.

---

## Notes

- This skill works **without authentication** because the badge SVG endpoint is publicly readable for most Azure DevOps configurations. If a tenant blocks anonymous badge access, the badge image will render as a broken image but the pipeline link still works.
- Private projects: anonymous access can be enabled per project in Azure DevOps under *Project Settings → Overview → Visibility*. Until enabled, only the pipeline link is useful.
- For richer status (latest run number, latest commit's specific build result), upgrade to authenticated REST calls in a future version using a PAT from an env var like `AZURE_DEVOPS_PAT`.
- This skill intentionally does not depend on any other skill. The "detect host" logic is inlined here. When a second host-specific build skill is added (e.g. `github-build-status`), the detection can be extracted into a shared `git-host-detect` helper.
