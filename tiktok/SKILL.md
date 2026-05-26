---
name: tiktok
description: TikTok automation via a logged-in browser session — read trending content, post videos, pull analytics, scrape profiles.
---

# TikTok

Same mechanics as [[instagram]] — load that skill first for the login flow and `browser_play` basics.

---

## Quick Reference

| Need | Answer |
|------|--------|
| Tool | `browser_play` |
| Profile | `tiktok:<handle>` |
| Login URL | `https://www.tiktok.com/login` |
| Anti-bot | TikTok is the most aggressive of the social networks — keep navigation slow |

---

## Common actions

### Read trending feed

```ts
await browser_play({
  profile: 'tiktok:my-handle',
  actions: [
    { kind: 'navigate', url: 'https://www.tiktok.com/foryou' },
    { kind: 'waitForSelector', selector: '[data-e2e="recommend-list-item-container"]', timeout: 15000 },
    {
      kind: 'evaluate',
      code: `
        const items = []
        document.querySelectorAll('[data-e2e="recommend-list-item-container"]').forEach((el, i) => {
          if (i >= 10) return
          items.push({
            text: el.innerText.slice(0, 300),
            href: el.querySelector('a[href*="/video/"]')?.getAttribute('href') ?? null,
          })
        })
        return items
      `,
    },
  ],
})
```

### Read profile stats

```ts
await browser_play({
  profile: 'tiktok:my-handle',
  actions: [
    { kind: 'navigate', url: 'https://www.tiktok.com/@<target>' },
    { kind: 'waitForSelector', selector: '[data-e2e="user-subtitle"]', timeout: 10000 },
    {
      kind: 'evaluate',
      code: `
        return {
          followers: document.querySelector('[data-e2e="followers-count"]')?.innerText,
          following: document.querySelector('[data-e2e="following-count"]')?.innerText,
          likes: document.querySelector('[data-e2e="likes-count"]')?.innerText,
          bio: document.querySelector('[data-e2e="user-bio"]')?.innerText,
        }
      `,
    },
  ],
})
```

---

## Anti-detection notes

- TikTok's web bot detection is the strictest of the social networks. Always wait 2–5s between actions; never script tight loops.
- The mobile API (api16-normal-c-useast1a.tiktokv.com) requires a different cookie set — stick to the web flow.
- TikTok rotates `secUid` and `verifyFp` cookies often. The stealth plugin handles the obvious checks, but unusual nav patterns (e.g. 100 profile loads / minute) still trip rate limits.

---

## Don't

- Don't try the desktop TikTok app's protocol — it requires reverse-engineered signing and breaks every few weeks.
- Don't post videos with `evaluate` + `dispatchEvent` — TikTok validates the upload flow against real user gestures. Use real `click`/`fill` actions.
