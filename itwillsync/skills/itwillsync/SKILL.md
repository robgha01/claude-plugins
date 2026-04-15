---
name: itwillsync
description: Use when the user wants to sync a terminal AI agent (Claude Code, Aider, Goose, or any shell command) to their phone or mobile device over the local network. Triggers on phrases like "sync to phone", "monitor on mobile", "itwillsync", "watch from phone", "control agent from phone", "approve from phone", or "access agent from mobile". Skip if the user is asking about cloud deployment or regular port forwarding.
argument-hint: [-- <agent>] [--local|--tailscale|--localhost] [--port <n>] [--no-qr] [--headless]
---

# itwillsync

Sync any terminal AI coding agent to a phone or tablet. Full bidirectional terminal control -- type from your phone, watch output, approve prompts. Zero cloud, zero app install.

**Announce at start:** "Starting itwillsync -- syncing <agent> to your mobile device."

---

## What it does

itwillsync wraps the agent in a PTY, starts a local WebSocket server (binding to `0.0.0.0`), and shows a QR code. Scanning it opens a **full interactive terminal** in the phone's browser -- you can type, scroll, and control the agent from your phone just like a real terminal.

**Key capabilities:**
- Full bidirectional terminal -- type commands from your phone
- Attention indicator: session card **pulses red** when the agent sends a bell character (e.g. Claude Code waiting for your approval) -- you know when to pick up your phone
- Multiple sessions: run the command in separate terminals, all sessions appear on one phone dashboard
- Auto-reconnect if WiFi drops or phone locks
- Connect phone, tablet, and laptop simultaneously to the same session

Supported agents: **Claude Code, Aider, Goose, Codex, GitHub Copilot CLI**, any shell, any CLI tool.

---

## Step 1 -- First-time setup

If this is the user's first run, offer to run the setup wizard:

```bash
npx --yes itwillsync setup
```

The wizard asks one question -- networking mode:

| Option | When to choose |
|---|---|
| **Local Network** | Phone and machine are on the same WiFi |
| **Tailscale** | Connecting from a different network via Tailscale VPN |

If Tailscale is selected, the wizard validates the installation and shows the detected Tailscale IP. Saves choice to `~/.itwillsync/config.json`. Skip setup if user has already configured.

---

## Step 2 -- Determine what to sync

Infer from context or ask:

| Agent | Command |
|---|---|
| Claude Code | `npx --yes itwillsync -- claude` |
| Aider | `npx --yes itwillsync -- aider` |
| Goose | `npx --yes itwillsync -- goose` |
| Codex | `npx --yes itwillsync -- codex` |
| Bash / shell | `npx --yes itwillsync -- bash` |
| Agent with its own flags | `npx --yes itwillsync -- aider --model gpt-4` |

**Syntax note:** the `--` separator separates itwillsync flags from the agent command. For simple cases `npx itwillsync claude` also works, but use `--` whenever the agent has its own flags to avoid conflicts.

---

## Step 3 -- Networking mode

| Situation | Flag | Example |
|---|---|---|
| Same WiFi as machine | `--local` or none | `npx --yes itwillsync -- claude` |
| Different network via Tailscale VPN | `--tailscale` | `npx --yes itwillsync --tailscale -- claude` |
| Same machine only | `--localhost` | `npx --yes itwillsync --localhost -- claude` |
| Custom port | `--port <n>` | `npx --yes itwillsync --port 4000 -- claude` |

Flags go **before** `--`, agent command goes **after**.

**Tailscale** requires Tailscale installed and running on both machine and phone.

**Other meshnets (NordVPN Meshnet, ZeroTier, etc.):**
The hub binds to all interfaces (`0.0.0.0`) so meshnet IPs work -- but itwillsync has no built-in flag for them. Workaround:
1. Run the command without a networking flag (shows local WiFi URL in terminal)
2. Find the machine's meshnet IP (e.g. `nordvpn meshnet peer list`, `zerotier-cli listnetworks`)
3. Copy the URL from the terminal, replace only the IP with the meshnet IP -- port and token stay the same
4. Open the modified URL on phone

---

## Step 4 -- Show the command and have the user run it

**IMPORTANT:** The main sync command is an interactive PTY -- do NOT run it via the Bash tool. Show it clearly and tell the user to run it in their own terminal.

> "Run this in your terminal:
> ```
> npx --yes itwillsync [flags] -- <agent>
> ```
> A QR code and URL will appear. Scan the QR with your phone camera and tap the link -- opens a live interactive terminal in your browser. No app install needed."

