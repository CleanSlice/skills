# Reviewing Pull Requests

How an agent fetches a PR's diff, walks the changes, and posts a useful review with inline comments.

---

## Workflow shape

```
1. Fetch PR metadata     → know what it claims to do
2. Fetch the diff        → know what it actually does
3. Walk files            → identify issues per file
4. Draft a review        → group comments, decide overall verdict
5. (Optional) Confirm    → show the user the draft before posting
6. Submit                → POST the review with inline comments + a body
```

Don't shortcut step 4. **An agent that fires `POST /pulls/{n}/comments` one comment at a time creates a notification storm** — every comment sends a separate email. Always batch into a single review submission.

---

## Step 1 — fetch PR metadata

```ts
const pr = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}`,
  headers,
})

// Useful fields:
// pr.title, pr.body
// pr.user.login (author)
// pr.head.sha, pr.head.ref     ← what's being merged in
// pr.base.sha, pr.base.ref     ← target branch
// pr.changed_files, pr.additions, pr.deletions
// pr.draft (don't review drafts unless asked)
// pr.merged, pr.state ('open' | 'closed')
// pr.requested_reviewers, pr.requested_teams
```

If `pr.draft === true`, ask the user: "This PR is still a draft — review now anyway, or wait until it's marked ready?"

If `pr.merged === true` or `pr.state === 'closed'`, **stop**. Reviewing a closed PR posts comments nobody will see.

---

## Step 2 — fetch the diff

Two ways. Pick by size.

### Option A — Patch format (small PRs)

```ts
const diff = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}`,
  headers: { ...headers, Accept: 'application/vnd.github.v3.diff' },
  responseType: 'text',
})
// Returns the unified diff as text
```

Easy to feed to the agent's reasoning, but capped at ~3MB. Big PRs return `406 Not Acceptable`.

### Option B — Files list (any size, paginated)

```ts
const files = await paginate<{
  filename: string
  status: 'added' | 'modified' | 'removed' | 'renamed'
  additions: number
  deletions: number
  changes: number
  patch?: string          // missing for binary files and very large diffs
  sha: string
  blob_url: string
  raw_url: string
  contents_url: string
}>(
  `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/files`,
  headers,
)
```

Each file's `patch` field is the unified diff for just that file. Some entries (binaries, huge files) have no `patch` — fetch the raw content via `raw_url` if needed.

**Filter before reviewing:**

```ts
const reviewable = files.filter(f =>
  f.status !== 'removed' &&
  f.patch &&
  !f.filename.match(/\.(lock|svg|png|jpg|min\.js|generated\..*)$/) &&
  !f.filename.startsWith('node_modules/') &&
  !f.filename.startsWith('dist/'),
)
```

Reviewing lock files and generated code creates noise.

---

## Step 3 — walk files and identify issues

For each file, the agent should look at:

| Category | What to flag |
|----------|--------------|
| **Correctness** | Off-by-one, null/undefined, race conditions, error swallowing |
| **Security** | SQL injection, XSS, hardcoded secrets, weak crypto, SSRF, path traversal |
| **Performance** | N+1 queries, sync I/O in hot paths, unbounded loops, memory leaks |
| **API contract** | Breaking changes without version bump, removed public exports, response shape changes |
| **Tests** | Behavior changed but no test, mocked-too-much, test-only changes flagged for review |
| **Conventions** | Project-specific patterns the codebase has elsewhere (check existing files) |
| **Docs** | Public API added/changed but no doc update |

**Don't flag style.** Lint/format is the lint tool's job. An agent commenting "use const instead of let" is noise.

**Don't flag personal preferences.** If the code works and matches surrounding style, leave it alone.

---

## Step 4 — draft the review

Group findings by severity. The standard set:

| Severity | When | How to phrase |
|----------|------|---------------|
| `blocker` | Bug, security issue, breaks production | "This will fail when X. Suggest Y." |
| `nit` | Minor improvement, optional | "Nit: consider …" |
| `question` | Unclear intent, may be fine | "Why this approach over Z?" |
| `praise` | Genuinely good change | "Nice cleanup of the gateway here." |

Pick the overall **review event**:

- `APPROVE` — no blockers, would happily merge as-is
- `REQUEST_CHANGES` — has blockers, **must** be addressed before merge
- `COMMENT` — neutral; uses for questions, suggestions, or when the agent isn't authoritative

Default to `COMMENT` for agent reviews — humans should make the call on approve/block. Only use `REQUEST_CHANGES` for clear bugs the agent has high confidence about, and only when the user explicitly told the agent to be the reviewer.

---

## Step 5 — show the user the draft

For anything beyond trivial reviews, send the user a summary first:

