---
name: docs
description: Write and maintain a project's documentation site the way our VitePress sites are built — multilingual trees kept in parity, pages that open with the point, every claim carrying an honest status, nothing invented, and post-build checks for parity, dead anchors and orphan pages that a green build does not catch. Use when adding or updating docs pages or a docs section, setting up a new VitePress docs site, translating docs, writing an architecture decision record or a roadmap/state page, or verifying docs before reporting them done.
---

# Docs: writing documentation that stays true

This skill is the brief for documentation work in any project. Hand it a **topic**
and a **reader**; everything else stays the same:

> "Follow the docs skill. Topic: _<topic>_. Reader: _<who reads it>_."

It was distilled from four VitePress sites (a platform, a security product, a site
builder, a store agent) — what they share, what worked, and what broke. Stack details
and config patterns: [references/vitepress-setup.md](references/vitepress-setup.md).
Page templates: [references/page-patterns.md](references/page-patterns.md).
Publishing: [references/deployment.md](references/deployment.md).
The checker: [scripts/check-docs.mjs](scripts/check-docs.mjs).

---

## Quick reference

| Need | Answer |
|---|---|
| Generator | VitePress 1.6.x, Bun, a `docs/` folder with its own lockfile |
| Languages | English at the root, translations as mirrored trees (`ru/`, `uk/`, …) |
| Nav and sidebar | generated for every locale from **one** structure + a label table |
| First line of a page | one bold sentence with the most useful point |
| Every claim | carries a status: verified / implemented / accepted / proposal / historical |
| Before "done" | `bun run build`, then `node scripts/check-docs.mjs`, then open the site |
| Never | invent numbers, features, customers, screenshots; edit the build output |
| Project specifics | a short `DOCS.md` brief in the repo: stack facts, ports, output dir, deploy |

---

## 1. Before you write a word

**Find out what is already true.** The fastest way to waste a day is to document a
system you assumed.

- Read the code that implements the topic. Use the repo's code search (graft,
  an MCP server, grep) before writing, and the architecture authority the project
  names (an MCP server, a constitution, `CLAUDE.md`) when sources disagree. If the
  code contradicts the authority, the code is what is wrong — say so on the page
  instead of documenting the mistake as a rule.
- If the work comes from a ticket, read its **comments**: scope gets rewritten there.
- **Ask for the topic's boundary** if it is not obvious. "Document billing" can mean
  three different weeks of work.
- **Make a small map before editing**: page, purpose, locale, the page that will
  link to it, its status. A new URL with no incoming link is a page nobody finds.
- Read the project's own `DOCS.md` (repository facts: ports, output directory,
  deployment, authoritative language). **Check those facts against the repo** — a
  brief's "facts" section goes stale silently, and one of our sites still claimed
  "nothing is published" after it was published.

---

## 2. Give every claim its status

| Status | What justifies it | How to say it |
|---|---|---|
| Verified | a check you can name, in a named environment | "Verified on staging on <date>…" — only where checked |
| Implemented, not verified end to end | the code exists | "Implemented; the full flow has not been verified." |
| Accepted direction | an explicit decision | "The agreed design is…" + what still needs building |
| Proposal / hypothesis | awaiting a decision or validation | "Proposed…" + what is undecided |
| Historical | an old decision or behaviour | a notice at the top linking to its replacement |

- **Status must survive a skim.** Put it before or beside the first promise — a dated
  status blockquote at the top works: `> **Accepted · 1 October 2026.** …`. Mixed
  pages label each section; do not repeat a disclaimer after every sentence.
- An approved idea is not a shipped feature. A Done ticket, a merged PR, an existing
  page or a green build is evidence, not proof of a working production flow.
- **Resist the present tense** for anything not shipped. "The gateway supports S3"
  is a lie until it ships; "The gateway will support S3 (planned)" is not.

## 3. Never invent

- **No numbers you did not measure** — no benchmarks, "up to 10x", percentages from
  feel. A figure on the page comes from a run you can name, with its date.
- **No features that do not exist.** Planned things say so in the same sentence.
- **No invented examples presented as real** — no fake customers, screenshots,
  prices, guarantees, credentials or deployments. Illustrations are labelled and use
  reserved domains (`example.com`). Sample output must be output the system would
  really produce.
- **Missing proof is a finding.** Say what was inspected and what remains unknown.
  An honest empty space beats plausible filler.
- **Changeable third-party facts** (vendor limits, API behaviour) are verified against
  current primary documentation and linked next to the claim.
- AI-generated images: keep the prompt and provenance next to the asset.

