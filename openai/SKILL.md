---
name: openai
description: OpenAI API access via the per-user secret store. Stores the user's API key once, exposes it to agents at tool-call time as OPENAI_API_KEY.
---

# OpenAI

The user's OpenAI key lives in the ranch per-user secret vault — set once via the admin UI, resolved lazily by the runtime on each tool invocation. Agents see it as the environment variable `OPENAI_API_KEY`.

---

## Quick Reference

| Need | Answer |
|------|--------|
| Mechanism | `secret` (no browser involved) |
| Env var | `OPENAI_API_KEY` |
| Per-account aliases | `OPENAI_API_KEY_<ACCOUNTKEY>` — e.g. `OPENAI_API_KEY_WORK` |
| Tool | `integration_secrets` — fetches the user's resolved env map |
| Where to get a key | https://platform.openai.com/api-keys |

---

## Setting up

1. The user opens the admin UI at `/integrations`.
2. They click **OpenAI** → leave accountKey as `default` (or use `work`/`personal` if they want multiple keys) → **Continue**.
3. The Sheet flips to "Set OpenAI key" — paste the `sk-…` token → **Save**.

The value is written to the per-user secret store and never returned through the API. If the key is later rotated, repeat the steps — the new value overwrites the old.

---

## Using the key in a tool

The runtime resolves user secrets lazily. To access the key:

```ts
const { env } = await integration_secrets({ service: 'openai' })
const apiKey = env.OPENAI_API_KEY
if (!apiKey) {
  return ctx.send(
    'OpenAI isn\'t connected. Open /integrations and add an OpenAI key first.',
  )
}

const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ model: 'gpt-5', messages: [...] }),
})
```

If the user has connected multiple OpenAI accounts, the most recently updated one wins `OPENAI_API_KEY`. To pick a specific one, use the alias: `env.OPENAI_API_KEY_PERSONAL`.

---

## Don't

- Don't store the key in `agent/secret` (per-agent store) — that's for credentials the agent owns. The user's API key follows the user across agents.
- Don't echo the key in chat output, logs, or error messages. Filter `Authorization` headers before logging requests.
- Don't try to read the key directly from the database or AWS Secrets Manager — go through `integration_secrets`. The resolution rules (most-recent wins, aliases, etc.) only live there.
