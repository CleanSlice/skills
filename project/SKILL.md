---
name: project
description: Set up and operate a CleanSlice project — install the MCP server and agent skills for Claude Code, run the repository as a ticket-driven Orca agent factory, and follow the tool recipes for git, auth recovery, stack traces and codebase search. Use when bootstrapping a project for agents or when a routine development action needs the reliable sequence.
---

# Project setup and operation

Three jobs, one skill: get a project ready for agents, run work through it, and do the routine things in the order that actually works.

| You are… | Read |
|----------|------|
| setting up Claude Code in a repo for the first time | [references/claude-code-setup.md](references/claude-code-setup.md) |
| turning a repo into a ticket-driven agent factory | [references/orca.md](references/orca.md) |
| pushing, recovering auth, chasing a stack trace, finding a file | [references/recipes.md](references/recipes.md) |

Architecture rules are a separate skill (`cleanslice`), as is the commit format (`conventional-commits`) — both installed by the setup below.

---

## Bootstrap in two commands

```bash
claude mcp add --scope user --transport http cleanslice https://mcp.cleanslice.org/mcp
bunx skills add CleanSlice/skills
```

Then restart the Claude Code session — MCP servers and skills are picked up at start. The long form, including the individual skills and what each one is for, is in [references/claude-code-setup.md](references/claude-code-setup.md).

---

## Tool fallback chains

The one table worth keeping in your head. When the primary tool is blocked or fails, work down the chain before asking the user for anything:

| Task | Chain |
|------|-------|
| Server commands | `exec` → `http_request` → `web_fetch` |
| File search | `exec(grep/find)` → `file` (specific paths) → `memory_search` |
| File read | `exec(cat)` → `file("<exact-path>")` |
| Git operations | `exec(git)` → `http_request` (API) |
| Web search | `web_search` → `web_fetch` |
| Auth failure | `secret_get("<service>:token")` → use it → `secret_list()` → env vars → ask |

Never give up after one tool fails. `secret_get` comes **before** `secret_list`: an empty `secret_list` does not mean the credential is absent.

Full sequences — git push, 403 recovery, stack-trace-to-fix, finding a file by name — are in [references/recipes.md](references/recipes.md).

---

## Running the repo as an agent factory

Orca turns a repository into a queue: one ticket, one isolated worktree, one agent worker, one verification pass, one owner acceptance, then cleanup. It needs `orca.yaml`, setup/teardown hooks, dispatch scripts and worker prompts in the repo, plus a decision about which skills, MCP servers and safety rules each worker carries.

Start at [references/orca.md](references/orca.md); its own deep-dives live beside it:

- [orca/workspace-infrastructure.md](references/orca/workspace-infrastructure.md) — per-workspace services, ports, data
- [orca/skills-and-mcp.md](references/orca/skills-and-mcp.md) — what a worker should be given
- [orca/acceptance.md](references/orca/acceptance.md) — verification, report, owner review
- [orca/pitfalls.md](references/orca/pitfalls.md) — workers that never got their prompt, setups that fail

---

## Don't

- Don't install skills one by one when the whole set is wanted — `bunx skills add CleanSlice/skills` takes the lot.
- Don't tell the user "restart Claude Code" and stop there; say what was installed and what it gives them.
- Don't ask the user for a file's contents. You have the tools; exhaust the chain first.
- Don't dispatch an Orca worker without the verification step — an unverified "done" is the one failure mode the whole factory exists to prevent.
