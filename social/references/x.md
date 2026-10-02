# X (Twitter)

Platform specifics. The session, login and verification rules are in [../SKILL.md](../SKILL.md).

| Need | Answer |
|------|--------|
| Profile | `x:<accountKey>` |
| Login URL | `https://x.com/i/flow/login` |
| Write limits | ~50 posts/hour free, ~300 on Premium |
| API alternative | x.com's paid API exists — use the `secret` mechanism if you have a key |

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

- Don't burst-post — X applies hourly write limits per account (50 posts/hour free, ~300 on Premium).
- Don't rely on `nitter` mirrors as a fallback — they are rate-limited or down most of the time.
