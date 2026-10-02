# Skills and MCP servers

The set we run with, grouped by purpose. Pick by stack; the Orca and process groups
transfer to any project.

## Orca

| Skill | Source | Use |
|---|---|---|
| `orca-cli` | ships with Orca (`orca skills get orca-cli`), install to `~/.claude/skills` | worktrees, terminals, Orca browser, artifacts, worktree comments; how to start workers |
| `orchestration` | ships with Orca | supervision: Run/Task/Dispatch, `worker_done`, ask/reply, task DAGs |
| `orca-per-workspace-env` | ships with Orca | disposable per-workspace environments (cloud sandbox, VM, SSH host, container) in `orca.yaml` |
| `orca-linear` | ships with Orca | Linear as the tracker instead of a custom client |
| `computer-use`, `orca-emulator`, `orca-emulator-android` | ships with Orca | native app GUI, iOS / Android emulators |
| `<project>-dispatch` | your repo | "dispatch tasks / show status": status → ready → dispatch → report |

`orca skills list` shows what your CLI version bundles; `orca skills installed` shows
what is installed and where it came from.

## Development process

| Skill | Use |
|---|---|
| `speckit-*` (GitHub Spec Kit: constitution, specify, clarify, plan, tasks, analyze, checklist, implement, converge, taskstoissues) | large features: spec → plan → tasks → implementation; artifacts in `specs/<feature>/` |
| `superpowers:*` (brainstorming, systematic-debugging, test-driven-development, writing-plans, executing-plans, verification-before-completion, requesting/receiving-code-review, using-git-worktrees, dispatching-parallel-agents, finishing-a-development-branch) | process discipline: debugging, TDD, evidence before claims |
| `mattpocock-skills:*` (diagnosing-bugs, tdd, code-review, codebase-design, domain-modeling, grilling, research, prototype, resolving-merge-conflicts, writing-for-agents) | the same from another angle, plus writing instructions for agents |
| addyosmani agent-skills: api-and-interface-design, ci-cd-and-automation, code-review-and-quality, code-simplification, constraint-driven-development, context-engineering, debugging-and-error-recovery, deprecation-and-migration, documentation-and-adrs, doubt-driven-development, frontend-ui-engineering, git-workflow-and-versioning, idea-refine, incremental-implementation, interview-me, observability-and-instrumentation, performance-optimization, planning-and-task-breakdown, security-and-hardening, shipping-and-launch, source-driven-development, spec-driven-development, test-driven-development, using-agent-skills | engineering practice by topic |
| `conventional-commits` | commit messages |
| `graft` | search the code graph instead of grep (see MCP) |
| `find-skills`, `skill-creator` | find or write a skill |

## Architecture and UI (choose by stack)

| Skill | Use |
|---|---|
| `cleanslice` (+ the `cleanslice` MCP) | NestJS + Nuxt architecture standard: vertical slices, gateway, Provider.vue, Pinia, DTOs |
| `shadcn-vue` | UI components (Vue/Nuxt, Reka UI, Tailwind) |
| `frontend-design` (plugin), `emil-design-eng`, `apple-design`, `pick-ui-library`, `prototype` | visual design and UI polish |
| `animate`, `animation-vocabulary`, `review-animations`, `improve-animations`, `find-animation-opportunities` | motion |

Keep project skills in `.agents/skills/` (shared by Claude and Codex) with symlinks
from `.claude/skills/`. Run the project's gates right after adding a third-party pack —
it may contain words or paths the repository forbids.

## MCP servers

| Server | Configured in | Use |
|---|---|---|
| `graft` | project `.mcp.json` (+ global) | code graph: find code, every occurrence, callers, a file's API, repo map. Pair it with a committed `graft/` index and Claude hooks (SessionStart / UserPromptSubmit / PostToolUse / Stop) that keep the index fresh and suggest entry points |
| `cleanslice` | global for Claude; `~/.codex/config.toml` for Codex | the architecture standard's docs: `get-started`, `list-categories`, `search`, `read-doc` — consult before writing code |
| project-local server (e.g. via `bun`) | project `.mcp.json` | project-specific tools; when it fails to connect the agent must say so, not pretend the tool does not exist |
| `flashboards` | project (Claude) and Codex | image / video generation, boards |
| `claude-in-chrome` | Chrome extension | drive a real browser: UI checks, console, network |
| claude.ai connectors (Docs, Atlassian, Gmail, Calendar, Drive) | claude.ai | documents, Jira via connector, mail, calendar |

For Codex, MCP servers and the model live in `~/.codex/config.toml`
(`[mcp_servers.<name>]`, `model = ...`); Codex reads skills from the repo's
`.agents/skills/`.

## Claude Code project settings worth copying

- `permissions.deny` — the safety set in [orca.md](../orca.md#safety).
- `additionalDirectories` — temp dirs and `~/.claude` so agents can use scratch space.
- Hooks — the graft hooks above; nothing that mutates the repo on its own.
