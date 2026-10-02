# Facebook / Meta Ads

Platform specifics. The session, login and verification rules are in [../SKILL.md](../SKILL.md).

| Need | Answer |
|------|--------|
| Profile | `facebook:<label>` (e.g. `facebook:main`, `facebook:client-acme`) |
| Login URL | `https://www.facebook.com/login/` |
| Meta link | One profile covers Facebook AND a linked Instagram when SSO is enabled |
| Ads Manager | `https://adsmanager.facebook.com/` — same cookies |

---

## Common actions

### Read inbox messages

```ts
await browser_play({
  profile: 'facebook:main',
  actions: [
    { kind: 'navigate', url: 'https://www.facebook.com/messages/t/' },
    { kind: 'waitForSelector', selector: '[role="grid"]', timeout: 10000 },
    { kind: 'getText', selector: '[role="grid"]' },
  ],
})
```

### Open Ads Manager for a campaign

```ts
await browser_play({
  profile: 'facebook:main',
  actions: [
    { kind: 'navigate', url: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${adAccountId}` },
    { kind: 'waitForSelector', selector: '[role="grid"]', timeout: 15000 },
    {
      kind: 'evaluate',
      code: `
        const rows = []
        document.querySelectorAll('[role="row"]').forEach((r, i) => {
          if (i === 0 || i > 20) return
          rows.push(r.innerText)
        })
        return rows
      `,
    },
  ],
})
```

### Post on a page

```ts
await browser_play({
  profile: 'facebook:main',
  actions: [
    { kind: 'navigate', url: `https://www.facebook.com/${pageId}` },
    { kind: 'waitForSelector', selector: '[role="button"][aria-label*="Create"]', timeout: 10000 },
    { kind: 'click', selector: '[role="button"][aria-label*="Create"]' },
    { kind: 'fill', selector: '[contenteditable="true"]', value: post },
    { kind: 'click', selector: '[role="button"][aria-label="Post"]' },
  ],
})
```

---

## Account-key conventions

- `facebook:main` — primary personal account
- `facebook:<client-slug>` — shared/agency accounts (one per client)
- `facebook:ads-<account-id>` — pinned to a specific Business Manager when the agent only needs that scope

Multiple accountKeys per user are isolated profiles — cookies don't bleed across them.

---

## Don't

- Don't mix personal and Business Manager logins in one profile — Meta sometimes prompts for re-auth when the active account switches.
- Don't use the Graph API directly for things you can do in the browser — Meta routinely revokes app permissions.
