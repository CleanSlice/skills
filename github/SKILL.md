---
name: github
description: GitHub workflow automation via the per-user secret vault. Create and optimize repositories for discoverability, monitor Actions and deployments, review PRs with inline comments, and ship new releases. Exposed to agents as GITHUB_TOKEN.
---

# GitHub

The user's GitHub token lives in the ranch per-user secret vault — set once via the admin UI, resolved lazily by the runtime on each tool invocation. Agents see it as the environment variable `GITHUB_TOKEN`.

Same setup mechanics as [[openai]] — load that skill first for the secret-vault flow. This file covers GitHub-specific usage.

---

## Quick Reference

| Need | Answer |
|------|--------|
| Mechanism | `secret` |
| Env var | `GITHUB_TOKEN` |
| Per-account aliases | `GITHUB_TOKEN_<ACCOUNTKEY>` — e.g. `GITHUB_TOKEN_WORK` |
| Tool | `integration_secrets` — fetches the user's resolved env map |
| Where to create | github.com/settings/tokens (fine-grained recommended) |
| REST base | `https://api.github.com` |
| API version header | `X-GitHub-Api-Version: 2022-11-28` |
| Accept header | `application/vnd.github+json` |
| CLI alternative | `gh` — pass `GH_TOKEN` env var |

---

## Setting up

1. Go to https://github.com/settings/tokens?type=beta and create a **fine-grained personal access token**.
2. Scope it narrowly: pick the specific repos and grant only what the agent needs.
3. Open the admin UI at `/integrations` → **GitHub** → paste the `github_pat_…` (or `ghp_…` for classic) token.

Use multiple `accountKey`s (`personal`, `work`, `agency-acme`) when the user juggles separate identities — each has its own row and the agent picks via the alias.

### Token scopes by task

| Task | Fine-grained permissions | Classic scopes |
|------|--------------------------|----------------|
| Read repos / PRs / Actions | `Contents: read`, `Pull requests: read`, `Actions: read`, `Metadata: read` | `repo:status`, `public_repo` |
| Create repos | `Administration: write` on the user/org | `repo` |
| Edit repo metadata (description, topics, homepage) | `Administration: write` | `repo` |
| Review PRs (post comments, approve) | `Pull requests: write`, `Contents: read` | `repo` |
| Trigger / rerun workflows | `Actions: write` | `workflow` |
| Create releases & tags | `Contents: write` | `repo` |
| Manage org-level settings | `Members: read` + org scope | `admin:org` |

Don't grant `admin:repo_hook` or `delete:packages` unless the agent specifically needs them.

---

## Step 0 — discover the account, never guess

```ts
const { accounts } = await integration_list()
const gh = accounts.find(a => a.service === 'github')
if (!gh) {
  return ctx.send(
    "GitHub isn't connected. Open /integrations and add a GitHub token first.",
  )
}

const { env } = await integration_secrets({ service: 'github', accountKey: gh.accountKey })
const token = env.GITHUB_TOKEN
```

If the user has multiple GitHub accounts connected (e.g. `personal` + `work`), pick deliberately via the alias: `env.GITHUB_TOKEN_WORK`. Most-recently-updated wins the bare `GITHUB_TOKEN`.

---

## Two call styles — REST or `gh` CLI

The agent has two ways to hit GitHub. Pick per task:

| Style | Best for | How |
|-------|----------|-----|
| **REST via `http`** | Pure data ops, anything inside an automated loop, single-shot reads | `http({ method, url, headers: { Authorization: Bearer ${token} } })` |
| **`gh` CLI via `exec`** | Local git-aware tasks (clone, push, PR creation from a working tree), interactive flows, multi-step plumbing | `exec('gh ...', { env: { GH_TOKEN: token } })` |

The REST API is the default — it works the same on every host, doesn't depend on `gh` being installed, and returns structured JSON. Reach for `gh` only when you genuinely need git context that the API can't give you alone.

### Universal headers helper

```ts
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'ranch-agent',  // GitHub rejects requests without UA
}
```

`User-Agent` is mandatory on the GitHub API. Requests without it return `403`.

---

## Capability map — what this skill teaches

Each capability has a dedicated reference document. Load the one matching the current task.

| Need | Reference | When to load |
|------|-----------|--------------|
| Spin up a new repository — public/private, license, gitignore, initial README, branch protection | [`references/create-repo.md`](./references/create-repo.md) | User says "create a repo", "new project on GitHub", "start a new GitHub project" |
| Improve discoverability — description, topics, homepage, README quality, social preview, community health files | [`references/optimize-repo.md`](./references/optimize-repo.md) | "optimize my repo", "improve SEO", "make it look better on GitHub", "fill in the About section" |
| Inspect CI — workflow runs, failed jobs, logs, deployment status, re-runs | [`references/check-actions.md`](./references/check-actions.md) | "did the deploy pass?", "what failed in CI?", "check Actions", "rerun the workflow" |
| Review pull requests — fetch diff, walk files, post review with inline comments | [`references/review-pr.md`](./references/review-pr.md) | "review PR #123", "leave comments on this PR", "approve / request changes" |
| Cut a release — bump version, tag, generate notes, publish | [`references/release.md`](./references/release.md) | "ship a release", "publish v1.2.0", "tag and release", "draft release notes" |