If you are writing a sentence you cannot check: stop, verify, and if it cannot be
verified, write down that it could not.

---

## 4. How a page reads

1. **H1**, then **one bold sentence with the most useful point.** Not a definition,
   not a contents list. A reader who stops after one line still learned something.
2. **The one big idea, as a blockquote.** Most topics have exactly one; everything
   else on the page visibly follows from it.
3. **What a person would see or suffer, not which module changed:**
   > ✅ "The chat forgot where you were reading every time an answer arrived."
   > ❌ "The scroll anchor was not preserved on prepend in `View.vue`."

   Class names, file paths, DTO fields and test counts belong on a reference page,
   if anywhere.
4. **Tables** for comparisons and settings; **text-fenced diagrams** or a small
   component for flows; `::: info` / `::: warning` sparingly — one callout that
   matters beats five that decorate.
5. **Cross-link instead of repeating.** A fact stated twice becomes two facts that
   disagree within a month. End with "Read more" links.
6. **Superseded content says so at the top**, with a link to the replacement. A stale
   page left silent is worse than a deleted one. (A `historical: true` frontmatter
   flag rendered by the layout makes this uniform — see the setup reference.)
7. **Date state pages.** A roadmap or "current state" page names the day or commit it
   was measured at.

Sections are folders. `decisions/` holds decision records (why); a section page
explains what. Don't restructure working sections to fit a new topic — add to the
structure and argue for changing it separately.

---

## 5. Languages: every page is N pages

**Nothing in VitePress keeps translations in step.** A page added to the root and
forgotten in `ru/` builds with no warning and leaves a hole in that language. It
has happened on every multilingual site we run, and one site's "English" root turned
out to be mostly untranslated Russian copies.

- **Decide the authoritative language** and write it down; a correction lands there
  first, then in every translation, in the same change.
- Every page exists in every tree, or the gap is stated on the page and in the report.
- Configure real `locales` in VitePress (not just a language dropdown), so each tree
  gets its own `<html lang>`, sidebar and UI strings.
- Generate nav and sidebar for all locales from one structure plus a label table; a
  missing label falls back visibly instead of a missing entry.
- **Translated headings produce different anchor slugs.** For deep links and a
  language switcher that keeps the reading position, give headings explicit IDs
  identical in every tree: `## Вход {#sign-in}`.
- Component strings live in per-locale dictionaries with the same keys and
  placeholders.

---

## 6. Before you say it is done

A green build proves the pages compiled. It does not prove the site works:

```bash
cd docs && bun run build
node <path-to-this-skill>/scripts/check-docs.mjs \
  --locales uk,ru [--dist .vitepress/dist] [--dictionaries .vitepress/locales] [--strict-anchors]
```

The checker fails on:

| Check | Why a build doesn't catch it |
|---|---|
| Page parity across locales | nothing compares the trees |
| Built HTML + `<html lang>` per locale | a misconfigured locale still builds |
| Broken links **and `#anchors`** | VitePress checks pages, never fragments |
| **Orphan pages** — nothing links to them | a page missing from the sidebar builds fine and is unreachable |
| UI dictionary keys/placeholders (`--dictionaries`) | missing keys render raw or empty |
| Identical heading IDs across locales (`--strict-anchors`) | the switcher silently drops the position |

It proves it can fail (a planted missing page and anchor) before trusting its
result. Allow intentional exceptions explicitly: `--allow-orphan /landing.html`.
Run it in CI or the project's verify step.

Then, by hand:

- **Open the site** (`bun run dev`): click the nav, the sidebar, the cross-links,
  the language switcher — in every locale you touched, desktop and mobile.
- **A check you write must go red first.** Break the page, confirm the check fails,
  restore. Heading or word counters pass on pages that say nothing.
- **Don't grep internal names to find gaps.** Docs name things in human words;
  searching for class names invents gaps that are already written.
- **HTTP 200 is not proof** on a host that falls back to the home page for missing
  routes. Check the content, not the status code.

---

## 7. What not to do

- Walls of prose before the first useful sentence; "in this article we will".
- Intentions documented as behaviour.
- A link to something that does not exist yet, or a page nothing links to.
- Credentials, tokens or internal URLs in a page — reference variables by name.
- Editing the build output (`dist`) instead of the source.
- Copying a sibling project's deployment table or facts without checking them here.

## 8. What to hand back

1. The pages, built and opened.
2. Sections and pages added per locale, sidebar entries added, the checker's summary
   line.
3. What you could not verify, and why — pages left alone, locales skipped, claims
   taken on trust from an existing page.
4. Contradictions with existing docs, with both locations, so a person can decide
   which is wrong.
