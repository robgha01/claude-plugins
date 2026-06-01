# Changelog

All notable changes to the `jira-mem` plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] — 2026-06-01

### Changed

- **Nudge wording reworked and eval-validated.** Reframed around *retrieving relevant observations for the ticket* rather than gating on "before starting work". The message now names observations + session summaries as the source of truth, tells the model to query `mem-search` by the ticket's **title / summary / description** (problem domain, not the ticket number), and to "trust what `mem-search` returns and fold it into your response".
- **Explicit new-ticket guidance.** States that relevant prior work can exist even when the ticket is brand new (same problem class), so the search runs regardless of whether the exact ticket was seen before.
- **Domain-neutral phrasing.** Dropped `code` / `files` / `codebase` language so the nudge applies to any ticket type (file paths still surface in the returned observations).
- **No ticket key echoed in the message.** The `(TICKET-ID)` prefix was removed from the displayed text to keep it project-agnostic. The key is still extracted internally and still drives per-(session + ticket) dedup.

### Notes

- Behavioural eval (blind subagents, de-confounded): no-nudge control 0/3 ran a memory search (reproducing the real summarize-and-skip failure); new wording 3/3 ran a topic-based `mem-search`. Confirmed live in a fresh session on SCA-425 (model searched memory "as nudged", surfaced the prior fix, and verified it in code).

## [1.1.0] — 2026-06-01

### Added

- **Fetch classification.** Each `getJiraIssue` call is classified `full` / `changelog` / `comments` / `metadata`, and only enabled classes nudge. Defaults nudge `full` (substantive) loads only.
- **Per-(session + ticket) deduplication.** At most one nudge per ticket per session. Markers are written only when a nudge actually fires, so a thin fetch (comments/metadata) never burns the marker — the subsequent full load still nudges.
- **Configuration.** `JIRA_MEM_NUDGE` (`full` · `full,comments` · `all` · `none`) and `JIRA_MEM_DEDUP` (`1`/`0`) via env; project file `<cwd>/.jira-mem.json`; plugin-data `config.json`. Precedence: OS env › settings.json env › project file › plugin-data file › built-in defaults.

### Notes

- Fully backward-compatible: defaults reproduce v1.0.0 behaviour (nudge full loads, dedup on). Fail-open preserved — bad config or unparseable result degrades toward the safe default (nudge) and never blocks the fetch.

## [1.0.0] — 2026-06-01

### Added

- Initial release. A single `PostToolUse` hook (matcher `mcp__.*getJiraIssue`) that, after a Jira ticket is fetched, injects model-visible `additionalContext` nudging the agent to semantic-search long-term memory (e.g. claude-mem `mem-search`) by the ticket's topic rather than its bare ID.
- Hooks-only plugin — no skills, no coupling to the `jira-ticket` skill, silent no-op when no memory tool is present. Fail-open: never blocks or delays the fetch.

[1.1.1]: https://github.com/robgha01/claude-plugins/tree/jira-mem-v1.1.1/jira-mem
[1.1.0]: https://github.com/robgha01/claude-plugins/tree/jira-mem-v1.1.0/jira-mem
[1.0.0]: https://github.com/robgha01/claude-plugins/tree/jira-mem-v1.0.0/jira-mem
