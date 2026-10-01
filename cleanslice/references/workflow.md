# Authorized Development Workflow

Use four stages: understand the request, plan the change, implement, then verify and report. An approved task or explicit instruction to implement already authorizes work within its scope. Do not ask for the same approval again at each stage. Respect project-specific review, deployment and merge gates.

Ask a focused question when a missing requirement blocks progress or a material scope change requires a new decision. Prepare the concrete reviewable result before asking for final approval. If approval is actually required, stop the dependent action until it arrives; continue independent authorized work.

For a small fix, keep the plan brief. For a substantial feature, record slices, public contracts, invariants, dependencies, migration and verification. Implement API before App. Read the relevant MCP documents first; existing neighboring code is not proof of a rule.

Use singular slice names, plural resource routes, camelCase DTO filenames, domain gateway contracts and data implementations. Services hold business policy. Prisma is the database repository; an additional database repository layer is unnecessary. Self-contained external adapters or homogeneous capabilities may be repositories with their own types and no domain imports. Use Pinia for frontend state and Provider.vue for component entry.

Use the project's target database for persistence tests; do not default to SQLite. Preserve unrelated edits. Report actual checks, failures and unverified integration gates. Complete the authorized task and stop; do not invent an endless review/implementation loop. Never infer permission to merge or deploy from passing tests.

## Request Type Router

| User Says | Action |
|-----------|--------|
| "New project", "Start from scratch" | Full four stages, starting from setup |
| "Add feature", "Implement", "Create" | Full four stages |
| "Fix bug", "Error", "Not working" | Bug fix workflow (see below) |
| "How do I...", "What is..." | Answer directly, no staging needed |

---

## Bug Fix Workflow

### Step 1: Search MCP docs first (mandatory)

Always check the relevant pattern before investigating:
```
search("gateway pattern")
search("slice structure")
search("nestjs standards")
```

### Step 2: Investigate

- Read the relevant slice files
- Identify which layer the bug is in (controller / service / gateway / mapper)
- Check if it's an architecture violation (wrong pattern used)

### Step 3: Fix plan

Write a concise plan:
- What the bug is
- Root cause (wrong layer? wrong pattern? logic error?)
- Proposed fix and files to change

If the fix materially changes the authorized scope, ask for approval and wait. Otherwise proceed with the existing authorization.

### Step 4: Implement

Make the minimal change. Do NOT refactor beyond the bug scope.

### Step 5: Confirm

Verify the fix and that no architectural patterns were broken.

**Key rules:**
- Fix only what's broken — no opportunistic refactoring
- If the bug IS an architecture violation, fix it the correct way (don't patch over it)
- Respect layer boundaries: business logic belongs in service, not controller

---

## Git Commit Standards

```
<type>: <description>
```

| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change, no feature/fix |
| `test` | Adding/updating tests |
| `chore` | Maintenance |

Add `!` for breaking changes: `feat!: remove deprecated endpoint`

Rules: lowercase · no period · imperative mood · max 72 chars

Examples:
```
feat: add user authentication
fix: resolve login timeout issue
refactor: simplify gateway mapper
docs: update API documentation
```

---
