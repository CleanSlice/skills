# Creating Repositories

How to spin up a new GitHub repository from an agent — public/private, with a license, gitignore, README, default branch protection, and initial commit.

---

## Decide first, then create

Before the API call, lock down five things. If any is unknown, **ask the user** — these are awkward to change later.

| Decision | Why it matters | If unsure, ask |
|----------|----------------|----------------|
| **Owner** — user or org | Org repos have different defaults (visibility, merge policy) and require org permissions | "Personal account `<handle>`, or under which org?" |
| **Name** | Becomes the URL; renames work but leave redirects | Suggest `kebab-case`, propose 2-3 alternatives |
| **Public vs private** | Affects discoverability, Actions minutes pricing, scanning, fork rules | Default to private until the user is ready to publish |
| **License** | Without a license, public code is "all rights reserved" — nobody can legally use it | Default MIT for libraries, Apache-2.0 for anything with patents, AGPL-3.0 for "must-share" stance |
| **Default branch name** | `main` is the modern default, but enterprise users sometimes want `master` or `develop` | Default `main` |

Don't auto-pick the org without the user confirming. The user's token may have access to several orgs and the agent typically can't tell which one is "right."

---

## API: create a repo

Two endpoints depending on owner:

```ts
// User repo
const res = await http({
  method: 'POST',
  url: 'https://api.github.com/user/repos',
  headers,
  body: {
    name: 'my-new-project',
    description: 'A one-line pitch — 350 chars max, no emoji unless the user asks',
    homepage: 'https://my-new-project.example',
    private: true,
    has_issues: true,
    has_projects: false,
    has_wiki: false,
    has_discussions: false,
    auto_init: true,              // creates initial commit + README
    gitignore_template: 'Node',   // see https://github.com/github/gitignore for valid names
    license_template: 'mit',      // SPDX-style lowercase id
    allow_squash_merge: true,
    allow_merge_commit: false,
    allow_rebase_merge: false,
    delete_branch_on_merge: true,
  },
})
```

```ts
// Org repo
const res = await http({
  method: 'POST',
  url: `https://api.github.com/orgs/${org}/repos`,
  headers,
  body: { /* same shape */ },
})
```

The response includes `clone_url`, `html_url`, `default_branch`. Surface `html_url` back to the user immediately — they'll want to click it.

### gh CLI equivalent

```ts
await exec(
  `gh repo create ${owner}/${name} \
    --${visibility} \
    --description ${JSON.stringify(description)} \
    --license mit \
    --gitignore Node \
    --homepage ${JSON.stringify(homepage)} \
    --add-readme`,
  { env: { GH_TOKEN: token } },
)
```

`--clone` would also clone locally — pass it only when the next step is to push code.

---

## Initial commit content

`auto_init: true` creates a minimal README with just the repo name as `# Title` and the description as the first line. That's almost never what you want long-term — but it's enough to get the default branch into existence so subsequent API calls (branch protection, topics, etc.) work.

**Replace the README in a second commit** using the Contents API:

```ts
const path = 'README.md'
const content = Buffer.from(readme, 'utf-8').toString('base64')

// Get the current sha (auto_init produced one)
const cur = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/contents/${path}`,
  headers,
})

await http({
  method: 'PUT',
  url: `https://api.github.com/repos/${owner}/${name}/contents/${path}`,
  headers,
  body: {
    message: 'docs: initial README',
    content,
    sha: cur.body.sha,
    branch: 'main',
  },
})
```

For more than a few files, `git clone` + local edits + `git push` is much faster — drop to `exec` for that.

---

## Pushing an existing working tree

If the agent already has a local working tree (e.g. it just scaffolded code), don't use `auto_init`. Create empty, then push:

```ts
await http({
  method: 'POST',
  url: 'https://api.github.com/user/repos',
  headers,
  body: { name, description, private: true, auto_init: false },
})

await exec(
  `cd ${workdir} && \
   git init -b main && \
   git add . && \
   git -c user.name='${userName}' -c user.email='${userEmail}' commit -m 'feat: initial commit' && \
   git remote add origin https://x-access-token:${token}@github.com/${owner}/${name}.git && \
   git push -u origin main`,
)
```

The `x-access-token:<token>` URL form is the documented way to push without setting a global credential helper. Don't commit code without setting `user.name`/`user.email` — the runtime's default identity will leak into the commit history.

---

## Branch protection on `main` (optional but recommended)

Apply right after the first push. Requires `Administration: write`.

```ts
await http({
  method: 'PUT',
  url: `https://api.github.com/repos/${owner}/${name}/branches/main/protection`,
  headers,
  body: {
    required_status_checks: null,         // fill once CI exists
    enforce_admins: false,
    required_pull_request_reviews: {
      required_approving_review_count: 1,
      dismiss_stale_reviews: true,
    },
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
    required_linear_history: true,
    required_conversation_resolution: true,
  },
})
```

For solo projects, this is overkill — protection prevents the user from pushing directly to `main` and they'll be confused why their next push fails. **Confirm with the user first**:

> "Do you want me to enable branch protection on `main` (requires PR + 1 review)? This is recommended for team repos but slows down solo work — leave it off if you're working alone."

---

## After creation, propose optimization

A freshly created repo has no topics, no social preview, a placeholder README, and no community health files. The agent's next move should be to load [`optimize-repo.md`](./optimize-repo.md) and walk the user through filling those in.

---

## Don't

- Don't create the repo before the user has confirmed name, visibility, and owner. Renames are cheap; the wrong owner is annoying.
- Don't enable `has_wiki` and `has_projects` by default — they add noise to small repos.
- Don't pick a license without the user's say-so. License choice is legal, not technical.
- Don't push initial commits with the runtime's default git identity. Use the user's name/email.
- Don't enable branch protection silently — it will block the user's next direct push and they'll think the repo is broken.
- Don't embed the token in a remote URL that gets `git remote -v`'d back to the user. Strip it after pushing: `git remote set-url origin https://github.com/<owner>/<name>.git`.
