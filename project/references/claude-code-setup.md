# Setting up Claude Code for a CleanSlice project

The long form of the bootstrap in [../SKILL.md](../SKILL.md). Run it once per
machine (MCP is user-scoped) and once per project (skills are project-scoped).

---

Configure MCP and install the required agent skills for CleanSlice development.

## Step 1: Add the CleanSlice MCP Server

The MCP server provides architecture documentation, conventions, and patterns directly to Claude Code.

```bash
claude mcp add --scope user --transport http cleanslice https://mcp.cleanslice.org/mcp
```

## Step 2: Install Development Skills

| Skill | Purpose | Install Command |
|-------|---------|-----------------|
| **shadcn-vue** | UI component library guidance (Reka UI, Tailwind, dark mode) | `bunx skills add noartem/skills --skill shadcn-vue` |
| **cleanslice** | Architecture patterns (vertical slices, gateway, Provider.vue) | `bunx skills add CleanSlice/skills --skill cleanslice` |
| **conventional-commits** | Conventional Commits standard for git messages | `bunx skills add CleanSlice/skills --skill conventional-commits` |

Run these commands in order:

```bash
bunx skills add noartem/skills --skill shadcn-vue
```

```bash
bunx skills add CleanSlice/skills --skill cleanslice
```

```bash
bunx skills add CleanSlice/skills --skill conventional-commits
```

## Step 3: Restart Claude Code

After all commands complete, inform the user that the MCP server and skills have been installed and they need to **restart the Claude Code session** to activate them.
