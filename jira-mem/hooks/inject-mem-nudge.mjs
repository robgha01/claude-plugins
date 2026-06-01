#!/usr/bin/env node
/*
 * jira-mem — PostToolUse hook
 *
 * Fires after a Jira ticket is fetched (matcher: mcp__.*getJiraIssue) and emits
 * `additionalContext` (a model-visible system reminder) telling the agent to pull
 * related past work from long-term memory NOW, querying by the ticket's TOPIC —
 * never the bare ticket number (a weak semantic signal).
 *
 * Two gates decide whether to nudge:
 *   1. CLASS gate   — classify the fetch (full | changelog | comments | metadata)
 *                     and only nudge for classes the user has enabled.
 *   2. DEDUP gate   — at most one nudge per (session + ticket), so repeat fetches
 *                     (changelog/comments/re-loads) stay silent.
 *
 * Config (highest precedence first):
 *   - env JIRA_MEM_NUDGE = "full" | "full,comments" | "all" | "none"
 *   - env JIRA_MEM_DEDUP = "1" | "0"
 *   - project file  <cwd>/.jira-mem.json
 *   - plugin data   $CLAUDE_PLUGIN_DATA/config.json
 *   - baked-in defaults: nudge full only, dedup on
 *
 * Fail-open contract: ANY error, bad config, or unknown situation degrades toward
 * the safe default (nudge), never crashes, never blocks the tool result.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CLASSES = ['full', 'changelog', 'comments', 'metadata'];
const DEFAULTS = {
  nudge: { full: true, changelog: false, comments: false, metadata: false },
  dedup: true,
};

function readJsonFile(path) {
  try {
    if (path && existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
  } catch { /* ignore */ }
  return null;
}

function mergeNudge(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return base;
  const out = { ...base };
  for (const c of CLASSES) {
    if (typeof incoming[c] === 'boolean') out[c] = incoming[c];
  }
  return out;
}

function parseNudgeEnv(raw) {
  // "all" | "none" | comma list of class names
  const v = String(raw).trim().toLowerCase();
  if (!v) return null;
  const out = { full: false, changelog: false, comments: false, metadata: false };
  if (v === 'all') return { full: true, changelog: true, comments: true, metadata: true };
  if (v === 'none') return out;
  for (const part of v.split(',').map((s) => s.trim())) {
    if (CLASSES.includes(part)) out[part] = true;
  }
  return out;
}

function loadConfig(cwd) {
  let cfg = { nudge: { ...DEFAULTS.nudge }, dedup: DEFAULTS.dedup };

  // plugin-data file (lowest), then project file (higher)
  const pluginData = process.env.CLAUDE_PLUGIN_DATA;
  for (const file of [
    pluginData ? join(pluginData, 'config.json') : null,
    cwd ? join(cwd, '.jira-mem.json') : null,
  ]) {
    const f = readJsonFile(file);
    if (f) {
      cfg.nudge = mergeNudge(cfg.nudge, f.nudge);
      if (typeof f.dedup === 'boolean') cfg.dedup = f.dedup;
    }
  }

  // env overrides (highest)
  if (process.env.JIRA_MEM_NUDGE != null) {
    const e = parseNudgeEnv(process.env.JIRA_MEM_NUDGE);
    if (e) cfg.nudge = e;
  }
  if (process.env.JIRA_MEM_DEDUP != null) {
    const d = String(process.env.JIRA_MEM_DEDUP).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(d)) cfg.dedup = true;
    if (['0', 'false', 'no', 'off'].includes(d)) cfg.dedup = false;
  }

  return cfg;
}

// Deep-scan a parsed result for a non-empty `summary` (handles nested + flat shapes).
function hasSummary(obj, depth = 0) {
  if (depth > 8 || !obj || typeof obj !== 'object') return false;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'summary' && typeof v === 'string' && v.trim()) return true;
    if (v && typeof v === 'object' && hasSummary(v, depth + 1)) return true;
  }
  return false;
}

function parseResult(toolResult) {
  let text = '';
  try {
    if (typeof toolResult === 'string') text = toolResult;
    else if (toolResult && typeof toolResult === 'object') {
      if (typeof toolResult.text === 'string') text = toolResult.text;
      else if (Array.isArray(toolResult.content)) {
        text = toolResult.content.map((c) => (c && c.text) || '').join('\n');
      } else text = JSON.stringify(toolResult);
    }
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Classify the fetch by intent. Priority: changelog > comments > metadata > full.
function classify(input, toolResult) {
  const expand = String(input.expand || '').toLowerCase();
  if (expand.includes('changelog')) return 'changelog';

  const f = input.fields;
  if (Array.isArray(f) && f.length) {
    const want = f.map((x) => String(x).toLowerCase());
    const substantive = want.some((x) => ['summary', 'description', '*all', '*navigable'].includes(x));
    if (!substantive) return want.includes('comment') ? 'comments' : 'metadata';
  }

  // No restricting signal: trust the payload. Has summary -> full.
  // Can't parse (exotic server) -> assume full (fail-open to nudge).
  const parsed = parseResult(toolResult);
  if (parsed && !hasSummary(parsed)) return 'metadata';
  return 'full';
}

// Note: the ticket key is intentionally NOT echoed here — the model already has it
// in context, and keeping the text project-agnostic avoids baking in any ticket prefix.
function buildNudge() {
  return (
    `A Jira ticket was just fetched — search memory for related prior work. ` +
    `Observations and session summaries are the source of truth for prior fixes, decisions, ` +
    `and findings. Use \`mem-search\` now, querying by the ticket's title / summary / description ` +
    `(the problem domain — not the ticket number). Relevant prior work can exist even when this ` +
    `ticket is new — e.g. a similar problem solved before. Trust what \`mem-search\` returns and ` +
    `fold it into your response. If no memory/search tool is available, skip.`
  );
}

function emit() {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: buildNudge(),
      },
    }),
  );
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(raw || '{}');
    const input = event.tool_input || {};
    const sessionId = event.session_id || '';
    const cwd = event.cwd || '';

    const candidate =
      input.issueIdOrKey || input.issueKey || input.issueId || input.key || '';
    const key =
      typeof candidate === 'string' && /^[A-Z][A-Z0-9]+-\d+$/.test(candidate)
        ? candidate
        : '';

    const cfg = loadConfig(cwd);

    // CLASS gate
    const cls = classify(input, event.tool_result);
    if (!cfg.nudge[cls]) process.exit(0); // class disabled -> silent, no marker

    // DEDUP gate (only when enabled and we can key reliably)
    if (cfg.dedup && sessionId && key) {
      const safe = `${sessionId}__${key}`.replace(/[^A-Za-z0-9_.-]/g, '_');
      const dir = join(tmpdir(), 'jira-mem');
      const marker = join(dir, safe);
      try {
        if (existsSync(marker)) process.exit(0); // already nudged this ticket this session
        mkdirSync(dir, { recursive: true });
        writeFileSync(marker, String(Date.now()));
      } catch {
        /* marker I/O failed -> fall through and still nudge (dedup is best-effort) */
      }
    }

    emit();
  } catch {
    /* fail-open: emit nothing */
  }
  process.exit(0);
});
