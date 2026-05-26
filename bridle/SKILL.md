---
name: bridle
description: Embed Bridle webchat into a website. Wire the SDK, mint embed JWTs server-side, theme the widget through Shadow DOM, and connect to a hub running your agent.
---

# Bridle

Bridle is an embeddable webchat for AI agents — one script tag connects a browser to an agent process through a stateless WebSocket hub. There are three integration paths (drop-in script, npm, headless), one wire protocol, and one auth model with two flavors (public agent vs. JWT).

Source: https://github.com/CleanSlice/bridle · Docs: https://bridle.cleanslice.org · npm: `@cleanslice/bridle`

---

## Architecture (always the same)

```
Browser  ─►  Bridle Hub (NestJS)  ─►  Agent Runtime
   │             │   /ws/client          │   /ws/agent
   │             │   JWT + agentId       │   apiKey + agentId
   │             └───────────────────────┘
   │       routes by agentId, no state stored
   ▼
SDK auto-mounts <bridle-chat> Custom Element with Shadow DOM
```

The **hub is stateless** — it just routes messages between matched (agentId) pairs. Sessions persist in the agent runtime, not the hub.

---

## Quick Reference

| Need | Answer |
|------|--------|
| Drop-in script | `https://bridle.cleanslice.org/sdk/latest.js` |
| Pinned version | `/sdk/v0.js` (latest 0.x) or `/sdk/v0.8.0.js` (exact) |
| npm package | `@cleanslice/bridle` (exports `init`, `BridleClient`, types) |
| Custom Element tag | `<bridle-chat>` |
| Auth modes | **Public** (origin whitelist, no token) · **JWT** (browser sends JWT minted by your backend) |
| Theme tokens | CSS vars on `bridle-chat` (e.g. `--bridle-primary`) — pierce Shadow DOM |
| Internal selectors | `.bridle__panel`, `.bridle__bubble`, etc. — only reachable via `customCss` (v0.8.0+) |

---

## Integration path 1 — Drop-in `<script>`

The simplest option. One tag, no build step. Works on any HTML page (WordPress, Webflow, Shopify, plain HTML).

```html
<script
  src="https://bridle.cleanslice.org/sdk/latest.js"
  data-api-url="https://your-hub.example.com"
  data-agent-id="agent-abc-123"
  data-token="<jwt>"
></script>
```

When this loads, the SDK registers a `<bridle-chat>` Custom Element and mounts a floating bubble in the bottom-right corner.

### Available `data-*` attributes

| Attribute | Default | Purpose |
|-----------|---------|---------|
| `data-agent-id` | **required** | Agent identifier registered on the hub |
| `data-token` | **required** unless public agent | JWT minted by your backend |
| `data-api-url` | inferred from script's origin | Hub origin |
| `data-mode` | `floating` | `floating` (FAB) or `inline` (mounted inside `data-mount`) |
| `data-mount` | `<body>` | CSS selector for inline mode |
| `data-title` | `Agent Chat` | Header text |
| `data-placeholder` | `Type a message...` | Input placeholder |
| `data-theme` | `default` | `default` or `cleanslice` (teal palette) |
| `data-color-mode` | `auto` | `auto` / `light` / `dark` |
| `data-custom-css` | — | Inline CSS injected into the shadow root (v0.8.0+) |
| `data-stylesheet` | — | One or more CSS file URLs (comma-separated) loaded inside the shadow root (v0.8.0+) |
| `data-prompt` | — | Extra context forwarded with every message at handshake |

---

## Integration path 2 — npm (bundler)

For Vite/Next/Nuxt/Webpack. You get tree-shaking, type defs, and full programmatic control.

```bash
npm i @cleanslice/bridle
```

```ts
import { init } from '@cleanslice/bridle'

const chat = init({
  apiUrl: 'https://your-hub.example.com',
  agentId: 'agent-abc-123',
  token: () => fetchJwt(),     // string OR async function for refresh
  mount: '#chat',              // CSS selector or HTMLElement
  mode: 'inline',
  title: 'Support',
  themeVars: { '--bridle-primary': '#0070f3' },
  customCss: `.bridle__panel { border-radius: 5px; }`,
  onReady: () => console.log('connected'),
  onMessage: (msg) => console.log(msg.text),
  onError: (err) => console.error(err),
})

chat.sendMessage('Hi!')
chat.open()
chat.close()
chat.destroy()
```

