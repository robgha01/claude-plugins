# 🧩 claude-plugins

Personal Claude Code plugin marketplace for [@robgha01](https://github.com/robgha01).

---

## 📦 Available Plugins

| Plugin | Description |
|---|---|
| 🎫 [jira-ticket](jira-ticket/) | Auto-starts the right workflow when a Jira ticket ID is mentioned — fetches ticket, creates branch, picks workflow tier |

---

## 🚀 Quick Start

### Step 1 — Add the marketplace

```
/plugin marketplace add https://github.com/robgha01/claude-plugins.git
```

### Step 2 — Install a plugin

```
/plugin
```

Select the plugin you want to install from the list.

### Step 3 — Reload

```
/reload-plugins
```

### Step 4 — Verify

```
/plugin
```

The installed plugin should appear as enabled.

---

## 📋 Requirements

- [Claude Code](https://claude.ai/code)
- [Superpowers plugin](https://github.com/anthropics/claude-plugins-official) — required for workflow handoff
- Atlassian MCP connected — required for Jira lookups
- Git

---

## 🔄 Updating Plugins

Claude Code auto-updates plugins based on your `autoUpdatesChannel` setting. To force an update manually:

```
/reload-plugins
```

---

## 📁 Repository Structure

```
claude-plugins/
├── .claude-plugin/
│   └── marketplace.json     ← marketplace registry
├── jira-ticket/             ← jira-ticket plugin
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── skills/
│   │   └── jira-ticket/
│   │       └── SKILL.md
│   ├── CLAUDE.md
│   ├── LICENSE
│   └── README.md
└── README.md
```
