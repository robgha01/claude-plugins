#!/usr/bin/env node
/*
 * jira-mem — PostToolUse hook
 *
 * Fires right after a Jira ticket is fetched (matcher: mcp__.*getJiraIssue).
 * Emits `additionalContext` (a system-reminder the model sees) telling it to
 * retrieve related past work from long-term memory NOW that the ticket content
 * is known — querying by the ticket's PROBLEM/topic, never the bare ticket
 * number (a weak semantic signal).
 *
 * Why a hook and not a skill edit: this observes the Jira fetch instead of being
 * called by it, so the jira-ticket skill stays pure and claude-mem stays optional.
 *
 * Fail-open contract: ANY problem -> exit 0 with no output. A hook for a
 * read-only tool must never block or delay the ticket fetch.
 */

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(raw || '{}');
    const input = event.tool_input || {};

    // The ticket-key field name varies across Atlassian MCP servers; try the
    // common ones and only use it if it looks like a real PROJ-123 key.
    const candidate =
      input.issueIdOrKey || input.issueKey || input.issueId || input.key || '';
    const key =
      typeof candidate === 'string' && /^[A-Z][A-Z0-9]+-\d+$/.test(candidate)
        ? candidate
        : '';

    const additionalContext =
      `A Jira ticket${key ? ` (${key})` : ''} was just fetched. ` +
      `Before starting work, retrieve related prior work from long-term memory: run a semantic ` +
      `memory search (e.g. claude-mem's \`mem-search\` / \`search\` tool) using the ticket's PROBLEM ` +
      `DESCRIPTION and domain terms as the query — NOT the bare ticket number, which is a weak ` +
      `semantic signal that returns nearest-neighbour noise. Surface any past fixes, decisions, ` +
      `or affected files for similar problems, then proceed. ` +
      `If no memory/search tool is available in this session, skip silently.`;

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext,
      },
    }));
  } catch {
    /* fail-open: emit nothing */
  }
  process.exit(0);
});
