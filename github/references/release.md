# Cutting Releases

How to ship a new version: bump the version file, commit, tag, generate release notes, and publish a GitHub Release. Optionally trigger downstream publish workflows.

---

## What "release" means here

A GitHub Release is **a tag + a notes page + (optional) attached binaries**. It does NOT, by itself:
- Publish to npm / PyPI / crates.io / Docker Hub
- Bump version in `package.json` (or equivalent)
- Build anything

Those are separate. Most modern projects wire a `release: published` workflow that does the build + publish automatically — creating the Release becomes the trigger. The agent's job is everything **up to and including** publishing the Release.

---

## Pre-flight checklist

Before touching anything, verify:

| Check | How | If failing |
|-------|-----|------------|
| The working tree on the release branch is clean | `exec('git status --porcelain')` returns empty | Refuse to release — stash or commit first |
| You're on the right branch (usually `main`) | `exec('git rev-parse --abbrev-ref HEAD')` | Check out the right one |
| CI is green on `HEAD` | `GET /repos/{o}/{r}/commits/${sha}/check-runs` — all `conclusion: 'success'` | Refuse — ship from green CI only |
| The new version doesn't already exist | `GET /repos/{o}/{r}/releases/tags/${tag}` returns 404 | Refuse — versions are immutable |
| The user has approved the version number | Show them current + proposed | Ask first |

**The agent should refuse the release** if any check fails. Don't try to "fix forward" — the user needs to resolve the issue and re-trigger.

---

## SemVer — pick the bump deliberately

`MAJOR.MINOR.PATCH`. Walk the changes since the last tag and bump accordingly:

| Bump | When |
|------|------|
| `PATCH` | Bug fixes, internal refactors, no API change. `1.2.3 → 1.2.4` |
| `MINOR` | New features, backwards-compatible. `1.2.3 → 1.3.0` |
| `MAJOR` | Breaking change — removed API, changed signature, behavior incompatibility. `1.2.3 → 2.0.0` |

**Pre-1.0 is the wild west.** SemVer says anything in `0.x.y` can break at any minor bump. Most projects still try to honor it informally, but don't over-engineer compatibility for a `0.4.0 → 0.5.0` jump.

### Pre-releases

`1.2.3-rc.1`, `1.2.3-beta.2`, `2.0.0-alpha.1`. GitHub flags these with `prerelease: true` and they don't show up as "Latest release."

Use pre-releases when:
- A breaking change needs testing in the wild before becoming "Latest"
- A major version is in progress and you want to publish RCs

---

## Step 1 — bump the version file

The version source-of-truth varies by stack:

| Stack | File |
|-------|------|
| Node / npm | `package.json` → `version` |
| Python (pyproject) | `pyproject.toml` → `[project] version` or `[tool.poetry] version` |
| Rust | `Cargo.toml` → `[package] version` |
| Go | `go.mod` (no version field — relies on git tags only) |
| .NET | `*.csproj` → `<Version>` |
| Multi-package monorepo | Each package; or one root `version.txt`; or per-tag (`@scope/pkg@1.2.3`) |

Read first to confirm structure, then write:

```ts
// For package.json (most common)
const pkgRaw = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/contents/package.json?ref=${branch}`,
  headers,
})
const pkg = JSON.parse(Buffer.from(pkgRaw.body.content, 'base64').toString())
pkg.version = newVersion
const newContent = Buffer.from(JSON.stringify(pkg, null, 2) + '\n', 'utf-8').toString('base64')

await http({
  method: 'PUT',
  url: `https://api.github.com/repos/${owner}/${name}/contents/package.json`,
  headers,
  body: {
    message: `chore(release): v${newVersion}`,
    content: newContent,
    sha: pkgRaw.body.sha,
    branch,
  },
})
```

If there's a lockfile (`package-lock.json`, `poetry.lock`, etc.), it needs to be regenerated too — easiest done locally:

```bash
git checkout main && git pull
npm version <patch|minor|major> --no-git-tag-version    # also updates package-lock.json
git add package.json package-lock.json
git commit -m "chore(release): v$(node -p "require('./package.json').version")"
git push
```

For monorepos with separate `version` per package, prefer **the project's own release tool** (Changesets, Lerna, Nx release, semantic-release) over hand-bumping — those tools handle inter-package dependency updates that are tedious to do via the API.

---

## Step 2 — generate release notes

GitHub can auto-generate notes from PRs merged since the previous tag. Customize via `.github/release.yml`:

```yaml
changelog:
  exclude:
    labels: ['ignore-for-release', 'chore']
    authors: ['dependabot[bot]', 'github-actions[bot]']
  categories:
    - title: 🚀 Features
      labels: ['feature', 'enhancement']
    - title: 🐛 Bug Fixes
      labels: ['bug', 'fix']
    - title: 📚 Documentation
      labels: ['documentation']
    - title: 🧰 Maintenance
      labels: ['chore', 'refactor', 'dependencies']
    - title: 👀 Other Changes
      labels: ['*']
```

Then fetch generated notes via API:

```ts
const notes = await http({
  method: 'POST',
  url: `https://api.github.com/repos/${owner}/${name}/releases/generate-notes`,
  headers,
  body: {
    tag_name: `v${newVersion}`,
    target_commitish: branch,
    previous_tag_name: `v${prevVersion}`,  // optional, defaults to last release
  },
})
// notes.body.name  → suggested title
// notes.body.body  → markdown body
```

This returns the **draft text** — it does NOT create the release. The agent should show the generated notes to the user, let them edit, then create.

### Editing the auto-notes

The auto-generated notes are usually good for the **What's Changed** section but weak on summary. Insert a hand-written paragraph at the top:

```md
# v1.3.0

