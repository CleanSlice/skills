# Optimizing Repositories for Discoverability

How to make a repo look professional and rank well in GitHub search, npm search engines, and crawlers like Sourcegraph and Grep.app. None of this requires touching code — it's all metadata and prose.

---

## What GitHub indexes

GitHub's repo search ranks by, roughly:

1. **Name match** — exact match on the repo name wins.
2. **Description match** — second-strongest signal.
3. **Topics match** — third, but with a discoverability bonus (topic pages list all repos with that topic).
4. **README content** — full-text indexed but weighted lower.
5. **Stars / forks / activity** — tiebreaker.

So the highest-leverage edits, in order, are: **name → description → topics → README → social preview → community files**.

---

## Step 1 — audit the current state

Pull the repo metadata and the community-profile score:

```ts
const repo = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}`,
  headers,
})

const community = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/community/profile`,
  headers,
})

const topics = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/topics`,
  headers,
})
```

The community profile returns a `health_percentage` (0-100) and a `files` object showing which of the recommended community files exist:

```jsonc
{
  "health_percentage": 33,
  "files": {
    "code_of_conduct": null,
    "contributing": null,
    "issue_template": null,
    "pull_request_template": null,
    "license": { "spdx_id": "MIT" },
    "readme": { "size": 124 },
    "security": null
  }
}
```

Show this score to the user before making changes — "your repo scores 33/100 on GitHub's community health metric; here's what's missing."

---

## Step 2 — propose, don't apply

Edits to the description, topics, and README are visible to anyone watching the repo. **Never apply them without showing the user the before/after first.**

Format every proposal like:

```
About section:
  Current: <current description or "(empty)">
  Proposed: <new description>

Topics:
  Current: [foo, bar]
  Proposed: [foo, bar, typescript, nestjs, clean-architecture]

README:
  Adds: Installation section, Quick Start section, badges (build, license, version)
  Changes: Reorders sections to put Quick Start above Architecture
  Removes: Stale "Coming soon" placeholder
```

Wait for the user to approve each block. Don't bundle "update description AND topics AND README" into one approval — it makes rollback awkward.

---

## Description (the "About" tagline)

Up to **350 characters**, plain text only, no markdown. Shows up in:
- Repo header on the page
- Search results (truncated at ~80 chars)
- Sharing previews (Twitter/X, Slack unfurls)
- Browser tab titles

**Good descriptions are:**
- A single sentence
- Lead with **what it is**, not "an awesome ..."
- Mention the **primary tech** (one or two terms) so it ranks on those searches
- Include a unique differentiator if there is one

Examples:

| Bad | Good |
|-----|------|
| "Awesome AI agent" | "Self-hostable AI agent runtime with per-user secret vault and browser automation" |
| "My SaaS template" | "NestJS + Nuxt 3 SaaS starter with clean architecture, Prisma, and shadcn-vue" |
| "Helpful library" | "TypeScript pagination helper that walks GitHub-style Link headers" |

Apply:

```ts
await http({
  method: 'PATCH',
  url: `https://api.github.com/repos/${owner}/${name}`,
  headers,
  body: {
    description: '<new>',
    homepage: 'https://example.com',  // shows next to description in the About box
  },
})
```

---

## Topics

Topics are the **biggest discoverability lever**. Each topic has its own page on `github.com/topics/<name>` listing every repo using it. Up to **20 topics per repo**.

### Rules

- Lowercase, alphanumeric + hyphens, max 50 chars (GitHub will reject otherwise — `422`).
- Must start with a letter or number.
- Prefer **established topics** over invented ones. Check `https://github.com/topics/<term>` first — if there's a populated page, use exactly that name. Inventing `clean-arch` when `clean-architecture` is the canonical topic costs you the discovery boost.

### Topic-selection strategy

Pick from these buckets, in order:

1. **Language / runtime** (1-2): `typescript`, `python`, `rust`, `nodejs`, `deno`
2. **Primary framework** (1-2): `nestjs`, `nuxt`, `react`, `fastapi`
3. **Domain / category** (2-3): `ai-agent`, `saas-boilerplate`, `cli-tool`, `static-site-generator`
4. **Architecture / pattern** (1-2): `clean-architecture`, `monorepo`, `serverless`
5. **Hot adjacent tags** (1-3): `llm`, `mcp-server`, `anthropic-claude`, `openai`

Aim for **10-15 topics**. Below 5 wastes the budget; above 18 looks spammy.

Apply:

