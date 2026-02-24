# CleanSlice Skills

Agent skills for the [CleanSlice](https://cleanslice.dev) architecture framework — NestJS + Nuxt full-stack apps using Clean Architecture with vertical slices.

---

## Available Skills

| Skill | Description |
|-------|-------------|
| [`cleanslice`](./cleanslice/SKILL.md) | Complete CleanSlice architecture: vertical slices, gateway pattern, Provider.vue, Pinia stores, DTOs, TypeScript standards, error handling |
| [`conventional-commits`](./conventional-commits/SKILL.md) | Conventional Commits v1.0.0 for git messages: commit types, scope (slice name), breaking changes, SemVer correlation |

---

## Installation

Skills follow the [Agent Skills](https://agentskills.io) open standard and work with Claude Code and 37+ other AI coding agents.

### Quick install via `skills` CLI

```bash
# Install a specific skill
npx skills add CleanSlice/skills --skill cleanslice
npx skills add CleanSlice/skills --skill conventional-commits

# Install all CleanSlice skills
npx skills add CleanSlice/skills

# Update to the latest version
npx skills update CleanSlice/skills
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
/conventional-commits    # Commit message format
```

Claude loads skills automatically when relevant — `/cleanslice` activates on CleanSlice projects, `/conventional-commits` activates when writing commit messages.

---

## What's Included

### cleanslice

The `cleanslice` skill bundles six reference documents:

| Reference | Contents |
|-----------|----------|
| [`references/workflow.md`](./cleanslice/references/workflow.md) | Four-phase workflow, bug fix workflow, git commit format, system prompt |
| [`references/backend.md`](./cleanslice/references/backend.md) | NestJS slice structure, module, controller, service, gateway, mapper, DTOs, types |
| [`references/frontend.md`](./cleanslice/references/frontend.md) | Nuxt slice structure, auto-imports, Provider.vue, Pinia stores, composables |
| [`references/gateway.md`](./cleanslice/references/gateway.md) | Gateway pattern with full code examples, abstract class, DI wiring |
| [`references/typescript.md`](./cleanslice/references/typescript.md) | TypeScript standards: no-any, I prefix, Types suffix, import aliases |
| [`references/errors.md`](./cleanslice/references/errors.md) | Error pattern: BaseError, domain errors, interceptor, no try/catch in controllers |

### conventional-commits

A single-file skill covering the [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification: commit types, scope (use slice name), description rules, breaking changes, and examples.

---

## Links

- [CleanSlice Docs](https://cleanslice.dev)
- [GitHub — CleanSlice Studio](https://github.com/CleanSlice/studio)
- [Agent Skills Standard](https://agentskills.io)
