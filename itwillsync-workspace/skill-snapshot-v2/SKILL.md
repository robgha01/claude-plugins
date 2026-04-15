---
name: itwillsync
description: Use when the user wants to sync a terminal AI agent (Claude Code, Aider, Goose, or any shell command) to their phone or mobile device over the local network. Triggers on phrases like "sync to phone", "monitor on mobile", "itwillsync", "watch from phone", or "access agent from mobile". Skip if the user is asking about cloud deployment or regular port forwarding.
argument-hint: [claude|aider|-- <command>] [--local|--tailscale|--localhost] [--port <n>] [--no-qr] [--headless]
---

# itwillsync

Sync any terminal AI coding agent to a phone or tablet over the local network. Zero cloud, zero install, full privacy.

**Announce at start:** "Starting itwillsync -- syncing <agent> to your mobile device."

---

## How the hub works

itwillsync wraps the agent in a PTY session and exposes it through a hub daemon that **binds to `0.0.0.0` (all network interfaces)**. Scan the QR code to open a live, encrypted terminal view in any mobile browser. No app install required on the phone.

Supported agents out of the box: **Claude Code**, **Aider**, **Goose**. Any shell command works via `-- <cmd>`.

---

## Step 1 -- First-time setup

If this is the user's first run, offer to run the setup wizard first:

```bash
npx --yes itwillsync setup
```

The wizard asks one question -- networking mode:

| Option | When to choose |
|---|---|
| **Local Network** | Phone and machine are on the same WiFi |
| **Tailscale** | Connecting from a different network via Tailscale VPN |

If Tailscale is selected, the wizard checks that Tailscale is installed and running and shows the detected Tailscale IP. It saves the choice to `~/.itwillsync/config.json`.

If the user has run setup before, skip to Step 2.

---

## Step 2 -- Determine what to sync

Infer the agent from context, or ask if unclear:

| Want to sync | Command to show the user |
|---|---|
| Claude Code | `npx --yes itwillsync claude` |
| Aider | `npx --yes itwillsync aider` |
| Goose | `npx --yes itwillsync goose` |
| Bash / shell | `npx --yes itwillsync -- bash` |
| Any other command | `npx --yes itwillsync -- <command>` |

---

## Step 3 -- Networking mode

Choose the right flag based on the user's situation:

| Situation | Flag | Full command example |
|---|---|---|
| Same WiFi as the machine | none (default) | `npx --yes itwillsync claude` |
| Different network via Tailscale VPN | `--tailscale` | `npx --yes itwillsync claude --tailscale` |
| Same machine only | `--localhost` | `npx --yes itwillsync claude --localhost` |
| Custom port | `--port <n>` | `npx --yes itwillsync claude --port 4000` |

**Tailscale** requires Tailscale installed and running on both the machine and the phone.

**Other meshnets (NordVPN Meshnet, ZeroTier, etc.):**
The hub listens on all interfaces so it IS reachable via meshnet IPs, but itwillsync has no built-in flag for them. The workaround:
1. Run the command without any networking flag (shows local WiFi URL)
2. Find the machine's meshnet IP (e.g. `nordvpn meshnet peer list`, `zerotier-cli listnetworks`)
3. In the terminal output, copy the full URL and replace the IP with the meshnet IP -- the port and session token stay the same
4. Open the modified URL on the phone

---

## Step 4 -- Show the command and tell the user to run it

**IMPORTANT:** The main sync command starts an interactive PTY session and must be run by the user in their own terminal -- do NOT run it via the Bash tool.

Show the assembled command clearly and instruct the user to run it:

> "Run this in your terminal:
> ```
> npx --yes itwillsync <agent> [flags]
> ```
> After it starts, a QR code and a URL will appear. Scan the QR with your phone camera and tap the link -- it opens a live terminal in your browser. No app install needed on the phone."

After the user runs it, itwillsync will:
1. Download and start the hub daemon (first run only -- takes a few seconds)
2. Spawn a PTY wrapping the agent
3. Print a QR code and a dashboard URL (e.g. `http://192.168.x.x:7962`)
4. Show a live dashboard listing all active sessions

The session runs in the foreground. To manage sessions or get the URL again without interrupting, the user opens a second terminal and uses the hub commands below.

---

## Hub management (Claude runs these via Bash)

Run these directly and show output to the user:

```bash
# Get dashboard URL and QR code again
npx --yes itwillsync hub info

# List all active sessions with uptime
npx --yes itwillsync hub status

# Stop all sessions and shut down the hub daemon
npx --yes itwillsync hub stop
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

Settings at `~/.itwillsync/config.json` (override with `$ITWILLSYNC_CONFIG_DIR`). Run `npx --yes itwillsync setup` to configure interactively. Key options:

| Key | Default | Description |
|---|---|---|
| `networkingMode` | `"local"` | `"local"` or `"tailscale"` |
| `maxSessions` | `20` | Max concurrent sessions |
| `idleTimeoutMs` | 24h | Session inactivity timeout |
| `scrollbackBufferSize` | `"10MB"` | Terminal history buffer |

---

## Security model

- Per-session random auth tokens (NaCl secretbox / XSalsa20-Poly1305 encryption)
- QR code embeds the session token -- scanning = pairing
- Rate-limited auth attempts
- No cloud relay -- traffic stays on your local network or Tailscale VPN

---

## Quick-start cheatsheet

```bash
# First-time setup
npx --yes itwillsync setup

# Sync Claude Code, same WiFi (user runs this in their terminal)
npx --yes itwillsync claude

# Sync Aider, away from home via Tailscale (user runs this)
npx --yes itwillsync aider --tailscale

# Sync a bash shell on a custom port (user runs this)
npx --yes itwillsync -- bash --port 4000

# Hub commands (Claude can run these via Bash):
npx --yes itwillsync hub info    # get URL + QR again
npx --yes itwillsync hub status  # list sessions with uptime
npx --yes itwillsync hub stop    # stop everything
```

---

## Common mistakes and troubleshooting

| Problem | Fix |
|---|---|
| Phone can't connect on same WiFi | Check both devices are on the same network; try `--port` if there's a firewall conflict |
| Phone can't connect from outside home WiFi | Add `--tailscale` (needs Tailscale on phone) or use the meshnet IP workaround (see Step 3) |
| QR won't scan | Copy the URL printed below the QR code; replace IP with meshnet IP if needed |
| Port already in use | Pass `--port <n>` to pick a free port |
| "npx: command not found" | Install Node.js 20+ first (https://nodejs.org) |
| Slow first start | First run downloads the package via npx -- takes a few seconds, normal |
| Sessions lost after reboot | Hub daemon does not auto-start on boot -- re-run the command |
| Windows firewall prompt | Approve it on first run, or add an inbound rule for port 7962 manually |
| Tailscale setup fails in wizard | Run `tailscale up` in a separate terminal first, then re-run setup |