This release adds X, fixes Y, and drops support for Z.

**Breaking changes:**
- Removed deprecated `oldMethod()` — migrate to `newMethod()`.

**Highlights:**
- Feature A is 3× faster
- New `--flag` option for CLI

---

<auto-generated What's Changed section>
```

---

## Step 3 — create the Release

```ts
await http({
  method: 'POST',
  url: `https://api.github.com/repos/${owner}/${name}/releases`,
  headers,
  body: {
    tag_name: `v${newVersion}`,
    target_commitish: branch,        // sha or branch — creates the tag if it doesn't exist
    name: `v${newVersion}`,
    body: finalNotes,
    draft: false,
    prerelease: newVersion.includes('-'),  // auto-detect from SemVer pre-release marker
    generate_release_notes: false,         // set true to skip Step 2 and let GitHub auto-fill
    make_latest: 'true',                   // 'true' | 'false' | 'legacy'
  },
})
```

This **creates the tag** if it doesn't exist (no separate `git tag` call needed when using `target_commitish`). The tag points to whatever sha resolves from `target_commitish`.

For more control, create the tag first locally and push, then create the release pointing at the existing tag:

```bash
git tag -a v1.3.0 -m "v1.3.0"
git push origin v1.3.0
```

Then call `POST /releases` without `target_commitish`.

### Drafts

`draft: true` creates a release that isn't published yet — useful when the notes need human polish:

```ts
const draft = await http({ method: 'POST', url: '...', body: { ...body, draft: true } })
// Show draft.body.html_url to the user
// "Review the draft at <url>, then say 'publish' to make it live."

// Later, publish:
await http({
  method: 'PATCH',
  url: `https://api.github.com/repos/${owner}/${name}/releases/${draft.body.id}`,
  headers,
  body: { draft: false },
})
```

---

## Step 4 — attach release assets (if needed)

For binaries, source archives, etc. Two ways:

### A. CI-built assets (recommended)

Wire a workflow on `release: published` that builds and uploads via:

```yaml
- uses: softprops/action-gh-release@v2
  with:
    files: dist/*.tgz
```

This is the standard for npm/Python/Rust projects. The agent just creates the release; CI does the rest.

### B. Agent-uploaded assets

Use the upload endpoint (note: different host — `uploads.github.com`):

```ts
const blob = await readBlob(filePath)
await http({
  method: 'POST',
  url: `https://uploads.github.com/repos/${owner}/${name}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`,
  headers: {
    ...headers,
    'Content-Type': 'application/octet-stream',
  },
  body: blob,
})
```

Only do this for one-off releases without CI infrastructure.

---

## Step 5 — verify the release

The release is created but the publish workflow might still be running:

```ts
// Confirm the release exists
const rel = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/releases/tags/v${newVersion}`,
  headers,
})

// If there's a `release: published` workflow, wait for it
const runs = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/actions/runs?event=release&per_page=3`,
  headers,
})

const releaseRun = runs.body.workflow_runs.find(r => r.head_sha === rel.body.target_commitish)
```

Then poll the release workflow (see [`check-actions.md`](./check-actions.md)) until done.

Final confirmation message to the user should include:
- Release URL (`rel.body.html_url`)
- Package URL if applicable (`https://www.npmjs.com/package/<name>/v/<version>`)
- Release workflow run URL if any

---

## gh CLI equivalents

For the quickest path:

```bash
# Generate notes only
gh release create v1.3.0 --generate-notes --draft

# Create + publish in one shot
gh release create v1.3.0 \
  --title "v1.3.0" \
  --notes-file RELEASE_NOTES.md \
  --target main

# Pre-release
gh release create v2.0.0-rc.1 --prerelease --generate-notes

# Upload assets
gh release upload v1.3.0 dist/*.tgz
```

`gh release create --draft --generate-notes` is the fastest way to a reviewable draft — `gh` prints the URL on stdout.

---

## Rollback / mark-bad

You **cannot** unpublish a release in a clean way once downstream consumers may have it. Options, in order of preference:

1. **Cut a fix release.** `v1.3.0` is broken? Ship `v1.3.1` immediately.
2. **Mark as pre-release.** Sets `prerelease: true` so it stops being "Latest":
   ```ts
   await http({
     method: 'PATCH',
     url: `https://api.github.com/repos/${o}/${r}/releases/${releaseId}`,
     headers,
     body: { prerelease: true, make_latest: 'false' },
   })
   ```
3. **Delete the release.** The tag remains — `DELETE /releases/{id}`. Doesn't undo any package-manager publishes.
4. **Delete the tag too.** `git push --delete origin v1.3.0`. **Don't do this** if anyone may have already pulled it — git tags are supposed to be immutable.

For npm specifically, `npm deprecate <name>@1.3.0 "broken, use 1.3.1"` is the polite move. Unpublishing within 72h is allowed but reserved for clear emergencies.

**Don't auto-rollback.** Always involve the user — releases have downstream blast radius the agent can't see.

---

## Don't

- Don't release from a dirty working tree.
- Don't release while CI is failing or still running.
- Don't reuse a version number — they're supposed to be immutable, and many package managers will reject.
- Don't auto-pick the SemVer bump. Show the user a summary of the changes and the proposed bump, then wait.
- Don't fire the `npm publish` / `pypi-publish` step yourself from `exec` — wire it as a `release: published` workflow so it runs in CI with proper secrets.
- Don't delete a tag once anyone has pulled it. Cut a fix release instead.
- Don't include "Co-Authored-By: <bot>" in the release commit unless the user wants that signature in their git log.
- Don't make 8 releases in a day "to get the notes right" — use `draft: true` and edit until ready.
