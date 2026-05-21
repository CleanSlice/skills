---
name: instagram
description: Instagram automation through a logged-in browser session — read profiles, post content, send DMs, scrape feeds. Use whenever the agent needs to interact with Instagram on behalf of a user.
---

# Instagram

Instagram doesn't have an official API for what most agents need (reading feeds, posting from personal accounts, DMs). The ranch platform solves this by driving a logged-in Chromium session from the browser-pool, with cookies kept on a persistent volume across pod restarts.

---

## Quick Reference

| Need | Answer |
|------|--------|
| Tool | `browser_play` |
| Profile | `instagram:<handle>` (e.g. `instagram:miybot`) |
| Login flow | User pushes cookies via the Ranch Cookies extension (no VNC) |
| Cookies persist | Yes — across pod restarts and reset commands |
| Fingerprint | Stealth plugin handles `navigator.webdriver` etc. |
| Logged-out detection | `browser_play` returns `{ needsLogin, hint }` |

---

## Step 0 — discover the profile (do this first)

Never guess the `browser_play` profile. Call `integration_list` and use
the exact `profile` it returns for the Instagram account:

```ts
const { accounts } = await integration_list()
const ig = accounts.find(a => a.service === "instagram")
// ig.profile is e.g. "instagram:miybot" — use it verbatim
```

If there's no Instagram account, the user hasn't connected one — tell
them to open `/integrations`. If `status` isn't `connected`, run the
login flow below.

---

## Connecting an account (no VNC — extension-driven)

The user logs in to Instagram **in their own Chrome** and pushes cookies
to Ranch via the Ranch Cookies extension. Ranch never opens an embedded
browser or VNC view.

First-time setup:

1. User opens `/integrations` in admin → clicks **Instagram** → enters
   handle (e.g. `miybot`) → **Continue**.
2. User opens `https://instagram.com/` in their normal Chrome and logs
   in (handles 2FA, verification challenges, etc. — same as any
   regular browser session).
3. User clicks the **Ranch Cookies** extension icon → it auto-detects
   "instagram" → **Send cookies**.
4. The integration row flips to `connected` automatically. The agent
   can now call `browser_play(profile: "instagram:miybot", …)`.

If the agent tries `browser_play` before this, it gets
`{ needsLogin: true }`. **Do NOT try to do the login yourself** —
instead, ask Ranch for instructions and forward them to the user (see
next section).

---

## Login recovery (cookies expired)

Instagram drops sessions periodically. When `browser_play` returns
`needsLogin: true`, follow this exact flow:

```ts
// 1) Ask Ranch for the help URL + textual instructions
const help = await integration_request_login({
  service: 'instagram',
  accountKey: 'miybot',
})
// → { helpUrl, siteUrl, instructions }

// 2) Forward the instructions verbatim via the active channel
await ctx.send(help.instructions)
// (`help.helpUrl` is a clickable admin page that walks them through it.
//  `help.siteUrl` opens Instagram directly. Both are inside `instructions`.)

// 3) STOP. Wait for the user to confirm they pushed cookies. Do NOT
//    retry browser_play in a tight loop — give them time to log in.
//    On Telegram: wait for any user message. In admin chat: poll the
//    integration status until it flips to "connected".

// 4) When the user confirms, retry the original browser_play call
//    as-is. The runtime's fallback will pick up the freshly-pushed
//    cookies on the next attempt.
```

Never tell the user to "log in" without giving them the help link.
Never try to handle the login yourself by filling username/password
fields — Instagram detects this immediately and locks the account.

---

## Common actions

