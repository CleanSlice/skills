---
name: stripe
description: Stripe API access via a restricted or secret key stored in the per-user secret vault. Exposed to agents as STRIPE_API_KEY.
---

# Stripe

Same setup mechanics as [[openai]] — secret-mechanism, vault-backed. This file covers Stripe-specific patterns and safety.

---

## Quick Reference

| Need | Answer |
|------|--------|
| Mechanism | `secret` |
| Env var | `STRIPE_API_KEY` |
| Where to create | dashboard.stripe.com/apikeys |
| Recommended | Restricted key with only the resources the agent touches |

---

## Setting up

1. **Prefer a restricted key** (not the secret key). Stripe lets you scope: e.g. read-only on `customers` + write on `refunds`.
2. Use **test mode** (`sk_test_…`) until the agent's flows are verified in production.
3. Admin UI `/integrations` → **Stripe** → paste the key.

Test and live keys are different accounts in Stripe's API — connect both as separate accountKeys (`test`, `live`) so the agent can pick deliberately.

---

## Using the key

```ts
const { env } = await integration_secrets({ service: 'stripe' })
const key = env.STRIPE_API_KEY
if (!key) {
  return ctx.send(
    'Stripe isn\'t connected. Open /integrations and add a Stripe key first.',
  )
}

const res = await fetch('https://api.stripe.com/v1/customers', {
  headers: {
    Authorization: `Bearer ${key}`,
    'Stripe-Version': '2024-12-18.acacia',
  },
})
```

Pick a specific account explicitly when both test and live are connected:

```ts
const key = env.STRIPE_API_KEY_TEST  // safer default for dry runs
```

---

## Safety rails

Charging cards is irreversible — the agent should require explicit confirmation before any mutating call (`POST` to `/v1/charges`, `/v1/refunds`, `/v1/transfers`).

```ts
// Always ask first
await ctx.send(
  `About to refund ${formatMoney(amount)} to customer ${customerId}. Reply "confirm refund" to proceed.`,
)
// ... wait for the user's "confirm refund" message ...
const res = await fetch('https://api.stripe.com/v1/refunds', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}` },
  body: new URLSearchParams({ charge: chargeId, amount: String(amount) }),
})
```

For read-only flows (looking up customers, listing subscriptions) the confirmation step isn't needed — just be careful with `customer.email` filters that match many accounts.

---

## Don't

- Don't use the master secret key (`sk_live_<long>`) when a restricted key works.
- Don't log requests with the `Authorization` header intact. Filter before logging.
- Don't fire refunds or charges from autonomous loops — always loop in the user.
- Don't store webhook secrets in the same vault row. Use a separate accountKey (`webhooks`) or store them per-agent if they're agent-owned.