---

## Common patterns

### Pagination

Most list endpoints cap at `per_page=100`. Walk the `Link: …rel="next"` header until it's gone:

```ts
async function paginate<T>(url: string, headers: Record<string, string>): Promise<T[]> {
  const out: T[] = []
  let next: string | null = `${url}${url.includes('?') ? '&' : '?'}per_page=100`
  while (next) {
    const res = await http({ method: 'GET', url: next, headers })
    out.push(...(res.body as T[]))
    const link = res.headers['link'] as string | undefined
    const match = link?.match(/<([^>]+)>;\s*rel="next"/)
    next = match ? match[1] : null
  }
  return out
}
```

### Rate limits

| Token type | Limit | Header to watch |
|------------|-------|-----------------|
| Authenticated user | 5,000 req/hr | `X-RateLimit-Remaining` |
| GitHub App installation | 5,000 req/hr per installation | same |
| Search API | 30 req/min | `X-RateLimit-Remaining` (separate bucket) |
| GraphQL | 5,000 points/hr | different — query `rateLimit { remaining }` |

Before a burst of writes, check `GET /rate_limit`. On `403` + `X-RateLimit-Remaining: 0`, sleep until `X-RateLimit-Reset` (unix seconds) — don't retry blindly.

### Conditional requests (free reads)

Pass `If-None-Match: <etag>` from a prior response. A `304 Not Modified` doesn't count against the rate limit. Worth doing for any polling loop (Actions status, PR state, etc.).

### Error handling

| Status | Meaning | Action |
|--------|---------|--------|
| `401` | Token invalid / expired | `integration_request_login` flow or ask user to rotate |
| `403` + `rate limit` headers | Throttled | Sleep until reset |
| `403` + `Resource not accessible by integration` | Scope missing | Tell the user which permission to add |
| `404` | Repo private to you, or doesn't exist, or your token doesn't have access | Don't echo the URL back as proof it doesn't exist — token scope is the most common cause |
| `422` | Validation (e.g. branch protection conflict, topic format wrong) | Read the response body — GitHub explains the exact field |
| `409` | Repo not empty when you tried to init, or sha conflict | Refetch and retry |

### Idempotency

GitHub mutating endpoints are NOT idempotent. Creating the same repo twice is a `422` error, not a no-op. Always check existence first with a `GET` when retrying.

---

## End-to-end example: create → optimize → release

A common composite task. The agent should do these in order and ask the user to confirm at each handoff:

1. **Create** the repo from the user's description ([`create-repo.md`](./references/create-repo.md)).
2. **Push initial code** (the agent's working tree, or a scaffold).
3. **Optimize** the About section, topics, README badges, license, social preview ([`optimize-repo.md`](./references/optimize-repo.md)). Suggest improvements with explicit before/after diffs and **wait for user approval** before applying.
4. **Verify Actions** if a CI workflow exists ([`check-actions.md`](./references/check-actions.md)).
5. **Cut v0.1.0** when the user is ready ([`release.md`](./references/release.md)).

Don't fold these into one autonomous run unless the user explicitly asked for it. SEO-style edits to a repo are visible to the public — pause for approval on each change.

---

## Don't

- Don't grant `admin:repo_hook` or `delete:packages` unless the agent's job specifically requires them.
- Don't reuse a single PAT across multiple users — each user must have their own. The per-user secret store enforces this.
- Don't use classic PATs when fine-grained tokens work. Fine-grained ones can be scoped to specific repos and rotate cleanly.
- Don't echo the token in chat output, logs, or error messages. Filter `Authorization` headers before logging requests.
- Don't omit the `User-Agent` header — GitHub returns `403` without it.
- Don't burst writes — `403 secondary rate limit` triggers a per-account cooldown that can last hours.
- Don't take destructive actions (delete repo, force-push to default branch, delete release, mark PR as ready/merge) without explicit user confirmation in the same conversation.
- Don't trust the agent's narration that "the PR is merged" — verify by re-reading `GET /pulls/{n}` and checking `merged: true`.

---

## References

- [GitHub REST API docs](https://docs.github.com/rest)
- [GitHub CLI manual](https://cli.github.com/manual/)
- [Authentication & scopes](https://docs.github.com/authentication)
- [Rate limits](https://docs.github.com/rest/rate-limit)
- [Fine-grained PAT permissions table](https://docs.github.com/rest/overview/permissions-required-for-fine-grained-personal-access-tokens)
- [Community profile metric](https://docs.github.com/rest/metrics/community)
- [Auto-generated release notes config](https://docs.github.com/repositories/releasing-projects-on-github/automatically-generated-release-notes)
