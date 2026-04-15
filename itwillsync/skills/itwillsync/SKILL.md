---
name: itwillsync
description: Use when the user wants to sync a terminal AI agent (Claude Code, Aider, Goose, or any shell command) to their phone or mobile device over the local network. Triggers on phrases like "sync to phone", "monitor on mobile", "itwillsync", "watch from phone", or "access agent from mobile". Skip if the user is asking about cloud deployment or regular port forwarding.
argument-hint: [claude|aider|-- <command>] [--local|--tailscale|--localhost] [--port <n>] [--no-qr] [--headless]
---

# itwillsync

Sync any terminal AI coding agent to a phone or tablet over the local network. Zero cloud, zero install, full privacy.

**Announce at start:** "Starting itwillsync -- syncing <agent> to your mobile device."

---

## What it does

`itwillsync` wraps a terminal command in a PTY session and exposes it through a local WebSocket server. Scan the QR code that appears in the terminal to open a live, encrypted terminal view in any mobile browser. No app install required on the phone.

Supported agents out of the box: **Claude Code**, **Aider**, **Goose**. Any shell command works via `-- <cmd>`.

---

## Step 1 -- Determine what to sync

Infer the agent from context, or ask if unclear:

| Want to sync | Command |
|---|---|
| Claude Code | `npx itwillsync claude` |
| Aider | `npx itwillsync aider` |
| Bash / shell | `npx itwillsync -- bash` |
| Any other command | `npx itwillsync -- <command>` |

---

## Step 2 -- Choose networking mode

| Situation | Flag | Full example |
|---|---|---|
| Same WiFi network (default) | none | `npx itwillsync claude` |
| Outside home network via Tailscale VPN | `--tailscale` | `npx itwillsync claude --tailscale` |
| Outside home network via Cloudflare Tunnel | run `npx itwillsync setup` to configure | wizard sets it up |
| Same machine only | `--localhost` | `npx itwillsync claude --localhost` |
| Custom port | `--port <n>` | `npx itwillsync claude --port 4000` |

**When the user is NOT on the same WiFi** (away from home, on mobile data, on a different network):
- Tailscale: add `--tailscale`. Requires Tailscale installed and running on both phone and machine.
- Cloudflare Tunnel: run `npx itwillsync setup` and select the Cloudflare option. No VPN app needed on phone.

If the user has not run setup before, offer to run it first:

```bash
npx itwillsync setup
```

---

## Step 3 -- Run the command

Run the assembled command directly using the Bash tool. Do not just show it -- execute it.

```bash
npx itwillsync claude
```

itwillsync will:
1. Start a hub daemon (if not already running)
2. Spawn a PTY wrapping the agent
3. Print a QR code and a dashboard URL in the terminal
4. Show a dashboard at `http://<local-ip>:<port>` listing all active sessions

Tell the user: "Scan the QR code with your phone camera and tap the link -- it opens a live terminal in your browser. No app install needed."

**Note:** the main sync command starts an interactive PTY and will run in the foreground. For non-interactive hub commands (`hub info`, `hub status`, `hub stop`), run them directly and show the output.

---

## Hub management

Run these via Bash and show the output to the user:

```bash
# Show dashboard URL and QR code again
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
| `--headless` | No interactive output -- useful for scripting |
| `-v` / `--version` | Print version |
| `-h` / `--help` | Print help |

---

## Configuration

Settings at `~/.itwillsync/config.json` (override with `$ITWILLSYNC_CONFIG_DIR`):

| Key | Default | Description |
|---|---|---|
| `networkingMode` | `"local"` | `"local"` or `"tailscale"` |
| `maxSessions` | `20` | Max concurrent sessions |
| `idleTimeoutMs` | 24h | Session inactivity timeout |
| `scrollbackBufferSize` | `"10MB"` | Terminal history buffer |

Run `npx itwillsync setup` to configure interactively.

---

## Security model

- Per-session random auth tokens (NaCl secretbox / XSalsa20-Poly1305 encryption)
- QR code embeds the session token -- scanning = pairing
- Rate-limited auth attempts
- No cloud relay -- traffic stays on your network (or Tailscale VPN / Cloudflare Tunnel)

---

## Quick-start cheatsheet

```bash
# Sync Claude Code, same WiFi
npx itwillsync claude

# Sync Aider, away from home via Tailscale
npx itwillsync aider --tailscale

# Sync a bash shell on a custom port
npx itwillsync -- bash --port 4000

# First-time setup (choose networking mode, Cloudflare Tunnel, etc.)
npx itwillsync setup

# Check what's running
npx itwillsync hub status

# Get dashboard URL + QR again
npx itwillsync hub info

# Stop everything
npx itwillsync hub stop
```

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Phone can't connect on same WiFi | Ensure both devices on same network; try `--port` to use a different port |
| Phone can't connect away from home | Add `--tailscale` (requires Tailscale on phone) or run `npx itwillsync setup` for Cloudflare Tunnel |
| QR not visible | Remove `--no-qr` if set; or copy the URL printed below the QR code |
| Port already in use | Pass `--port <n>` to pick a free port |
| Sessions lost after reboot | Hub daemon does not auto-start on boot -- re-run the command |
| Windows firewall blocks | Approve the firewall prompt on first run, or add a rule for the chosen port manually |