```
PR #234 review draft (3 comments, COMMENT event):

🔴 [blocker] api/src/slices/user/data/user.gateway.ts:47
  The Prisma call doesn't filter by tenant — would leak rows across tenants.

🟡 [question] api/src/slices/user/domain/user.service.ts:88
  Why retry with a fixed delay instead of exponential backoff?

✅ Overall: 1 blocker. Suggest REQUEST_CHANGES.

Post this review? (yes / edit / skip)
```

Wait for the user. Don't auto-post.

---

## Step 6 — submit the review

**One API call** with all inline comments batched in:

```ts
await http({
  method: 'POST',
  url: `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/reviews`,
  headers,
  body: {
    commit_id: pr.head.sha,    // pin to the SHA you actually reviewed
    event: 'COMMENT',          // or APPROVE / REQUEST_CHANGES
    body: 'Reviewed by ranch-agent. 1 blocker, 1 question.\n\n— Bot review, please verify before acting.',
    comments: [
      {
        path: 'api/src/slices/user/data/user.gateway.ts',
        line: 47,
        side: 'RIGHT',         // 'RIGHT' for new code, 'LEFT' for removed
        body: '**[blocker]** This Prisma call doesn\'t filter by tenant — would leak rows across tenants.\n\nSuggest:\n```ts\nwhere: { tenantId: ctx.tenantId, ... }\n```',
      },
      {
        path: 'api/src/slices/user/domain/user.service.ts',
        line: 88,
        side: 'RIGHT',
        body: '**[question]** Why retry with a fixed delay instead of exponential backoff?',
      },
    ],
  },
})
```

### Critical details

- **`commit_id` MUST match the PR's current head SHA.** If a new commit is pushed while you're drafting, your inline comments will be marked as "outdated" and may not render. Refetch the PR right before submitting.
- **`line` is the line number in the file (1-indexed), NOT the diff hunk line.** GitHub maps it to the diff for you.
- **`side: 'RIGHT'`** for additions, **`'LEFT'`** for deletions. Mismatched side returns `422 Pull request review thread side must be...`.
- **For multi-line comments**, add `start_line` + `start_side`:
  ```ts
  { path: 'x.ts', start_line: 10, start_side: 'RIGHT', line: 15, side: 'RIGHT', body: '...' }
  ```
- **You can't comment on a line that isn't in the diff.** If you need to comment on unchanged code, post a top-level review comment in `body` instead, mentioning the file/line.

### Suggestion blocks

GitHub renders ```` ```suggestion ```` blocks as one-click "apply suggestion" buttons:

````md
Consider:
```suggestion
const user = await this.userGateway.findById(id, { tenantId: ctx.tenantId })
```
````

Use suggestions liberally for one-line fixes — they're frictionless for the author to apply.

---

## Re-review after changes

If the author pushes new commits, the **reviews don't carry over**. Submit a new review.

To check if the head moved:

```ts
const fresh = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}`,
  headers,
})
if (fresh.body.head.sha !== priorSha) {
  // new commits — agent should re-walk the new diff (or just the changes since priorSha)
}
```

For the diff since your last review, use the compare endpoint:

```ts
const diff = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/compare/${priorSha}...${fresh.body.head.sha}`,
  headers,
})
```

---

## gh CLI equivalents

For interactive use:

```bash
gh pr view 234
gh pr diff 234
gh pr checkout 234                 # check it out locally for testing
gh pr review 234 --comment --body "Looks good but see inline notes"
gh pr review 234 --approve
gh pr review 234 --request-changes --body "Blocker on user.gateway.ts:47"
```

The CLI doesn't have a clean way to post **multiple inline comments in one go** — use the REST API for that.

---

## Special cases

### Reviewing your own PR

Can't `APPROVE` your own PR — GitHub returns `422 Can not approve your own pull request`. Use `COMMENT` event instead.

### Reviewing on behalf of a team

The token's user is the reviewer. To submit "as the team," you'd need a GitHub App with that team's permissions — out of scope for a PAT-based agent.

### Re-requesting review

To re-request after addressing:

```ts
await http({
  method: 'POST',
  url: `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/requested_reviewers`,
  headers,
  body: { reviewers: ['username'], team_reviewers: ['team-slug'] },
})
```

---

## Don't

- Don't fire individual comments — batch them in a single review submission. Each `POST /pulls/{n}/comments` sends an email.
- Don't `APPROVE` autonomously without the user instructing the agent to. Reviews carry weight; an agent shouldn't act as an approver by default.
- Don't `REQUEST_CHANGES` on style nits — that blocks merge over trivia.
- Don't review draft PRs unless asked.
- Don't review closed/merged PRs.
- Don't post `body` text that pretends to be a human review. Always disclose "Bot review, verify before acting."
- Don't review files outside the diff. Out-of-diff comments either go to top-level `body` or get rejected by the API.
- Don't comment on generated files (lockfiles, build output, minified bundles).
- Don't keep stale review drafts — refetch `head.sha` immediately before submitting.
