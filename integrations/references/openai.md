# OpenAI

Provider specifics. The vault mechanism, setup flow and don'ts are in [../SKILL.md](../SKILL.md).

| Need | Answer |
|------|--------|
| Env var | `OPENAI_API_KEY` |
| Per-account alias | `OPENAI_API_KEY_<ACCOUNTKEY>` — e.g. `OPENAI_API_KEY_WORK` |
| Where to get a key | https://platform.openai.com/api-keys |
| Key shape | `sk-…` |

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