After launching, itwillsync will:
1. Download and start on first run (takes a few seconds via npx)
2. Start the hub daemon in the background (if not already running)
3. Spawn a PTY wrapping the agent
4. Print a QR code + full dashboard URL with session token

To manage sessions or retrieve the URL later, open a second terminal and use the hub commands below.

---

## Hub management (Claude runs these via Bash)

Run these directly and show output to the user:

```bash
# Dashboard URL + QR code + active session count
npx --yes itwillsync hub info

# All active sessions with name, status, uptime, port
npx --yes itwillsync hub status

# Stop hub daemon (sessions with running PIDs resume when hub restarts)
npx --yes itwillsync hub stop

# Healthcheck (useful if hub seems stuck)
curl http://127.0.0.1:7963/api/health
```

**Session persistence:** sessions survive hub restarts -- if the hub crashes and restarts, any session whose process is still alive reappears on the dashboard automatically (state is saved to `~/.itwillsync/sessions.json`). Sessions do NOT survive a machine reboot.

---

## Phone dashboard controls

Once connected, each session card on the phone has four actions:

| Button | What it does |
|---|---|
| **Open** | Full-screen interactive terminal (type from phone, full color, scrollback) |
| **Rename** | Edit session display name inline |
| **Info** | Toggle metadata: PID, agent, port, working directory, memory, uptime |
| **Stop** | Terminate the session (with confirmation) |

**Status indicators on each card:**
- Green = active (output in last 30s)
- Yellow = idle (no output for 30s+)
- Red pulsing = **attention** -- agent sent a bell signal, needs your input

---

## Common flags

| Flag | Effect |
|---|---|
| `--no-qr` | Suppress QR code (URL still printed) |
| `--headless` | No interactive output -- for scripting |
| `-v` / `--version` | Print version |
| `-h` / `--help` | Print help |

---

## Configuration

Settings at `~/.itwillsync/config.json`. Run `npx --yes itwillsync setup` to configure interactively.

| Key | Default | Description |
|---|---|---|
| `networkingMode` | `"local"` | `"local"` or `"tailscale"` |
| `maxSessions` | `20` | Max concurrent sessions |
| `idleTimeoutMs` | 24h | Session inactivity timeout |
| `scrollbackBufferSize` | `"10MB"` | Terminal history buffer |
| `logRetentionDays` | `30` | Days to keep session logs |

Runtime files in `~/.itwillsync/`: `hub.json`, `hub.pid`, `sessions.json`, `logs/`

---

## Security

- Per-session random auth tokens (NaCl secretbox / XSalsa20-Poly1305)
- QR code URL embeds the session token -- scanning = pairing
- Rate limiting: 5 failed auth attempts locks IP for 60 seconds
- No cloud relay -- traffic stays on your local network or Tailscale VPN

---

## Quick-start cheatsheet

```bash
# First-time setup
npx --yes itwillsync setup

# Sync Claude Code, same WiFi (user runs in their terminal)
npx --yes itwillsync -- claude

# Sync Aider via Tailscale, away from home
npx --yes itwillsync --tailscale -- aider

# Sync Aider with its own flags
npx --yes itwillsync -- aider --model gpt-4

# Second agent in another terminal (both show on phone dashboard)
npx --yes itwillsync -- goose

# Hub commands (Claude can run these):
npx --yes itwillsync hub info      # URL + QR + session count
npx --yes itwillsync hub status    # sessions with uptime
npx --yes itwillsync hub stop      # stop hub
curl http://127.0.0.1:7963/api/health  # hub healthcheck
```

---

## Common mistakes and troubleshooting

| Problem | Fix |
|---|---|
| Phone can't connect on same WiFi | Both devices must be on the same network; check router AP isolation setting |
| Phone can't connect away from home | Add `--tailscale` (needs Tailscale on phone) or use meshnet IP workaround (Step 3) |
| QR won't scan | Copy the URL printed below the QR; use that URL directly on phone |
| No red pulse when Claude is waiting | The bell/attention feature requires the agent to emit a terminal bell character |
| "npx: command not found" | Install Node.js 20+ first |
| Slow first start | First run downloads the package -- a few seconds, normal |
| Sessions lost after reboot | Hub and sessions don't auto-start on machine reboot -- re-run the command |
| Hub seems stuck | Run `curl http://127.0.0.1:7963/api/health`; if no response, run `npx --yes itwillsync hub stop` then restart |
| Windows firewall prompt | Approve on first run, or add inbound rule for the session port manually |
| Agent has its own flags | Use `--` separator: `npx itwillsync --tailscale -- aider --model gpt-4` |
| Tailscale setup fails | Run `tailscale up` first, then re-run `npx --yes itwillsync setup` |