`init()` returns `{ element, open, close, sendMessage, destroy }`. The token can be a string OR a function returning `string | Promise<string>` so you can refresh expired JWTs without remounting.

---

## Integration path 3 — Headless (no UI)

When you want to bring your own UI but use the hub for transport.

```ts
import { BridleClient } from '@cleanslice/bridle'

const client = new BridleClient({
  apiUrl: 'https://your-hub.example.com',
  agentId: 'agent-abc-123',
  token: 'eyJhbG...',
})

client.on('message', (m) => render(m.text))
client.on('stream', (m) => render(m.text))      // partial text as it streams
client.on('stream_end', (m) => finalize(m.text))
client.on('error', (err) => handleAuthError(err))

await client.connect()
client.send('hello')
```

---

## Authentication

Pick **public** for marketing sites, docs, demos. Pick **JWT** when the user is signed into your product and you want per-user routing/quota/identity.

### Public agent (origin whitelist, no token)

Configure the agent on the hub to accept connections from specific origins. The browser sends no token; the hub accepts the WebSocket based on the request's `Origin` header.

Use this when:
- The site is public and there's no per-user state to scope by
- All visitors get the same agent treatment

The SDK call simply omits `data-token` / `token`. If the origin isn't whitelisted, the connection is rejected and the SDK shows an inline "Origin … isn't whitelisted" banner.

### JWT minted server-side

The integrator's backend mints a short-lived JWT and hands it to the browser. The Ranch hub provides this endpoint at `POST /auth/embed/token`:

```ts
// On YOUR backend (Node example, no dotenv):
const res = await fetch(`${RANCH_API_URL}/auth/embed/token`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${RANCH_API_KEY}`,   // server-side key, never to browser
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sub: user.id,                                // becomes JWT.sub → clientId on hub
    email: user.email,
    expiresIn: '7d',                             // <n>(s|m|h|d). Default 15m is short for dev.
  }),
})
const { data } = await res.json()                // ranch wraps as { success, data }
return data.token                                // string + expiresAt
```

The JWT carries `sub` (becomes `clientId` for message routing) and `email`. Pass `roles: ['ADMIN']` to mint an admin token (`clientId = 'admin'`).

**Never put `RANCH_API_KEY` in the browser.** The whole point of the mint endpoint is to keep it server-side. Expose only the minted JWT.

---

## Theming

The Custom Element uses Shadow DOM, so host-page CSS doesn't reach internal classes. Two levers:

### CSS variables (cross the shadow boundary)

| Variable | Purpose |
|----------|---------|
| `--bridle-primary` | Brand color (FAB, send button, user bubbles) |
| `--bridle-primary-fg` | Foreground on primary |
| `--bridle-bg` / `--bridle-fg` | Panel background / body text |
| `--bridle-bubble-bg` | Assistant bubble background |
| `--bridle-user-bg` / `--bridle-user-fg` | User bubble |
| `--bridle-border` | Borders, dividers |
| `--bridle-radius` | Panel + bubble corner radius |
| `--bridle-shadow` | Panel/FAB shadow |
| `--bridle-z` | z-index of the floating panel |
| `--bridle-font` | Font family |

Three ways to set them:

```css
/* Plain CSS (host page) */
bridle-chat { --bridle-primary: #ec4899; --bridle-radius: 8px; }
```

```ts
// init() option
init({ ..., themeVars: { '--bridle-primary': '#ec4899' } })
```

Pre-built palettes: `theme: 'default' | 'cleanslice'` (cleanslice = teal/cyan).

### customCss (inject inside Shadow DOM, v0.8.0+)

For everything CSS variables can't express — overriding `.bridle__panel`'s border, the `.bridle__bubble` font size, etc.:

```ts
init({
  ...,
  customCss: `
    .bridle__panel {
      border-radius: 5px;
      box-shadow: 0 2px 6px #00000029;
      border: 1px solid #C5D5FF;
    }
    .bridle__bubble { font-size: 13px; }
  `,
  stylesheets: ['/css/bridle-overrides.css'],  // or comma-list via data-stylesheet
})
```

Cascade order: your overrides are appended **after** the component's own `<style>`, so equal-specificity rules win without `!important`.

### Internal classes (part of the public surface)

| Class | What it is |
|-------|------------|
| `.bridle__panel` | The chat panel |
| `.bridle__header` | Header row with title and close button |
| `.bridle__messages` | Scrollable message list |
| `.bridle__bubble` | A single message bubble |
| `.bridle__bubble--md` | Assistant bubble with rendered Markdown |
| `.bridle__msg--user` / `.bridle__msg--assistant` | Bubble wrapper per role |
| `.bridle__input` | Footer composer |
| `.bridle__fab` | Floating action button |
| `.bridle__typing` | Three-dot typing indicator |
| `.bridle__banner--error` | Connection-error banner |

These class names are part of the SDK's public surface — they won't be renamed without a major-version bump.

---

## Message Parts (wire protocol)

All messages carry `parts: BridlePart[]` — text, image, file:

```ts
{ type: 'text',  text: 'Hello' }
{ type: 'image', base64: '...', mediaType: 'image/jpeg' }
{ type: 'file',  url: 'https://...', name: 'doc.pdf', mimeType: 'application/pdf' }
```

The `text` field is always present as a shorthand. Legacy clients sending `{ text, images }` are auto-converted by the hub.

Streaming uses `stream` events (accumulated text, not deltas — easier for clients) and a final `stream_end` event.

---

## Recipe: embed bridle into a customer site

Paste-ready prompt the agent can adapt:

1. **Decide auth mode.** Public site / docs / marketing → public agent (no token). Signed-in product → JWT.
2. **For public:** ask the operator to whitelist the customer's origin on the agent in Ranch admin UI.
3. **For JWT:** add a server-side endpoint that calls `POST {RANCH_API_URL}/auth/embed/token` with the API key as a Bearer header. Return only `{ token, expiresAt }` to the browser.
4. **Mount the SDK.** For static HTML, drop the `<script>` tag. For SPA, call `init()` in a single mount-on-load lifecycle hook (`onMounted`, `useEffect`, etc.). Always pair with `destroy()` on unmount.
5. **Match brand.** Start with `themeVars` for color/radius/font. Drop to `customCss` only when you need to restyle internal classes.
6. **Verify.** Open the page; the FAB should appear in the corner (floating) or inline in the mount. The "●" status dot in the header should be green within ~1 second.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Failed to start bridle: fetch failed` | Hub isn't reachable from the SDK's backend (token mint) — usually means the hub process is down or `RANCH_API_URL` is wrong | Start the hub, fix the URL |
| Banner: `Origin … isn't whitelisted for this agent` | Public agent's allowed-origin list doesn't include this site | Add the origin in the admin UI |
| Banner: `MISSING_TOKEN` | Non-public agent and no token was passed | Pass `data-token` / `token` |
| Banner: `INVALID_TOKEN` | JWT signature failed (wrong `JWT_SECRET`) or expired | Re-mint a fresh token; verify `JWT_SECRET` matches between mint backend and hub |
| Banner: `MISSING_AGENT_ID` | `data-agent-id` / `agentId` missing | Set it |
| Chat connects, you send a message, nothing happens | No agent runtime is online for this `agentId` | Start the agent process / paddock; check `/api/agent/<agentId>/health` for `agentConnected: true` |
| Host-page CSS doesn't reach the panel | Shadow DOM isolation by design | Use `themeVars` for variables, `customCss` / `stylesheets` for everything else (v0.8.0+) |
| FAB never appears (drop-in) | Script 404 (`/sdk/latest.js`), or no `data-agent-id` (script skips auto-mount) | Check Network tab; verify `data-agent-id` is present |

---

## Don't

- Don't put `RANCH_API_KEY` / hub `JWT_SECRET` in the browser. Both are server-side only.
- Don't rely on host-page CSS reaching `.bridle__*` classes — use `customCss` instead.
- Don't `init()` more than once per mount. Use `destroy()` first if you need to recreate.
- Don't hardcode `data-api-url` if the SDK is served from the same origin as the hub — it's inferred from the script src.
- Don't mount in floating mode AND inline mode simultaneously for the same agent unless you intentionally want two independent sessions (each gets its own clientId).