```ts
await http({
  method: 'PUT',
  url: `https://api.github.com/repos/${owner}/${name}/topics`,
  headers: { ...headers, Accept: 'application/vnd.github.mercy-preview+json' },
  body: {
    names: ['typescript', 'nestjs', 'nuxt', 'clean-architecture', 'saas', 'starter-kit'],
  },
})
```

The `mercy-preview` accept header is no longer strictly required but doesn't hurt.

---

## README — the single biggest content lever

A good README answers, in this order, in under 30 seconds of scrolling:

1. **What is this?** (one paragraph, max 3 sentences)
2. **Who is it for?** (one line — "for X who want Y")
3. **Quick start** (one shell snippet, working out of the box)
4. **Key features** (bulleted, 4-7 items)
5. **Docs link** if separate site exists
6. **Stack / Architecture** (one paragraph or simple diagram)
7. **Contributing** (link to CONTRIBUTING.md)
8. **License** (one line)

### Badges (top of the README)

A badge row signals "this is a real project." Use [shields.io](https://shields.io) (no API call needed — they're static SVGs).

Standard set:

```markdown
![CI](https://img.shields.io/github/actions/workflow/status/<owner>/<name>/ci.yml?branch=main)
![License](https://img.shields.io/github/license/<owner>/<name>)
![npm](https://img.shields.io/npm/v/<package-name>)
![GitHub stars](https://img.shields.io/github/stars/<owner>/<name>?style=social)
```

Only include badges that are **real and current**. A broken CI badge that's been red for 6 months actively hurts trust.

### Hero / screenshot

For UI projects or CLI tools with interesting output, a screenshot or asciinema cast immediately above the description converts visitors to clones. Upload via:

```ts
// Upload an image and reference it from the README
// Easiest: drop it in /docs/images/ in the repo, reference with raw URL
```

Don't link to external image hosts (imgur, etc.) — they 404 over time. Use repo-relative paths.

### Update the README via API

For agent-driven edits, fetch current contents → diff → PUT with sha:

```ts
const cur = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/contents/README.md`,
  headers,
})

const newContent = Buffer.from(readme, 'utf-8').toString('base64')

await http({
  method: 'PUT',
  url: `https://api.github.com/repos/${owner}/${name}/contents/README.md`,
  headers,
  body: {
    message: 'docs: rewrite README for discoverability',
    content: newContent,
    sha: cur.body.sha,
    branch: 'main',  // or open a PR — see below
  },
})
```

For non-trivial README changes on shared repos, **open a PR instead of pushing to `main`**. Same Contents API, but commit to a new branch first, then `POST /repos/.../pulls`.

---

## Social preview image

The card that shows up when the repo is linked on X, Slack, LinkedIn, etc. 1280×640 PNG/JPG, under 1 MB.

**Not settable via REST API** — must be uploaded through the web UI (Settings → Social preview). The agent should:

1. Generate or fetch the image.
2. Tell the user: "I've prepared a social preview image at `<path>`. Upload it manually at `https://github.com/${owner}/${name}/settings` → Social preview → Upload image."
3. Optionally generate it programmatically if the user wants (e.g. via a Figma export, Cloudinary template, or `@vercel/og`).

A repo without a social preview falls back to a generic GitHub octocat image. The lift from "generic" to "real card" is huge for shares.

---

## Community health files

Each missing file lowers the community profile score. Fix in this priority order:

| File | Path | Why | Generator |
|------|------|-----|-----------|
| `LICENSE` | root | Without it, the code is "all rights reserved" | Use SPDX template; MIT for libraries, Apache-2.0 with patents |
| `README.md` | root | Covered above | — |
| `CONTRIBUTING.md` | root or `.github/` | Signals project is open to contributions | Short template — branch naming, commit style, dev setup |
| `CODE_OF_CONDUCT.md` | root or `.github/` | Required for many curated lists, expected on serious projects | [Contributor Covenant](https://www.contributor-covenant.org/) is the de-facto standard |
| `SECURITY.md` | root or `.github/` | Tells researchers where to send vulns | One line: "Email security@<domain> with details. We respond within 48h." |
| `.github/ISSUE_TEMPLATE/` | dir | Higher-quality issues | Bug + feature templates |
| `.github/PULL_REQUEST_TEMPLATE.md` | file | Standardized PR descriptions | Short — Summary, Test plan, Checklist |
| `.github/FUNDING.yml` | file | Sponsor button | Optional |

The agent can scaffold all of these from boilerplate, but **only commit them with the user's approval** — they show up in every PR template the user opens afterward.

---

## Default branch + merge settings

Worth reviewing once:

```ts
await http({
  method: 'PATCH',
  url: `https://api.github.com/repos/${owner}/${name}`,
  headers,
  body: {
    default_branch: 'main',
    allow_squash_merge: true,        // recommended default
    allow_merge_commit: false,
    allow_rebase_merge: false,
    delete_branch_on_merge: true,    // keeps the branch list clean
    allow_auto_merge: true,
    squash_merge_commit_title: 'PR_TITLE',
    squash_merge_commit_message: 'PR_BODY',
  },
})
```

`PR_TITLE` + `PR_BODY` for squash commits gives much better git history than the default `commit_messages` join.

---

## Discoverability beyond GitHub

These are off-platform but the agent can prep them:

| Channel | What helps |
|---------|------------|
| npm / PyPI / crates.io | Same description + topics → keywords. Cross-link with the GitHub repo. |
| Awesome lists | Identify the right `awesome-<topic>` list and propose a PR adding your repo |
| Product Hunt / Hacker News Show HN | One-time launches — agent can draft the post but the user should publish |
| Dev.to / Hashnode | Cross-post the README as an article on launch |

The agent should **propose**, not auto-publish, anything that posts to a third-party site.

---

## Don't

- Don't apply description/topic/README changes without before/after approval — they're public and visible.
- Don't pad the description with emoji or "🚀 Awesome 🔥" — it kills professional perception and adds nothing to search.
- Don't pick topics that don't have an existing topic page when an equivalent canonical one exists.
- Don't add badges for things you haven't verified work (broken CI badge, wrong npm package).
- Don't commit a `LICENSE` without confirming the license choice with the user — it's a legal commitment.
- Don't squash badges or screenshots that aren't repo-relative — external image hosts rot.
- Don't bulk-apply community health files on someone else's existing repo without asking — issue templates change everyone's reporting flow.
