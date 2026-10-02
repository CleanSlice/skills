# Page patterns

Templates that worked. Replace everything in `<angle brackets>`; keep the shape.

## An explanation page

````markdown
---
title: <Short title>
description: <One sentence for search results and link previews>
---

# <Title>

**<The single most useful thing about this topic, in one sentence.>**

> <The one big idea. Everything below follows from it.>

## <What a reader sees or does>

<Plain language: what happens, what the person notices, what they control.>

## <How it works>

<Only as deep as this reader needs. Tables for comparisons, a text-fenced diagram
for a flow.>

```text
customer ──► <step> ──► <step> ──► answer
```

## Limits

<What it does not do yet — each item with its status (planned / proposed).>

## Read more

- [<Related page>](/<section>/<page>)
````

## A status opening (proposal, accepted, published)

```markdown
# <Title>

> **Proposal · 28 September 2026.** Not yet approved or implemented. <What is
> undecided.> No <customer/merchant/user> has been <connected/interviewed>.

**<The point of the proposal in one sentence.>**
```

Variants that read well:

- `> **Accepted · 1 October 2026.** … This supersedes [<earlier decision>](...).`
- `> **Proposed plan, not a committed schedule.**`
- `> **Published · checked on 1 October 2026.** <what was checked, where>`
- `> **Historical:** <what replaced it>, see [<replacement>](...).` — at the very top.

## A decision record (`decisions/NNN-<slug>.md`)

```markdown
# NNN. <Decision in a few words>

> **<Accepted | Proposed | Superseded by NNN> · <date>.**

**<The decision in one sentence.>**

## Context
<What forced a choice. Facts with sources, dated.>

## Decision
<What we do — and the boundary: what this does NOT decide.>

## Consequences
<What gets easier, what gets harder, what we now owe.>

## Alternatives considered
| Option | Why not |
|---|---|

## Sources
- <primary docs, tickets, measurements — linked>
```

Update the decision record **first** when a decision changes; pages that describe the
consequence follow.

## A state / roadmap page

```markdown
# <Roadmap | Current state>

Measured on <date> at `<commit>`. These are capability states, not release versions
or a deployment certification.

| Area | State | Evidence / remaining work |
|---|---|---|
| <area> | Implemented / Partial / Planned | <tickets, specs, what is missing> |

<Who decides scope and dates. "No owner or deadline is invented here.">
```

## Writing rules, compressed

| Instead of | Write |
|---|---|
| "The scroll anchor was not preserved on prepend" | "The chat forgot where you were reading every time an answer arrived" |
| "Supports S3" (not shipped) | "Stores files on local disk; S3 is planned" |
| "Up to 10x faster" | "<measured number> on <date>, <setup>" — or nothing |
| "In this article we will…" | the point, in bold, first |
| repeating a fact from another page | a link to that page |
| a fake customer quote | an empty, labelled space |

Status words to use consistently: **verified**, **implemented (not verified end to
end)**, **accepted**, **proposed**, **historical**, **planned**.