> **Reading content — the reliable way.** Instagram's rendered DOM uses
> obfuscated, rotating class names — `getText`/`click` on guessed
> selectors **time out** (the #1 failure mode). Read from two stable
> sources instead:
>
> 1. **`<meta property="og:*">` tags** — present in the static `<head>`
>    of every profile and post page, *before* React renders. Selectors
>    never rot.
> 2. **`screenshot`** — the tool screenshots and runs vision
>    automatically; use it as the fallback / cross-check.
>
> Never build a read on `waitForSelector` + `getText`.

### Read an account's latest post

One `browser_play` call: open the profile, jump to the newest post's
permalink, read the caption from `og:description`. The grid is
newest-first, so the first `/p/` or `/reel/` link is the latest post.

```ts
const result = await browser_play({
  profile: ig.profile,                 // from integration_list — never guess
  actions: [
    { kind: 'navigate', url: `https://www.instagram.com/${handle}/` },
    { kind: 'wait', ms: 5000 },
    // Find the newest post, navigate to its permalink. setTimeout defers
    // the nav so evaluate's return value marshals cleanly first —
    // assigning location.href mid-evaluate destroys the JS context.
    { kind: 'evaluate', code: `
        const a = document.querySelector('a[href*="/p/"], a[href*="/reel/"]');
        if (a) setTimeout(() => { location.href = a.href; }, 150);
        return a ? a.href : 'NO_POSTS';
      ` },
    { kind: 'wait', ms: 5000 },
    // Caption lives in og:description / og:title — static <head>, no
    // rotating selectors. h1 holds the rendered caption when React was
    // fast enough.
    { kind: 'evaluate', code: `
        const meta = p => document.querySelector('meta[property="'+p+'"]')?.content || null;
        return {
          url: location.href,
          ogTitle: meta('og:title'),
          ogDescription: meta('og:description'),
          caption: document.querySelector('h1')?.innerText || null,
        };
      ` },
    { kind: 'screenshot', fullPage: false },
  ],
})
```

`og:description` reads like `"42 likes, 3 comments - handle on May 18,
2026: \"<caption>\""` — the caption is the quoted tail (truncated for
long posts). `caption` (the `h1`) has the full text when React rendered
in time; the `screenshot` vision description is the final fallback.
Report whichever field is non-empty.

### Read a profile (bio, counts)

```ts
await browser_play({
  profile: ig.profile,
  actions: [
    { kind: 'navigate', url: `https://www.instagram.com/${handle}/` },
    { kind: 'wait', ms: 4000 },
    { kind: 'evaluate', code: `
        const meta = p => document.querySelector('meta[property="'+p+'"]')?.content || null;
        return { ogTitle: meta('og:title'), ogDescription: meta('og:description') };
      ` },
    { kind: 'screenshot', fullPage: false },
  ],
})
```

### Read the user's own home feed

The home feed is the heaviest page on Instagram — give it a long wait.

```ts
await browser_play({
  profile: ig.profile,
  actions: [
    { kind: 'navigate', url: 'https://www.instagram.com/' },
    { kind: 'wait', ms: 8000 },
    { kind: 'evaluate', code: `
        return [...document.querySelectorAll('article')].slice(0, 10).map(a => ({
          text: a.innerText.slice(0, 500),
          href: a.querySelector('a[href*="/p/"]')?.getAttribute('href') ?? null,
        }));
      ` },
  ],
})
```

### If browser_play crashes or stalls

Instagram intermittently crashes or hangs headless Chromium —
`browser_play` returns `browser has been closed` or hits its 100s hard
deadline. **Retry the same call ONCE.** A single retry usually succeeds;
do not loop beyond that — report the failure to the user instead.

### Send a DM

```ts
await browser_play({
  profile: 'instagram:miybot',
  actions: [
    { kind: 'navigate', url: 'https://instagram.com/direct/t/<thread-id>/' },
    { kind: 'waitForSelector', selector: '[contenteditable="true"]', timeout: 10000 },
    { kind: 'fill', selector: '[contenteditable="true"]', value: 'Hello!' },
    { kind: 'press', selector: '[contenteditable="true"]', key: 'Enter' },
  ],
})
```

### Read tokens for raw GraphQL

When the agent needs to make many parallel requests, browser_play with evaluate can extract `fb_dtsg`, `lsd`, and cookies from the live session:

```ts
await browser_play({
  profile: 'instagram:miybot',
  actions: [
    { kind: 'navigate', url: 'https://instagram.com/' },
    {
      kind: 'evaluate',
      code: `
        const html = document.documentElement.outerHTML
        const dtsg = html.match(/"DTSGInitialData",\\[\\],\\{"token":"([^"]+)"/)?.[1]
        const lsd  = html.match(/"LSD",\\[\\],\\{"token":"([^"]+)"/)?.[1]
        const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1]
        return { dtsg, lsd, csrf, userAgent: navigator.userAgent }
      `,
    },
  ],
})
```

Then the agent can hand these to its HTTP layer for high-volume scraping — see `references/raw-graphql.md` if the workload needs it (most don't).

---

## Anti-detection notes

- The pool already runs `puppeteer-extra-plugin-stealth`. You don't need to disable headless mode or do anything special — the user-agent is replayed exactly as it was when cookies were captured.
- Avoid rapid bursts (>1 navigate/second). Instagram's rate limits are aggressive on `/api/v1/*` paths.
- Never log in via raw HTTP. The login flow must run inside the pool browser via the VNC URL, otherwise the device-bound 2FA challenges won't validate.

---

## Don't

- Don't fill the Instagram login form yourself. Always hand off to the user via `integration_request_login`. IG detects scripted logins fast.
- Don't store session cookies anywhere outside Ranch's per-user vault — `agent/secret` is the wrong place for them.
- Don't retry `browser_play` automatically after `needsLogin` — call `integration_request_login`, forward instructions, then wait for the user's confirmation.
- Don't reference `browser_login` / `browser_login_done` / VNC / "live browser" anywhere in your responses. Those tools no longer exist in this runtime. Use `integration_request_login` instead.
