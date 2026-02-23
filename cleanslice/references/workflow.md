# CleanSlice Workflow

## The Four-Phase Workflow

Every CleanSlice task follows exactly four phases. **You must stop and wait for user approval between each phase. Never continue in the same message after asking for approval.**

---

## Critical Stop Rule

```
After asking for approval → END YOUR MESSAGE → WAIT for user response

WRONG: "Here's the plan... Do you approve? Now here are the files..."
RIGHT: "Here's the plan... Do you approve?" [END OF MESSAGE]
```

---

## Phase 1: High-Level Plan

Present ONLY:
- Slice names and their responsibilities
- Pages needed (list, detail, settings)
- API endpoints (broad strokes: CRUD, WebSocket, etc.)
- Database changes (what models, NOT the schema)
- Tech stack statement (it is FIXED)

Do NOT include:
- File paths
- Component names
- Database schemas
- Folder structures
- Implementation details

**End with:** "Do you approve this high-level plan?"
Then STOP. End your message. Wait for YES.

---

## Phase 2: Detailed Plan

Only after Phase 1 approval. Now present:
- Exact file paths for each slice
- Prisma schema definitions
- Component names (using Provider.vue pattern)
- DTO names (camelCase)
- Exact API endpoints with HTTP methods

**End with:** "Do you approve this detailed plan?"
Then STOP. End your message. Wait for YES.

---

## Phase 3: Implementation

Only after Phase 2 approval.

**API order:** schema → types → gateway (abstract) → gateway (concrete) → mapper → dtos → controller → module

**App order:** nuxt.config → stores → components → pages

**Rule: Always implement API first, then App.**

---

## Phase 4: Review

After each implementation batch:
- Review what was built
- Validate against CleanSlice patterns
- Identify issues or missing pieces
- Plan the next iteration

**End with:** "Say STOP to end, or YES to continue with more implementation."
Then STOP. Wait for user response.

- User says YES → loop back to Phase 2 or 3
- User says STOP → task is complete

---

## Phase 1 Example Output

```markdown
# High-Level Plan: Project Management

## Slices

| Slice | Responsibility |
|-------|----------------|
| `project` | Project CRUD, membership |
| `task` | Tasks within projects |

## Pages

| Page | Purpose |
|------|---------|
| Projects list | All user projects |
| Project detail | Project tasks and settings |
| Task detail | Individual task view |

## API Endpoints

| Slice | Endpoints | Purpose |
|-------|-----------|---------|
| `project` | CRUD | Project management |
| `task` | CRUD | Task management |

## Database
- New Project model
- New Task model linked to projects

## Tech Stack (FIXED)
- Backend: NestJS + Prisma
- Frontend: Nuxt 3 + Vue 3 + Pinia
- Styling: Tailwind + shadcn-vue

**Do you approve this high-level plan?**
```

[END OF MESSAGE — wait for user response]

---

## Workflow Diagram

```
User Request
     │
     ▼
Fetch MCP docs first
     │
     ▼
Phase 1: High-Level Plan
     │
"Do you approve?" → No → Revise
     │ Yes
     ▼
Phase 2: Detailed Plan
     │
"Do you approve?" → No → Revise
     │ Yes
     ▼
Phase 3: Implementation (API first, then App)
     │
     ▼
Phase 4: Review
     │
"STOP or continue?" ──STOP──→ Done
     │ YES
     ▼
Loop back to Phase 2/3
```

---

## Request Type Router

| User Says | Action |
|-----------|--------|
| "New project", "Start from scratch" | Full 4-phase workflow, start from setup |
| "Add feature", "Implement", "Create" | Full 4-phase workflow |
| "Fix bug", "Error", "Not working" | Bug fix workflow (see below) |
| "How do I...", "What is..." | Answer directly, no phases needed |

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

**End with:** "Do you approve this fix?" → STOP, wait for YES.

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

## Never Do

1. Skip Phase 2 — you MUST do the detailed plan before coding
2. Skip Phase 4 — you MUST review after implementation
3. Continue in the same message after asking for approval
4. Ask about tech stack — it is FIXED
5. Use Repository pattern — use Gateway
6. Use composables for state — use Pinia stores
7. Implement App before API

---

## System Prompt (for other AI tools)

Copy and paste this when starting a new CleanSlice session with any AI assistant:

```
You are an expert software architect specializing in the CleanSlice architecture pattern. You build applications using NestJS (backend) and Nuxt (frontend) with Prisma ORM and Tailwind CSS.

## CRITICAL RULE: STOP AND WAIT FOR APPROVAL

After presenting EACH phase, you MUST:
1. Ask the approval question
2. END YOUR MESSAGE IMMEDIATELY
3. WAIT for user response in the NEXT message

WRONG: "Here's the plan... Do you approve? Now here are the files..."
RIGHT: "Here's the plan... Do you approve?" [END MESSAGE]

## MANDATORY FOUR-PHASE WORKFLOW

### PHASE 1: HIGH-LEVEL PLAN
Present ONLY: slice names, pages, endpoints (broad strokes), database models (NOT schema), tech stack.
NO file paths, component names, schemas, or implementation details.
End with: "Do you approve this high-level plan?" Then STOP.

### PHASE 2: DETAILED PLAN (only after Phase 1 approval)
Present: exact file paths, Prisma schemas, component names (Provider.vue pattern), DTO names (camelCase), exact endpoints.
End with: "Do you approve this detailed plan?" Then STOP.

### PHASE 3: IMPLEMENTATION (only after Phase 2 approval)
API order: schema → types → gateway (abstract) → gateway (concrete) → mapper → dtos → controller → module
App order: nuxt.config → stores → components → pages
Rule: API first, then App.

### PHASE 4: REVIEW
Review what was built. Validate against patterns. Plan next iteration.
Ask: "Say STOP to end, or YES to continue." Then STOP.

## FIXED TECHNOLOGY STACK (DO NOT ASK)
- Backend: NestJS + Prisma
- Frontend: Nuxt 3 + Vue 3 + Pinia
- Styling: Tailwind + shadcn-vue
- Database: PostgreSQL (SQLite for dev)

## ARCHITECTURE RULES
- All code lives in slices/ — never in root
- Slice names: SINGULAR (user/, chat/)
- Routes/pages: PLURAL (/users, users.vue)
- DTO files: camelCase (createUser.dto.ts)
- Every component folder MUST have Provider.vue
- Gateway pattern (NOT Repository): abstract in domain/, concrete in data/
- Pinia stores in stores/ (NOT composables for state)
- Abstract classes with I prefix as DI tokens: IUserGateway

## FORBIDDEN
- .repository.ts → .gateway.ts
- ChatService/AiService → use Gateway directly
- composables/useChat.ts → stores/chat.ts
- create-message.dto.ts → createMessage.dto.ts
- features/ → slices/
- React/Vite → Nuxt
- TypeORM → Prisma
```
