---
name: paypal
description: PayPal Orders v2 API access via OAuth client_credentials. Two secrets per account (client_id + client_secret), exposed to agents as PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET. Server-side only — checkout buttons, Pay Later messaging, Apple/Google Pay belong in the storefront, not in an agent skill.
---

# PayPal

Same setup mechanics as [[openai]] — secret-mechanism, vault-backed — but PayPal
needs **two** credentials (client_id + client_secret) and uses OAuth
`client_credentials` to mint a short-lived bearer token. This file covers what's
different from [[stripe]]: the OAuth dance, sandbox vs live separation, and
which mutations require explicit user confirmation.

---

## Quick Reference

| Need | Answer |
|------|--------|
| Mechanism | `secret` |
| Env vars | `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` |
| Per-account aliases | `PAYPAL_CLIENT_ID_<ACCOUNTKEY>` (e.g. `_SANDBOX`, `_LIVE`) |
| Base URLs | `api-m.sandbox.paypal.com` (sandbox) / `api-m.paypal.com` (live) |
| Token lifetime | ~9h (`access_token` from `/v1/oauth2/token`) |
| Where to create | developer.paypal.com → Apps & Credentials |

> **Catalogue note.** The integration catalogue today exposes one
> `secretEnvKey` per service. Until that's extended, the recommended convention
> is two separate accountKeys on the same service:
> `paypal:client_id` and `paypal:secret`. Resolve both via `integration_secrets`
> and pair them in code (see snippet below). The cleaner alternative is a small
> extension to `catalogue.ts` and the connect dialog to accept two fields —
> file a ticket against the integration slice if you need it.

---

## Setting up

1. Create a **sandbox** app at developer.paypal.com → Apps & Credentials →
   Sandbox → Create App. Copy `Client ID` and `Secret`.
2. Open the admin UI at `/integrations` → **PayPal** → accountKey `sandbox` →
   paste `client_id`. Repeat with accountKey `sandbox-secret` → paste secret.
3. Verify the credentials by exchanging them for a token (see "Minting a
   token" below). Don't promote to live until at least one full
   create → approve → capture cycle works in sandbox.
4. For production, repeat the steps with the live app credentials and use
   accountKey `live` / `live-secret`.

Sandbox and live are **separate PayPal accounts** — orders never cross. Keep
them as distinct accountKeys so the agent has to pick deliberately.

---

## Minting a token

The runtime resolves both secrets, you Base64 them, and trade for a bearer:

```ts
const { env } = await integration_secrets({ service: 'paypal' })

// Use the explicit account when both sandbox and live are connected.
// Fall back to the default alias (most-recently-updated) otherwise.
const clientId = env.PAYPAL_CLIENT_ID_SANDBOX ?? env.PAYPAL_CLIENT_ID
const clientSecret = env.PAYPAL_CLIENT_SECRET_SANDBOX ?? env.PAYPAL_CLIENT_SECRET
if (!clientId || !clientSecret) {
  return ctx.send(
    'PayPal isn\'t connected. Open /integrations and add a PayPal client_id + secret first.',
  )
}

const base = clientId.startsWith('A') // live ids start with A (sandbox starts with A too — use accountKey to decide)
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
})
const { access_token } = await tokenRes.json()
```

The base URL choice is **not** derivable from the client_id prefix — both
sandbox and live ids start with `A`. Pick the base from the accountKey
(`sandbox` → sandbox base, `live` → live base) and surface a clear error
if the agent is ambiguous about which account it wants.

Each tool call mints a fresh token. Don't try to cache across calls — the
runtime doesn't give tools a per-user cache, and 9-hour tokens aren't worth
the persistence work.

---

## Calling the API

Orders v2 is the only API a runtime agent should touch directly. Everything
else (Subscriptions, Payouts, Disputes) is either covered by Orders or needs
human review.

```ts
// Create an order (intent: CAPTURE for one-step sale, AUTHORIZE for two-step).
const res = await fetch(`${base}/v2/checkout/orders`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: ref,
      amount: { currency_code: 'USD', value: '100.00' },
      description,
    }],
  }),
})
const order = await res.json()
// order.id e.g. "7MW20236HK..." — store it; orders expire after 3h.
```

Then surface `order.id` and the approval link (from `order.links[].href` where
`rel === 'approve'`) to the user. **The agent never approves the order itself
— the buyer does, in their PayPal session.** Once approved, capture:

```ts
await fetch(`${base}/v2/checkout/orders/${order.id}/capture`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${access_token}` },
})
```

---

## Safety rails

Charging, capturing, and refunding are irreversible — wrap every mutation
in an explicit user confirmation, same pattern as [[stripe]]:

```ts
await ctx.send(
  `About to capture ${formatMoney(amount)} on PayPal order ${order.id}. Reply "confirm capture" to proceed.`,
)
// ... wait for the user's "confirm capture" message ...
await fetch(`${base}/v2/checkout/orders/${order.id}/capture`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${access_token}` },
})
```

Mutating calls that always require confirmation:

- `POST /v2/checkout/orders/{id}/capture` — charges the buyer
- `POST /v2/payments/captures/{id}/refund` — issues a refund
- `POST /v2/payments/authorizations/{id}/void` — voids an authorization
- `POST /v1/payments/payouts` — sends money out

Read-only flows (`GET /v2/checkout/orders/{id}`, listing transactions for a
date range) don't need confirmation, but watch out for date filters that
return huge result sets — paginate, don't dump.

3D Secure / SCA is mostly a frontend concern — the buyer's PayPal session
handles the challenge during approval. The agent doesn't see it.

---

## What's out of scope for this skill

These belong to the storefront/frontend, not a runtime agent — don't try to
script them via this skill:

- JavaScript SDK button rendering (`paypal-js`, `paypal-buttons`)
- Pay Later messaging widgets, Apple Pay / Google Pay buttons
- Fastlane / Express Checkout (frontend-only flow)
- Card Fields (Expanded Checkout PCI-handled iframe)
- Webhook receivers — those need a public HTTPS endpoint; if you need them,
  add a server slice in the host app and surface events to the agent via
  internal API, don't try to host them inside the runtime

Subscriptions (`/v1/billing/subscriptions`) and Payouts work via the same
OAuth token if the agent really needs them, but both require human review
flows that aren't standardized yet — confirm with the user before adding.

---

## Don't

- Don't promote sandbox credentials to live by editing the accountKey —
  always re-paste from the live app. Live secrets are not derivable from
  sandbox ones.
- Don't log requests with the `Authorization` header or the raw
  `client_secret`/`access_token`. Filter before logging.
- Don't fire captures, refunds, or payouts from autonomous loops — always
  loop in the user, even for "small" amounts.
- Don't reuse an order id across sessions. PayPal orders expire after 3h
  and one-shot capture; create a fresh order for each buyer interaction.
- Don't infer environment from the client_id prefix — both sandbox and live
  ids start with `A`. Drive base URL from the accountKey.
- Don't store webhook signing secrets in this integration row. They're a
  separate concern owned by the host app, not the user's PayPal account.
