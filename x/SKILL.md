---
name: x
description: X (formerly Twitter) automation via a logged-in browser session — post, reply, read timelines, DMs. Works with personal and business accounts.
---

# X (Twitter)

Same mechanics as [[instagram]] — load that skill first for the login flow and `browser_play` patterns.

---

## Quick Reference

| Need | Answer |
|------|--------|
| Tool | `browser_play` |
| Profile | `x:<accountKey>` — **discover it, never guess** (see below) |
| Login URL | `https://x.com/i/flow/login` |
| API alternative | x.com paid API is an option — pick `secret` mechanism if you have a key |

---

## Step 0 — discover the profile, then just try it

Two rules, in order:

**1. Never guess the profile.** Call `integration_list`, take the exact
`profile` field. Never use `"default"`, `"x"`, or a handle you assumed.

**2. Always try `browser_play` first. Do NOT gate on `status`.**

```ts
const { accounts } = await integration_list()
const x = accounts.find(a => a.service === "x")
if (!x) {
  // user hasn't connected X at all — tell them to open /integrations, stop
  return
}
// Use x.profile verbatim. Go STRAIGHT to browser_play — do not look at
// x.status. The status field is advisory and frequently stale (it can
// say "needs_login" while the cookies are perfectly valid). The ONLY
// trustworthy login signal is browser_play's own response.
const result = await browser_play({ profile: x.profile, actions: [...] })

if (result.needsLogin) {
  // NOW — and only now — the session is genuinely dead. Call
  // integration_request_login, forward the instructions, then STOP.
  const help = await integration_request_login({
    service: x.service, accountKey: x.accountKey,
  })
  await ctx.send(help.instructions)
  return
}
// result.ok → use it.
```

> ⚠️ Do NOT call `integration_request_login` just because
> `integration_list` returned `status: "needs_login"` or `"pending"`.
> That status is not a reliable gate. Run `browser_play` and let its
> `needsLogin` field decide. Skipping `browser_play` because of a stale
> status is the #1 reason posts silently never happen.

Every recipe below writes `x:dimzhuk` as a placeholder — substitute the
real `profile` from `integration_list`.

---

## Common actions

### Post a tweet

**Verified working recipe** (last tested 2026-05-20). Critical details:

- **One `browser_play` call, all actions in it.** Never split posting
  across multiple calls — and never retry the whole thing in a loop. If
  it returns `ok:false`, report the error; don't fire it again.
- **Navigate to `/compose/post` directly** — opens the composer in a
  modal `[role="dialog"]`. The sidebar New-Tweet button is fragile.
- **Scope every selector to `[role="dialog"]`** — the page has TWO
  `tweetTextarea_0` (sidebar mini-composer + modal). Unscoped selectors
  hit the invisible sidebar one.
- **Submit by clicking `[role="dialog"] [data-testid="tweetButton"]`**,
  and `waitForSelector` that button BEFORE clicking it. Clicking blind
  (before the button renders) is what causes `click: Timeout 10000ms`.
  `Meta+Enter` on the textarea is a fallback if the click doesn't post.
