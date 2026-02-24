# CleanSlice Skills

Agent skills for the [CleanSlice](https://cleanslice.dev) architecture framework — NestJS + Nuxt full-stack apps using Clean Architecture with vertical slices.

---

## Available Skills

| Skill | Description |
|-------|-------------|
| [`cleanslice`](./cleanslice/SKILL.md) | Complete CleanSlice architecture: vertical slices, gateway pattern, Provider.vue, Pinia stores, DTOs, TypeScript standards, error handling |

---

## Installation

Skills follow the [Agent Skills](https://agentskills.io) open standard and work with Claude Code and 37+ other AI coding agents.

### Quick install via `skills` CLI

```bash
# Install the cleanslice skill into your project
npx skills add CleanSlice/skills --skill cleanslice

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

Once installed, the skill is available in Claude Code as `/cleanslice`:

```
/cleanslice
```

Claude will load the skill and apply CleanSlice architecture conventions to the current task. The skill also loads automatically when you work on CleanSlice projects — Claude detects it from the description and applies the rules without an explicit invocation.

---

## What's Included

The `cleanslice` skill bundles six reference documents:

| Reference | Contents |
|-----------|----------|
| [`references/workflow.md`](./cleanslice/references/workflow.md) | Four-phase workflow, bug fix workflow, git commit format, system prompt |
| [`references/backend.md`](./cleanslice/references/backend.md) | NestJS slice structure, module, controller, service, gateway, mapper, DTOs, types |
| [`references/frontend.md`](./cleanslice/references/frontend.md) | Nuxt slice structure, auto-imports, Provider.vue, Pinia stores, composables |
| [`references/gateway.md`](./cleanslice/references/gateway.md) | Gateway pattern with full code examples, abstract class, DI wiring |
| [`references/typescript.md`](./cleanslice/references/typescript.md) | TypeScript standards: no-any, I prefix, Types suffix, import aliases |
| [`references/errors.md`](./cleanslice/references/errors.md) | Error pattern: BaseError, domain errors, interceptor, no try/catch in controllers |

---

## Links

- [CleanSlice Docs](https://cleanslice.dev)
- [GitHub — CleanSlice Studio](https://github.com/CleanSlice/studio)
- [Agent Skills Standard](https://agentskills.io)
