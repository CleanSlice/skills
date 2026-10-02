---
name: social
description: Social platform automation through a logged-in browser session — Instagram, X (Twitter), TikTok, Facebook/Meta Ads. Read profiles and feeds, post, reply, send DMs, pull analytics, run ad campaigns. Use whenever an agent acts on a social account on behalf of a user.
---

# Social platforms

None of these platforms has an official API for what agents actually need — reading feeds, posting from a personal account, DMs. Ranch solves it the same way for all four: a logged-in Chromium session from the browser pool, cookies kept on a persistent volume across pod restarts, driven by `browser_play`.

The mechanism below is identical on every platform. Only selectors, URLs and rate limits differ — those live in the per-platform references.

| Platform | Reference | Profile | What it is good at |
|----------|-----------|---------|--------------------|
| Instagram | [references/instagram.md](references/instagram.md) | `instagram:<handle>` | profiles, posts, home feed, DMs, GraphQL tokens |
| X (Twitter) | [references/x.md](references/x.md) | `x:<accountKey>` | posting, replies, timelines |
| TikTok | [references/tiktok.md](references/tiktok.md) | `tiktok:<handle>` | trending feed, profile stats |
| Facebook / Meta Ads | [references/facebook.md](references/facebook.md) | `facebook:<label>` | pages, inbox, Ads Manager |

Read this file, then the one reference for the platform you are touching.

---

## Quick Reference

| Need | Answer |
|------|--------|
| Tool | `browser_play` |
| Profile | `<service>:<accountKey>` — **discover it, never guess** |
| Discovery | `integration_list` → use the returned `profile` verbatim |
| Login | User pushes cookies via the Ranch Cookies extension (no VNC) |
| Cookies persist | Yes — across pod restarts and reset commands |
| Fingerprint | `puppeteer-extra-plugin-stealth` is already on |
| Logged-out signal | `browser_play` returns `{ needsLogin, hint }` |

---

## Step 0 — discover the profile, then just try it

Two rules, in order.

**1. Never guess the profile.** Call `integration_list` and take the exact `profile` field. Never `"default"`, never the service name, never a handle you assumed.

**2. Always try `browser_play` first. Do NOT gate on `status`.**

```ts
const { accounts } = await integration_list()
const account = accounts.find(a => a.service === 'x')   // or instagram / tiktok / facebook
if (!account) {
  // nothing connected — tell the user to open /integrations, then stop
  return
}
// Use account.profile verbatim. Go STRAIGHT to browser_play — do not look
// at account.status. That field is advisory and frequently stale (it can
// say "needs_login" while the cookies are perfectly valid). The ONLY
// trustworthy login signal is browser_play's own response.
const result = await browser_play({ profile: account.profile, actions: [...] })

if (result.needsLogin) {
  // NOW — and only now — the session is genuinely dead.
  const help = await integration_request_login({
    service: account.service,
    accountKey: account.accountKey,
  })
  await ctx.send(help.instructions)   // forward verbatim, then STOP
  return
}
```

> ⚠️ Do NOT call `integration_request_login` just because `integration_list` returned `status: "needs_login"` or `"pending"`. Skipping `browser_play` because of a stale status is the single biggest reason posts silently never happen.

Every recipe in the references writes a placeholder profile — substitute the real one from `integration_list`.

---

## Connecting an account (extension-driven, no VNC)

The user logs in **in their own Chrome** and pushes cookies to Ranch. Ranch never opens an embedded browser or a VNC view.

1. User opens `/integrations` in admin → clicks the platform → enters the handle / label → **Continue**.
2. User opens the platform in their normal Chrome and logs in — 2FA, device checks and verification challenges included, exactly as a human would.
3. User clicks the **Ranch Cookies** extension → it auto-detects the service → **Send cookies**.
4. The integration row flips to `connected`. `browser_play(profile: "<service>:<accountKey>", …)` works from then on.

Before that, `browser_play` returns `{ needsLogin: true }`. **Do not attempt the login yourself.**

---

## Login recovery (cookies expired)

Sessions drop periodically. When `browser_play` returns `needsLogin: true`:

```ts
// 1) Ask Ranch for the help URL + textual instructions
const help = await integration_request_login({ service: 'instagram', accountKey: 'miybot' })
// → { helpUrl, siteUrl, instructions }

// 2) Forward the instructions verbatim through the active channel
await ctx.send(help.instructions)

// 3) STOP. Wait for the user to confirm they pushed cookies. Do NOT retry
//    browser_play in a tight loop — give them time to log in. On Telegram:
//    wait for any user message. In admin chat: poll the integration status
//    until it flips to "connected".

// 4) On confirmation, retry the original browser_play call as-is. The
//    runtime picks up the freshly pushed cookies on the next attempt.
```

Never tell the user to "log in" without the help link. Never fill a username/password field yourself — every one of these platforms detects scripted logins and locks the account.

---

## Reading content — the reliable way

Rendered DOM on these sites uses obfuscated, rotating class names, and `getText`/`click` on guessed selectors **times out**. That is the number one failure mode. Read from stable sources instead:

1. **`<meta property="og:*">` tags** — present in the static `<head>` before React renders. Selectors never rot.
2. **`screenshot`** — the tool screenshots and runs vision automatically; use it as fallback and cross-check.
3. **Documented `data-testid` / `data-e2e` attributes** where a platform ships them (X, TikTok) — more stable than classes, still worth a dry probe first.

Never build a read on `waitForSelector` + `getText` against a guessed class.

## Writing content — verify, never assume

A closed composer modal is not proof. It closes on cancel, on validation failure and on rate-limit rejection too. Every write recipe ends by navigating to the account's own page, reading the top item, and comparing text. Report "posted" only when that read matches.

One `browser_play` call per operation, all actions inside it. If it returns `ok: false`, report the error — do not fire the whole thing again in a loop.

## When the browser crashes or stalls

These sites intermittently crash or hang headless Chromium: `browser_play` returns `browser has been closed`, or hits its 100 s hard deadline. **Retry the same call ONCE.** A single retry usually succeeds. Do not loop beyond that — report the failure.

---

## Anti-detection

- The pool runs the stealth plugin and replays the user-agent exactly as captured with the cookies. Nothing extra is needed from you.
- Pace navigation: no more than ~1 navigate/second, and 2–5 s between actions on TikTok. Tight loops trip rate limits on every platform.
- Never log in over raw HTTP. Device-bound 2FA challenges only validate in a real browser session.

---

## Don't

- Don't fill a login form yourself — hand off via `integration_request_login`.
- Don't guess the profile. `integration_list` first, use the value verbatim.
- Don't retry automatically after `needsLogin` — forward instructions and wait for the user.
- Don't store session cookies anywhere outside Ranch's per-user vault; `agent/secret` is the wrong place.
- Don't reference `browser_login` / `browser_login_done` / VNC / "live browser" in your responses — those tools no longer exist in this runtime.
- Don't trust your own narration that something was posted without the verification read.
