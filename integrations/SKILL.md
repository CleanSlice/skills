---
name: integrations
description: API access through the per-user secret vault — OpenAI, Stripe, PayPal. The user stores a key once in /integrations, the runtime resolves it lazily at tool-call time and exposes it to the agent as an environment variable. Use when an agent calls a third-party API on behalf of a user.
---

# Integrations (vault-backed API keys)

A user's API credentials live in the Ranch per-user secret vault: set once through the admin UI, never returned by the API, resolved lazily by the runtime on each tool invocation. The agent sees them as environment variables — it never sees storage, rotation or the database.

The mechanism is identical for every provider. Only the env var names, the API shapes and the safety rails differ — those live in the per-provider references.

| Provider | Reference | Env | Needs confirmation before |
|----------|-----------|-----|---------------------------|
| OpenAI | [references/openai.md](references/openai.md) | `OPENAI_API_KEY` | nothing — spend is metered, not irreversible |
| Stripe | [references/stripe.md](references/stripe.md) | `STRIPE_API_KEY` | charges, refunds, transfers |
| PayPal | [references/paypal.md](references/paypal.md) | `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` | captures, refunds, voids, payouts |

GitHub also uses this vault, but it is a workflow skill rather than a key-handling one — see the separate `github` skill.

---

## Quick Reference

| Need | Answer |
|------|--------|
| Mechanism | `secret` (no browser involved) |
| Tool | `integration_secrets` — returns the user's resolved env map |
| Where the user sets it | admin UI → `/integrations` → provider → paste → Save |
| Multiple accounts | one `accountKey` each (`default`, `work`, `test`, `live`, …) |
| Per-account alias | `<ENV>_<ACCOUNTKEY>` — e.g. `OPENAI_API_KEY_WORK`, `STRIPE_API_KEY_TEST` |
| Default resolution | most recently updated account wins the unsuffixed name |

---

## Setting up

1. The user opens `/integrations` in admin.
2. Clicks the provider → picks an `accountKey` (`default` unless they keep several) → **Continue**.
3. The sheet flips to "Set <provider> key" → paste → **Save**.

The value goes to the per-user secret store and is never returned through the API. Rotating a key means repeating the steps; the new value overwrites the old.

Keep environments as separate accountKeys — `test`/`live` for Stripe, `sandbox`/`live` for PayPal — so the agent has to pick deliberately instead of inferring.

---

## Using a key

```ts
const { env } = await integration_secrets({ service: 'openai' })   // or stripe / paypal
const apiKey = env.OPENAI_API_KEY
if (!apiKey) {
  return ctx.send('OpenAI isn\'t connected. Open /integrations and add an OpenAI key first.')
}
```

Always handle the missing-key branch by telling the user where to connect it. An agent that throws a raw `401` at the user has wasted the round trip.

To pin a specific account, read the alias instead of the bare name:

```ts
const key = env.STRIPE_API_KEY_TEST ?? env.STRIPE_API_KEY   // safer default for dry runs
```

---

## Money moves only with a human in the loop

Charges, captures, refunds, transfers and payouts are irreversible. Every mutating call gets an explicit confirmation first — the exact endpoint lists are in the Stripe and PayPal references.

```ts
await ctx.send(
  `About to refund ${formatMoney(amount)} to ${customerId}. Reply "confirm refund" to proceed.`,
)
// ... wait for the user's confirmation message, then call the API ...
```

Read-only flows don't need it. Watch filters that match far more rows than intended — paginate, don't dump.

---

## Don't

- Don't store a user's key in `agent/secret` — that store is for credentials the *agent* owns. A user's API key follows the user across agents.
- Don't echo keys or tokens in chat, logs or error messages. Filter the `Authorization` header before logging a request.
- Don't read the key straight from the database or AWS Secrets Manager. Go through `integration_secrets`; the resolution rules (most-recent wins, aliases) live only there.
- Don't fire a money mutation from an autonomous loop, no matter how small the amount.
- Don't keep webhook signing secrets in the same vault row — they belong to the host app, not to the user's provider account.
