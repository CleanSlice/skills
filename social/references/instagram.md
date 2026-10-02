# Instagram

Platform specifics. The session, login and verification rules are in [../SKILL.md](../SKILL.md).

| Need | Answer |
|------|--------|
| Profile | `instagram:<handle>` (e.g. `instagram:miybot`) |
| Login URL | `https://instagram.com/` |
| Meta link | Cookies are shared with Facebook when the accounts are linked by SSO |
| Rate limits | Aggressive on `/api/v1/*` — keep under ~1 navigate/second |

---

## Common actions

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

Then the agent can hand these to its HTTP layer for high-volume scraping. Most workloads don't need it — one `browser_play` call per read is cheaper to keep working than a signed GraphQL client.
