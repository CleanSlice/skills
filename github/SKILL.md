---
name: github
description: GitHub API access via a personal access token stored in the per-user secret vault. Exposed to agents as GITHUB_TOKEN.
---

# GitHub

Same setup mechanics as [[openai]] — load that skill first for the secret-vault flow. This file covers GitHub-specific usage.

---

## Quick Reference

| Need | Answer |
|------|--------|
| Mechanism | `secret` |
| Env var | `GITHUB_TOKEN` |
| Per-account aliases | `GITHUB_TOKEN_<ACCOUNTKEY>` |
| Where to create | github.com/settings/tokens (fine-grained recommended) |
| Required scopes | `repo` + `read:user` for most workflows; `workflow` for Actions; `admin:org` for org management |

---

## Setting up

1. Go to https://github.com/settings/tokens?type=beta and create a fine-grained token.
2. Scope it narrowly: pick the specific repos and grant only the permissions the agent needs.
3. Open the admin UI at `/integrations` → **GitHub** → paste the `ghp_…` token.

Use multiple accountKeys (`personal`, `work`, `agency-acme`) when the user juggles separate identities — each has its own row and the agent can pick via the alias.

---

## Using the token

```ts
const { env } = await integration_secrets({ service: 'github' })
const token = env.GITHUB_TOKEN
if (!token) {
  return ctx.send(
    'GitHub isn\'t connected. Open /integrations and add a GitHub token first.',
  )
}

const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
  headers: {
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    Accept: 'application/vnd.github+json',
  },
})
```

For shell-based GitHub work (clone, commit, push), set the token as `GH_TOKEN`:

```ts
const { env } = await integration_secrets({ service: 'github' })
await shell('gh repo clone owner/repo', { env: { GH_TOKEN: env.GITHUB_TOKEN } })
```

---

## Don't

- Don't grant `admin:repo_hook` or `delete:packages` unless the agent's job specifically requires them.
- Don't reuse a single PAT across multiple users — each user must have their own. The per-user secret store enforces this.
- Don't use classic PATs when fine-grained tokens work. Fine-grained ones can be scoped to specific repos and rotate cleanly.
