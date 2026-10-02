---
name: orca
description: Run a repository on Orca as a ticket-driven agent factory — tracker queue, one isolated worktree and agent worker per task, per-workspace infrastructure, verification, owner review, acceptance and cleanup. Use when setting up a new project for Orca (orca.yaml, setup/teardown hooks, dispatch scripts, worker prompts), dispatching or accepting tasks, debugging a worker that never received its prompt or a workspace whose setup fails, or deciding which skills, MCP servers and safety rules a project needs.
---

# Orca: running a project as an agent factory

[Orca](https://github.com/stablyai/orca) manages git worktrees, terminals and coding
agents. This skill is the playbook for putting **any** repository on this flow:

```text
Tracker: Backlog → Selected for Development → In Progress → In Testing → In Review → Done
              │                │                  │              │             │
              │      dispatch: worktree + branch  │  verify: gate, builds,     │  acceptance
              │      + setup + worker             │  start, HTTP checks        │  by the owner
              └─ owner queues the task            └─ the worker moves statuses ┘
```

It is project-agnostic. Examples come from a NestJS + Nuxt monorepo with Jira, but
every rule is written to transfer.

Verified against Orca CLI **1.4.218**. Orca ships version-matched guides with the
CLI — re-read them for your version before wiring a new project:

```bash
orca skills list
orca skills get orca-cli          # worktrees, terminals, agent-first create
orca skills get orchestration     # supervised Run/Task/Dispatch
orca skills get orca-per-workspace-env
```

---

## Quick reference

| Need | Answer |
|---|---|
| Config file | `orca.yaml` on the default branch; pick "shared config" in Orca repo settings |
| Our scripts | `orca/` (no dot) — **not** `.orca/`, which Orca uses itself |
| Machine-local state | `.orca/` — entirely gitignored |
| Start a worker | `orca worktree create ... --agent codex --prompt "..."` (one call) |
| Branch base | `origin/main`, never a local main with unpushed commits |
| Agent waits for setup | `setupAgentStartupPolicy: wait-for-setup` |
| Remove a workspace | `orca worktree rm --worktree path:<p> --run-hooks` (archive hook is skipped without it) |
| Merge on acceptance | `gh pr merge N --merge --match-head-commit <full sha>` |
| Who merges | nobody on their own judgement; the owner's explicit acceptance only |

---

## Principles

1. **One task, one worktree, one branch, one worker.** The root checkout coordinates;
   product code changes only in isolated worktrees.
2. **The worker takes a task to "ready for review", never to "accepted".** The owner
   reviews and accepts. No reviewer agent unless the project decides otherwise.
3. **Never report green when it is red.** A failed build, test or startup keeps the
   task in testing with a concrete explanation.
4. **Every workspace gets its own infrastructure** — port block, databases, Redis
   index, cluster namespace — and **never** touches shared infrastructure
   (`docker compose up/down`, shared ports, other workspaces' databases).
5. **Every report opens with a plain explanation** for someone who never opened the
   repo: what was wrong, what it does now, why this way. Then checks, links, the
   running project's URLs.
6. **The owner's acceptance is an instruction**: merge, update main, close the task,
   clean the workspace — in that order.

---

## The task flow

| Step | Who | What |
|---|---|---|
| Queue | Owner (or coordinator on the owner's word) | Moves a ready, unblocked task to `Selected for Development`. Epics are never dispatched — only their children. |
| Dispatch | Coordinator, `orca/dispatch.sh` | Worktree from `origin/main`, branch renamed (`feat/KEY`, `fix/KEY`, `docs/KEY`), setup must succeed, worker started with its prompt. |
| Implement | Worker | `In Progress`; reads the ticket **and its comments** (the DoD is often rewritten there); implements with focused checks. |
| Verify | Same worker | `In Testing`; `orca/verify.sh KEY` — project gate, builds, project started in an Orca terminal, HTTP checks. Fix and repeat until green. |
| Hand in | Same worker | Push, PR (the PR is the canonical report), one tracker comment with the explanation first, `In Review`. Leave the project running. |
| Review | Owner | PR, card, running project. Feedback goes back to the same worker: `In Progress` → `In Testing` → `In Review`. |
| Accept | Coordinator on the owner's word | See [references/acceptance.md](references/acceptance.md). |

Parallelism: never run two tasks that edit the same module/slice at once — each
passes review alone and they conflict on merge. Before dispatching, check the
task's blockers; a task whose blockers are not merged is not started.

---

## Repository layout

Orca itself writes into `.orca/` **inside the repository and every worktree**
(found in the app's code):

| Path | Used by Orca for |
|---|---|
| `<worktree>/.orca/drops/` | files dropped into the agent composer (attachments) |
| `<repo>/.orca/issue-command` | the repo's local issue command |
| `.orca/templates/` | templates |
| `.orca/worktrees/` | suggested relative location for per-project worktrees |

So keep your own tooling elsewhere:

```text
orca.yaml               # Orca config: setup / archive hooks, agent startup policy
orca/                   # OUR scripts and prompts (committed)
  README.md             # how the flow works, for humans and agents
  agents/               # role prompts
  common.sh             # shared helpers: port allocation, DB names, paths
  setup.sh              # setup hook
  teardown.sh           # archive hook
  dispatch.sh           # start queued tasks
  verify.sh             # In Testing: gate + builds + start + HTTP
  run.sh                # start the project on THIS workspace's ports
  status.sh             # workspaces, ticket states, PRs, terminals
  orphans.sh            # read-only report of infrastructure with no workspace
  jira.sh               # tracker client (or linear via the orca-linear skill)
  tests/                # tests for the scripts themselves
.orca/                  # Orca + machine-local files; gitignored as a whole
  .ports.env  .kubeconfig  .setup-complete  .setup-failed  logs/
```

Minimal `orca.yaml`:

```yaml
setupAgentStartupPolicy: wait-for-setup   # the agent starts only after setup succeeds
scripts:
  setup: ./orca/setup.sh
  archive: ./orca/teardown.sh
```

Role prompts in `orca/agents/`:

| File | Needed | Purpose |
|---|---|---|
| `worker.md` | **yes** | Template with `{{TASK_KEY}}`; the text after a `---` line becomes the prompt. Read project rules and the ticket → In Progress → implement → verify → PR + comment → In Review; never merge; use the workspace's test database. |
| `dispatcher.md` | **yes** | Coordinator role: what to pick, parallelism, what never to start. |
| `worker.print-agent.md` | optional | Headless variant (`codex exec`, `claude -p`) for short mechanical tasks. |
| `schedule.md` | optional | Jobs for Orca automations: nightly gate, board sweep, stale cards. |
| `graft.md` | if the repo is graft-indexed | Keep the code graph fresh for agents. |
| `reviewer.md`, `reviewer.print-agent.md` | only if the project's policy is agent review | Skip when the owner reviews. |

---

## Starting a worker — the way Orca recommends

**Do — agent-first create, one call:**

```bash
orca worktree create --repo id:<repoId> --name <key> \
  --base-branch <base> --no-parent --setup run \
  --agent codex --prompt "$(cat prompt.md)" --json
# agent handle: result.agentTerminalHandle (older runtimes: result.startupTerminal.handle)
```

Orca waits for setup (with `wait-for-setup`) and delivers the prompt to the agent in
the first terminal.

**Don't** (the `orca-cli` guide calls it the anti-pattern): create a bare worktree →
`orca terminal create --command codex` → wait for idle → `terminal send`. That is how
a prompt gets lost: the agent starts and sits empty. If it happens, **do not launch a
second worker**. Write the full prompt to a file and send one line to the existing
session — "Read <file> completely and follow it". A multi-line paste into a TUI
submits at the first newline.

Also from the guide:

- Address an agent through exactly **one** handle. After an Orca restart handles go
  stale — re-list with `orca terminal list` and use only the replacement.
- `--no-parent` affects Orca lineage only, not the git base.
- `orca worktree set --comment "..."` — a short status line on the workspace card.
- Wait with `orca terminal wait --for tui-idle`, not `sleep`.

**Branch from what GitHub has seen.** A dispatcher that branches from the *local*
main carries the owner's unpushed commits into every worker's PR. Branch from
`origin/main`, and stop when local and remote main have diverged.

### Handoff vs supervision

| Mode | When | What |
|---|---|---|
| **Handoff** | ordinary dispatch | Create the worker, confirm prompt delivery, stop. No Run/Task/Dispatch, no monitoring. |
| **Supervised** | only when the owner explicitly asks to monitor, wait, or coordinate a DAG | Run → Task → Dispatch; the worker sends a native `worker_done`; the coordinator accepts the settlement before releasing it. Plain terminal text is not a lifecycle event. |

Model or effort choice does not make a handoff supervised. Lost contact is not process
death: keep `live` / `unverifiable` / `exited` distinct.

---

## Setup, isolation, teardown

Details and traps: [references/workspace-infrastructure.md](references/workspace-infrastructure.md).

In short: `setup.sh` allocates a port block, copies `.env` files from the root
checkout, installs dependencies from the lockfile, creates a dev **and** a test
database, applies migrations, picks a Redis index, optionally a cluster namespace,
and writes `.orca/.setup-complete` or `.setup-failed`. `teardown.sh` mirrors it and
**verifies** that everything is gone, reporting leftovers loudly to an orphans log.

---

## Verification and the report

`verify.sh KEY` moves the ticket to `In Testing`, runs the project gate (lint,
layer boundaries, build), builds the frontends, starts the project in an Orca
terminal and checks HTTP responses. API tests only with an explicit `DATABASE_URL`
pointing at the workspace's test database.

The PR body and the tracker comment, in this order:

1. **Explanation** — a few sentences for someone who never opened the repo. No class
   names or paths.
2. Checks actually run and their results, red ones included.
3. Limitations and what was not verified.
4. How to check: steps, the running project's URLs, the terminal handle.

Gates that read only **committed** files (e.g. a forbidden-word check over
`git ls-files`) must run **after** the commit, or they pass blind.

CI may be advisory (branch protection is unavailable on some plans), so read check
results yourself before accepting. A job that is cancelled by timeout on every PR
verifies nothing — that is its own task, not noise.

---

## Acceptance

Order is fixed: **merge → update main → Done → clean up**. Full checklist and traps:
[references/acceptance.md](references/acceptance.md).

---

## Tracker

A thin client script is the only place that holds auth and format unwrapping; agents
never call the REST API by hand.

| Command | What |
|---|---|
| `ready [max]` | queue keys (`JIRA_READY_JQL`, default `Selected for Development`) |
| `get KEY` | summary, status, parent, description as text |
| `comments KEY` | every comment — **always read**, the DoD gets rewritten there |
| `move KEY "Status"`, `transitions KEY` | transitions |
| `comment KEY "text"` | comment (verify it actually landed) |
| `check` | verify credentials |

Ad-hoc search: override `JIRA_READY_JQL`; Jira's `/search/jql` caps at 100 results
and pages by `nextPageToken`. A minimal client cannot create issues — the owner does.
Tracker credentials live in the root `.env`, not in the application's `.env`.

---

## Safety

Codex workers run with `--ask-for-approval never --sandbox danger-full-access`, so the
protection is **deny rules** in `.claude/settings.json` (they bind even in bypass mode)
and their Codex equivalent. The set worth copying into every project:

- `sudo`, `rm -rf`, `chmod 777`, `ssh`, writes to `/dev/disk*`;
- anything that touches **shared** infrastructure: `make dev`, `make down`,
  `make kill-ports`, `docker compose up/down`;
- `git push --force/-f` in every form, `git reset --hard`, `git clean -f*`,
  `git branch -D`, `git checkout .`, `git restore .`, `git stash`, `git stash pop`
  (the stash is shared by all worktrees — two workspaces pop each other's changes);
- reading or writing the root `.env` and the credentials file.

Two secret files with different jobs: the root `.env` (external services: tracker,
GitHub, cloud) and the application's `.env` (database, Redis, model keys). Both
gitignored; setup copies them into each workspace. Reports name variables, never
values.

---

## Skills and MCP servers

The set we run with, by purpose, and what to carry into a new project:
[references/skills-and-mcp.md](references/skills-and-mcp.md).

## Known pitfalls

Symptom → cause → fix table from real runs:
[references/pitfalls.md](references/pitfalls.md).

---

## New project checklist

1. **Ports.** Reserve a block in a machine-wide port registry and a pool for
   worktrees; write them into the project rules.
2. **`orca.yaml`** on the default branch; select shared config in Orca.
3. **`orca/`** scripts: `common.sh`, `setup.sh`, `teardown.sh`, `run.sh`,
   `verify.sh`, `dispatch.sh` (agent-first create, base `origin/main`), `status.sh`,
   `orphans.sh`, tracker client, `tests/`. Gitignore `.orca/` as a whole.
4. **`orca/agents/worker.md`** with `{{TASK_KEY}}` and `dispatcher.md`; optional
   print-agent, schedule, graft prompts.
5. **Agent rules** (`CLAUDE.md` / `AGENTS.md`): an index, not an encyclopedia — the
   flow, the explanation block, the shared-infrastructure ban, the test database,
   the acceptance order.
6. **Deny rules** in `.claude/settings.json` and for Codex.
7. **Skills**: `orca-cli`, `orchestration` (+ `orca-linear` for Linear), a project
   `<project>-dispatch` skill, process packs. Keep them in `.agents/skills/` with
   symlinks from `.claude/skills/`; run the project gates after adding a pack.
8. **MCP**: graft (index + hooks), the architecture standard's MCP, a browser.
9. **Credentials**: root `.env` and application `.env`, both gitignored, copied by
   setup.
10. **Dry run**: one small task from queue to acceptance; confirm setup, verify,
    teardown and `orphans.sh` report honestly.
11. **CI**: project gate on PRs; check that every job actually finishes (not
    "cancelled by timeout"); post-deploy checks only once the environment exists.
