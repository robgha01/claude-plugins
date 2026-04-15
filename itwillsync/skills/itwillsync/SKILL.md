---
name: itwillsync
description: Use when the user wants to sync a terminal AI agent (Claude Code, Aider, Goose, or any shell command) to their phone or mobile device over the local network. Triggers on phrases like "sync to phone", "monitor on mobile", "itwillsync", "watch from phone", or "access agent from mobile". Skip if the user is asking about cloud deployment or regular port forwarding.
argument-hint: [claude|aider|-- <command>] [--local|--tailscale|--localhost] [--port <n>] [--no-qr] [--headless]
---

# itwillsync

Sync any terminal AI coding agent to a phone or tablet over the local network — zero cloud, zero install, full privacy.

**Announce at start:** "Starting itwillsync — syncing <agent> to your mobile device."

---

## What it does

`itwillsync` wraps a terminal command in a PTY session and exposes it through a local WebSocket server. Scan the QR code that appears in the terminal to open a live, encrypted terminal view in any mobile browser. No app install required on the phone.

Supported agents out of the box: **Claude Code**, **Aider**, **Goose**. Any shell command works via `-- <cmd>`.

---

## Step 1 — Determine what to sync

Ask the user (or infer from context):

| Want to sync | Command to run |
|---|---|
| Claude Code | `npx itwillsync claude` |
| Aider | `npx itwillsync aider` |
| Bash / shell | `npx itwillsync -- bash` |
| Any other command | `npx itwillsync -- <command>` |

---

## Step 2 — Choose networking mode

| Situation | Flag | Example |
|---|---|---|
| Same WiFi network (default) | `--local` or none | `npx itwillsync claude` |
| Remote access via Tailscale | `--tailscale` | `npx itwillsync claude --tailscale` |
| Same machine only | `--localhost` | `npx itwillsync claude --localhost` |
| Custom port | `--port <n>` | `npx itwillsync claude --port 4000` |

If the user hasn't configured a preferred mode, run `npx itwillsync setup` first for the one-time interactive wizard.

---

## Step 3 — Run the command

Run the assembled command in the terminal. Example:

```bash
npx itwillsync claude
```

itwillsync will:
1. Start a hub daemon (if not already running)
2. Spawn a PTY wrapping the agent
3. Print a QR code + dashboard URL in the terminal
4. Display a dashboard at `http://<local-ip>:<port>` listing all active sessions

The user scans the QR code with their phone camera and taps the link to open the live terminal.

---

## Hub management

After sessions are running, the user can manage them from another terminal:

```bash
# View dashboard URL and QR again
npx itwillsync hub info

# List all active sessions with uptime
npx itwillsync hub status

# Stop all sessions and shut down the hub daemon
npx itwillsync hub stop
```

---

## Common flags

| Flag | Effect |
|---|---|
| `--no-qr` | Suppress QR code output (URL still printed) |
| `--headless` | No interactive output — useful for scripting |
| `-v` / `--version` | Print version |
| `-h` / `--help` | Print help |

---

## Configuration

Settings are stored at `~/.itwillsync/config.json` (or `$ITWILLSYNC_CONFIG_DIR/config.json`). Key options:

| Key | Default | Description |
|---|---|---|
| `networkingMode` | `"local"` | `"local"` or `"tailscale"` |
| `maxSessions` | `20` | Max concurrent sessions |
| `idleTimeoutMs` | 24h | Session inactivity timeout |
| `scrollbackBufferSize` | `"10MB"` | Terminal history buffer |

Run `npx itwillsync setup` to configure these interactively rather than editing JSON manually.

---

## Security model

- Per-session random auth tokens (NaCl secretbox / XSalsa20-Poly1305 encryption)
- QR code embeds the session token — scanning = pairing
- Rate-limited auth attempts
- No cloud relay — traffic stays on your network (or Tailscale VPN)

---

## Quick-start cheatsheet

```bash
# Sync Claude Code on local WiFi
npx itwillsync claude

# Sync Aider with Tailscale (remote access)
npx itwillsync aider --tailscale

# Sync a plain bash shell, custom port
npx itwillsync -- bash --port 4000

# One-time setup wizard
npx itwillsync setup

# Check what's running
npx itwillsync hub status

# Stop everything
npx itwillsync hub stop
```

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Phone can't connect | Ensure phone and machine are on the same WiFi. Use `--tailscale` for cross-network access. |
| QR not visible | Add `--no-qr` was set accidentally — remove it, or copy the URL from the output |
| Port already in use | Pass `--port <other-n>` to pick a free port |
| Sessions lost after reboot | Hub daemon doesn't auto-start on boot — re-run the command |
| Windows firewall blocks | First run prompts a firewall rule — approve it, or add a rule for the chosen port manually |
