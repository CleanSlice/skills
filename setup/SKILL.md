---
name: setup
description: Install the CleanSlice MCP server and required development skills for Claude Code. Run this when setting up Claude Code for the first time in this project.
---

# Setup Claude Code for CleanSlice

Configure MCP and install the required agent skills for CleanSlice development.

## Step 1: Add the CleanSlice MCP Server

The MCP server provides architecture documentation, conventions, and patterns directly to Claude Code.

```bash
claude mcp add --scope user --transport http cleanslice https://mcp.cleanslice.org/mcp
```

## Step 2: Install Development Skills

| Skill | Purpose | Install Command |
|-------|---------|-----------------|
| **shadcn-vue** | UI component library guidance (Reka UI, Tailwind, dark mode) | `npx skills add noartem/skills --skill shadcn-vue` |
| **cleanslice** | Architecture patterns (vertical slices, gateway, Provider.vue) | `npx skills add CleanSlice/skills --skill cleanslice` |
| **conventional-commits** | Conventional Commits standard for git messages | `npx skills add CleanSlice/skills --skill conventional-commits` |

Run these commands in order:

```bash
npx skills add noartem/skills --skill shadcn-vue
```

```bash
npx skills add CleanSlice/skills --skill cleanslice
```

```bash
npx skills add CleanSlice/skills --skill conventional-commits
```

## Step 3: Restart Claude Code

After all commands complete, inform the user that the MCP server and skills have been installed and they need to **restart the Claude Code session** to activate them.
