# Changelog

All notable changes to the `jira-ticket` plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] — 2026-05-26

### Added

- **Step 5.0 — first-time vs follow-up RFT detection.** Before drafting the Ready-for-Test comment, the skill now reads Jira's status changelog as the source of truth and decides which Step 5 variant to run. Four-cell decision matrix covering: first-time RFT, follow-up on RFT, bounce-back re-RFT, and terminal-state safety.
- **Step 5x — follow-up round comment.** New lightweight variant for incremental rounds while the ticket is already in "Ready for test": short delta comment focused on what changed since the last round, no status transition, no reassignment. Mentions only commenters who engaged after our previous RFT (not the reporter).
- **RFT rounds tracking in the state file.** `<git-root>/jira-state/<TICKET-ID>.md` now includes an `**RFT Rounds:** N (latest: …)` header field and a `## RFT History` section listing each round (date + merge SHA). One row per RFT transition, not per comment.
- **Auto-recovery from missing or stale state file.** Jira's changelog is always consulted; the local `jira-state` file is treated as a fast cache. Missing file → rebuilt from Jira on next save. Stale file → Jira wins, cache is overwritten.
- **Broader Step 5 trigger phrases.** "Post on the ticket", "post an update", "ping the reviewers", "comment on the ticket" — plus an implicit trigger after a successful ship/merge when the ticket is already in "Ready for test".

### Changed

- **SR-3 Step 5 definition.** Previously "ticket was transitioned to Ready for Test (in this session)" — now "ticket has ever been in 'Ready for test' (per Jira changelog)". The new definition survives session restarts and is consistent with the new round counter.

### Notes

- All changes are backward-compatible. Original Step 5 (5a–5f) is unmodified for first-time RFT — the new 5x branch is only entered when both Jira and the cache agree that an earlier RFT round has happened.

## [1.3.1] — earlier

### Changed

- Frontend verification hierarchy now points to the user-level `~/.claude/CLAUDE.md` rather than being inlined.

## [1.3.0] — earlier

### Added

- Step 4.5 (Ship) orchestration that hands off to the `ship-branch` plugin when configured.

## [1.2.1] — earlier

### Added

- `azure-devops-build` integration in Step 5a to enrich the RFT comment with a build badge / pipeline link.

### Fixed

- `rft-comment-suffix` directive now wires into the Step 5a draft.

## [1.2.0] — earlier

### Added

- Step 1b — view image attachments referenced in the ticket description.
- Idempotent Step 2h transitions (skip if already in target status).
- Step 5e reassign step in the completion flow.
- Project config directives (`rft-assignee`, `rft-mention-reporter`, `rft-comment-suffix`, `jira-autosave`, etc.).

## [1.1.0] — earlier

### Added

- `jira-autosave` config flag to disable milestone auto-saves.

## [1.0.x] — earlier

### Added

- Initial Step 5 completion flow for Ready for Test.
- Save State Routine and on-demand save trigger.
- Session rename prompt in Step 1.

[1.4.0]: https://github.com/robgha01/claude-plugins/tree/jira-ticket-v1.4.0/jira-ticket
[1.3.1]: https://github.com/robgha01/claude-plugins/tree/jira-ticket-v1.3.1/jira-ticket
[1.3.0]: https://github.com/robgha01/claude-plugins/tree/jira-ticket-v1.3.0/jira-ticket