- **Pace it for slow environments** — `wait 6000` after navigate,
  `timeout 30000` on the textarea selector, `wait 4000` after `fill`
  (X's React enables the button a beat after the text lands).
- **Stay under 280 characters** on non-Premium accounts.
- **Always verify** — navigate to `/<handle>`, read the top tweet, check
  its text matches. "The modal closed" is NOT proof; it closes on
  cancel and on rejection too.

```ts
await browser_play({
  profile: 'x:my-handle',
  actions: [
    { kind: 'navigate', url: 'https://x.com/compose/post' },
    { kind: 'wait', ms: 6000 },
    { kind: 'waitForSelector', selector: '[role="dialog"] [data-testid="tweetTextarea_0"]', timeout: 30000 },
    { kind: 'click', selector: '[role="dialog"] [data-testid="tweetTextarea_0"]' },
    { kind: 'fill', selector: '[role="dialog"] [data-testid="tweetTextarea_0"]', value: text },
    { kind: 'wait', ms: 4000 },
    // Wait for the submit button to actually render before clicking it —
    // blind clicks time out at 10s because the element isn't there yet.
    { kind: 'waitForSelector', selector: '[role="dialog"] [data-testid="tweetButton"]', timeout: 15000 },
    { kind: 'click', selector: '[role="dialog"] [data-testid="tweetButton"]' },
    { kind: 'wait', ms: 7000 },
    // Verify by navigating to the user's own profile and reading the top
    // tweet — modal closes on cancel too, so URL/dialog state alone lies.
    { kind: 'navigate', url: 'https://x.com/my-handle' },
    { kind: 'waitForSelector', selector: '[data-testid="tweet"]', timeout: 30000 },
    { kind: 'wait', ms: 3000 },
    {
      kind: 'evaluate',
      code: `
        const top = document.querySelector('[data-testid="tweet"]');
        const link = top?.querySelector('a[href*="/status/"]')?.getAttribute('href');
        return {
          posted: top?.querySelector('[data-testid="tweetText"]')?.innerText?.includes(${JSON.stringify(text)}),
          url: link ? 'https://x.com' + link : null,
          text: top?.querySelector('[data-testid="tweetText"]')?.innerText,
        };
      `,
    },
  ],
})
```

### Read a user's timeline

```ts
await browser_play({
  profile: 'x:my-handle',
  actions: [
    { kind: 'navigate', url: `https://x.com/<handle>` },
    { kind: 'waitForSelector', selector: '[data-testid="tweet"]', timeout: 10000 },
    {
      kind: 'evaluate',
      code: `
        const tweets = []
        document.querySelectorAll('[data-testid="tweet"]').forEach((t, i) => {
          if (i >= 20) return
          tweets.push({
            text: t.querySelector('[data-testid="tweetText"]')?.innerText ?? '',
            time: t.querySelector('time')?.getAttribute('datetime'),
            stats: t.innerText.slice(-200),
          })
        })
        return tweets
      `,
    },
  ],
})
```

### Reply

Same dialog-scoping + Cmd+Enter pattern as posting. Reply opens an inline modal too.

```ts
await browser_play({
  profile: 'x:my-handle',
  actions: [
    { kind: 'navigate', url: `https://x.com/${authorHandle}/status/${tweetId}` },
    { kind: 'click', selector: '[data-testid="reply"]' },
    { kind: 'waitForSelector', selector: '[role="dialog"] [data-testid="tweetTextarea_0"]', timeout: 10000 },
    { kind: 'fill', selector: '[role="dialog"] [data-testid="tweetTextarea_0"]', value: reply },
    { kind: 'wait', ms: 1500 },
    { kind: 'press', selector: '[role="dialog"] [data-testid="tweetTextarea_0"]', key: 'Meta+Enter' },
    { kind: 'wait', ms: 4000 },
  ],
})
```

---

## Anti-foot-guns

These were learned the hard way — keep them in mind when adapting the recipes.

1. **Don't claim success from a closed dialog.** The composer modal also closes on cancel, on validation failure, and on rate-limit rejection. The only reliable proof is reading the top tweet on `/<your-handle>` and confirming its text matches.

2. **There are TWO `tweetTextarea_0` on most pages.** One in the left sidebar mini-composer, one in the modal. Playwright `.click()` without `[role="dialog"]` scoping hits the (invisible) sidebar one and reports "selector not visible".

3. **`fill` ≠ user typing.** X's React app updates the tweet-button's disabled state in response to internal events. After `fill`, give it ~1.5s before `press`/`click`. Otherwise the button may still be disabled and the keyboard handler ignores Enter.

4. **`Meta+Enter` only works when the textarea is focused.** Make sure `fill` succeeded (or pre-click the textarea) before pressing. The runtime's `press` action targets the selector implicitly — pass the textarea selector, not `body`.

5. **Selectors rot.** X changes data-testids occasionally. Before trusting a recipe, run a "dry probe" first: `navigate` + `evaluate` returning `document.querySelector('[role="dialog"] [data-testid="…"]')?.getAttribute('data-testid')` and a few sibling testids. Update the recipe if names changed.

---

## Don't

- Don't burst-post — X applies hourly write limits per account (50 posts/hour for free, ~300 for paid Premium).
- Don't rely on `nitter` mirrors as a fallback — they're rate-limited or down most of the time.
- Don't trust the LLM's "пост опубликован" narration without a post-flight verification step that reads the top tweet on `/<your-handle>`.
- Don't try to fill the X login form with username/password — when cookies are stale, call `integration_request_login({ service: 'x', accountKey: '<accountKey>' })` and forward the returned instructions to the user.
- Don't reference `browser_login` / VNC anywhere — those tools were removed. The login path is `integration_request_login` → user pushes cookies via the Ranch extension.
- Don't guess the profile. Always `integration_list` first and use the returned `profile` verbatim. Guessing `x:default` is the #1 cause of false "needs login" failures.
