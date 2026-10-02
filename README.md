# CleanSlice Skills

Agent skills for the [CleanSlice](https://cleanslice.org) architecture framework — NestJS + Nuxt full-stack apps using Clean Architecture with vertical slices.

---

## Available Skills

Eight skills. Five cover one subject each; three group a family that shares a
mechanism, with the per-member detail in `references/`.

| Skill | Description |
|-------|-------------|
| [`cleanslice`](./cleanslice/SKILL.md) | The architecture: vertical slices, gateway pattern, Provider.vue, Pinia stores, DTOs, TypeScript standards, error handling |
| [`project`](./project/SKILL.md) | Setting up and operating a project: Claude Code + MCP bootstrap, Orca as a ticket-driven agent factory, tool recipes for git, auth recovery, stack traces and codebase search |
| [`social`](./social/SKILL.md) | Social platforms through a logged-in browser session — Instagram, X, TikTok, Facebook/Meta Ads |
| [`integrations`](./integrations/SKILL.md) | Third-party API keys from the per-user secret vault — OpenAI, Stripe, PayPal |
| [`github`](./github/SKILL.md) | GitHub workflow automation: repositories, Actions, PR review with inline comments, releases |
| [`docs`](./docs/SKILL.md) | Write and maintain a multilingual VitePress documentation site: pages that open with the point, an honest status on every claim, locales in parity, and a post-build checker for dead anchors and orphan pages |
| [`bridle`](./bridle/SKILL.md) | Embed the Bridle webchat into a website: SDK wiring, embed JWTs, Shadow DOM theming |
| [`conventional-commits`](./conventional-commits/SKILL.md) | Conventional Commits v1.0.0: commit types, scope (slice name), breaking changes, SemVer correlation |

Each grouped skill is one file to read plus one reference per member:

```
social/SKILL.md              → references/{instagram,x,tiktok,facebook}.md
integrations/SKILL.md        → references/{openai,stripe,paypal}.md
project/SKILL.md             → references/{claude-code-setup,recipes,orca}.md + references/orca/
```

Read the SKILL.md first — it holds the mechanism every member shares. The
reference adds only what is specific to one platform or provider.

---

## Installation

Skills follow the [Agent Skills](https://agentskills.io) open standard and work with Claude Code and 37+ other AI coding agents.

### Quick install via `skills` CLI

```bash
# Install a specific skill
bunx skills add CleanSlice/skills --skill cleanslice
bunx skills add CleanSlice/skills --skill project
bunx skills add CleanSlice/skills --skill conventional-commits

# Install all CleanSlice skills
bunx skills add CleanSlice/skills

# Update to the latest version
bunx skills update CleanSlice/skills
```

The `skills` CLI ([vercel-labs/skills](https://github.com/vercel-labs/skills)) automatically places the skill in the right location for your agent.

### Manual install — project (recommended)

Copy the skill into your project's `.claude/skills/` folder and commit it to version control so the whole team has it:

```bash
git clone https://github.com/CleanSlice/skills.git /tmp/cleanslice-skills
cp -r /tmp/cleanslice-skills/cleanslice .claude/skills/
```

### Manual install — personal (global)

Copy the skill to your personal skills directory to use it across all projects:

```bash
git clone https://github.com/CleanSlice/skills.git /tmp/cleanslice-skills
cp -r /tmp/cleanslice-skills/cleanslice ~/.claude/skills/
```

---

## Usage

Once installed, skills are available in Claude Code:

```
/cleanslice              # Architecture conventions
/project                 # MCP + skills installation, Orca, tool recipes
/conventional-commits    # Commit message format
/social                  # Instagram, X, TikTok, Facebook
/integrations            # OpenAI, Stripe, PayPal keys
```

Claude loads skills automatically when relevant — `/cleanslice` activates on CleanSlice projects, `/conventional-commits` activates when writing commit messages.

---

## What's Included

### cleanslice

The `cleanslice` skill bundles six reference documents:

| Reference | Contents |
|-----------|----------|
| [`references/workflow.md`](./cleanslice/references/workflow.md) | Authorized workflow (understand → plan → implement → verify), bug fix workflow, git commit format |
| [`references/backend.md`](./cleanslice/references/backend.md) | NestJS slice structure, module, controller, service, gateway, mapper, DTOs, types |
| [`references/frontend.md`](./cleanslice/references/frontend.md) | Nuxt slice structure, auto-imports, Provider.vue, Pinia stores, composables |
| [`references/gateway.md`](./cleanslice/references/gateway.md) | Gateway pattern with full code examples, abstract class, DI wiring |
| [`references/typescript.md`](./cleanslice/references/typescript.md) | TypeScript standards: no-any, I prefix, Types suffix, import aliases |
| [`references/errors.md`](./cleanslice/references/errors.md) | Error pattern: BaseError, domain errors, interceptor, no try/catch in controllers |

### setup

A single-file skill that configures Claude Code for CleanSlice development: adds the MCP server and installs the required agent skills (shadcn-vue, cleanslice, conventional-commits).

### conventional-commits

A single-file skill covering the [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification: commit types, scope (use slice name), description rules, breaking changes, and examples.

---

## Links

- [CleanSlice Docs](https://cleanslice.org)
- [CleanSlice MCP](https://mcp.cleanslice.org)
- [GitHub](https://github.com/CleanSlice/nest-nuxt-starter-kit)
- [Agent Skills Standard](https://agentskills.io)
