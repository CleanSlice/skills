# Checking Actions & Deployments

How to inspect workflow runs, diagnose failures, fetch logs, and verify that a deploy actually shipped.

---

## Two layers — workflow runs vs deployments

These look similar but are distinct GitHub primitives. Don't confuse them.

| Layer | What it is | API surface |
|-------|------------|-------------|
| **Workflow run** | One execution of a `.github/workflows/*.yml` file | `/actions/runs` |
| **Deployment** | A logical "I shipped X to environment Y" record | `/deployments` |

A workflow run **may create** a deployment, but a green workflow run doesn't prove a deploy succeeded — the deploy job inside it could have failed even if a notify-on-success step in the same workflow is green. Always check both layers when the user asks "did the deploy work?"

---

## Quick health check — "is CI green on the default branch?"

The fastest single-call answer:

```ts
const res = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/actions/runs?branch=${branch}&per_page=5`,
  headers,
})

const runs = res.body.workflow_runs as Array<{
  id: number
  name: string
  status: 'queued' | 'in_progress' | 'completed'
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null
  head_sha: string
  html_url: string
  created_at: string
  updated_at: string
  run_started_at: string
}>
```

The **first** run in the list is the most recent. Look at `status` first (is it still running?), then `conclusion` (did it pass?).

| `status` | `conclusion` | Meaning |
|----------|--------------|---------|
| `completed` | `success` | ✅ Passed |
| `completed` | `failure` | ❌ Failed — fetch failed jobs |
| `completed` | `cancelled` | ⚠️ Manually cancelled or superseded |
| `completed` | `timed_out` | ❌ Hit the 6h limit (or job-level timeout) |
| `completed` | `action_required` | ⚠️ Waiting on approval (env protection or manual trigger) |
| `in_progress` | `null` | 🔄 Still running |
| `queued` | `null` | 🕒 Hasn't started — usually runner-availability |

Report the head SHA + the workflow name + the link. Don't just say "CI is failing" — name the workflow.

---

## Diagnose a failed run

Once you know which run failed (`run_id`):

```ts
const jobs = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/actions/runs/${runId}/jobs`,
  headers,
})

const failed = jobs.body.jobs.filter(j => j.conclusion === 'failure')

for (const job of failed) {
  // Each job has a `steps` array — find the failed step
  const failedStep = job.steps.find(s => s.conclusion === 'failure')
  console.log(`Job "${job.name}" failed at step "${failedStep?.name}"`)
}
```

### Fetching logs

The logs endpoint returns a zip stream of all logs for the run:

```ts
const logs = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/actions/runs/${runId}/logs`,
  headers,
  responseType: 'arraybuffer',
})
// → ZIP archive; unzip and read <job-name>/<step-number>_<step-name>.txt
```

For just one job's logs (often what you actually want):

```ts
const log = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/actions/jobs/${jobId}/logs`,
  headers,
  responseType: 'text',
})
```

Returns plain text with `<timestamp> <message>` lines. **The last ~50 lines almost always contain the error.** Don't dump the whole log into the chat — extract the failure region:

```ts
const lines = log.split('\n')
// Find the line with "##[error]" or "Error:" or "FAIL"
const errorIdx = lines.findLastIndex(l => /##\[error\]|Error:|FAIL\s/.test(l))
const excerpt = lines.slice(Math.max(0, errorIdx - 30), errorIdx + 5).join('\n')
```

### Re-run failed jobs

```ts
// Re-run only the failed jobs (keeps successful ones)
await http({
  method: 'POST',
  url: `https://api.github.com/repos/${owner}/${name}/actions/runs/${runId}/rerun-failed-jobs`,
  headers,
})

// Or re-run the entire workflow
await http({
  method: 'POST',
  url: `https://api.github.com/repos/${owner}/${name}/actions/runs/${runId}/rerun`,
  headers,
})
```

**Ask the user first** before re-running. A flaky test is often a real bug — don't auto-retry into green.

---

## Polling a still-running workflow

Sometimes the user wants to watch a workflow finish. Don't tight-loop — use ETag conditional requests:

```ts
let etag = ''
let last = null
while (true) {
  const res = await http({
    method: 'GET',
    url: `https://api.github.com/repos/${owner}/${name}/actions/runs/${runId}`,
    headers: { ...headers, ...(etag ? { 'If-None-Match': etag } : {}) },
    validateStatus: () => true,
  })
  if (res.status === 304) {
    // no change, keep polling
  } else if (res.status === 200) {
    etag = res.headers['etag']
    last = res.body
    if (last.status === 'completed') break
    ctx.send(`Status: ${last.status} — ${last.name}`)
  }
  await sleep(15_000)
}
```

15-second poll is fine — Actions status doesn't change faster than that anyway. **Stop after ~10 minutes** of polling and hand back to the user; if the workflow is genuinely stuck the agent has nothing useful to add by waiting longer.

---

## Trigger a workflow manually

For `workflow_dispatch` triggers:

```ts
await http({
  method: 'POST',
  url: `https://api.github.com/repos/${owner}/${name}/actions/workflows/${workflowFileOrId}/dispatches`,
  headers,
  body: {
    ref: 'main',
    inputs: {
      environment: 'production',
      version: 'v1.2.3',
    },
  },
})
```

The endpoint returns `204` immediately — it doesn't return the run id. To find the run you just triggered:

```ts
// Poll /actions/runs?event=workflow_dispatch and pick the newest one created after your trigger
```

Race condition: another dispatch could land in the same second. Match on `actor.login` (your token's user) + `inputs` if you need certainty.

---

## Deployments — the other layer

Separate from workflow runs. A deployment has its own status timeline.

```ts
// Latest deployment to an environment
const deps = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/deployments?environment=production&per_page=1`,
  headers,
})

const dep = deps.body[0]
// dep.sha, dep.ref, dep.environment, dep.created_at

// Get its status
const statuses = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/deployments/${dep.id}/statuses`,
  headers,
})

// Most recent status is statuses.body[0]
// state: 'pending' | 'queued' | 'in_progress' | 'success' | 'failure' | 'error' | 'inactive'
```

`state: 'success'` is the only state that means "deployed." `inactive` means superseded by a newer deployment.

### Environments

```ts
const envs = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/environments`,
  headers,
})
```

For each environment you get: protection rules (required reviewers, wait timer), secrets count, deployment branches. Useful when the user asks "why is the deploy waiting?" — likely a required-reviewer rule.

---

## gh CLI equivalents

For quick interactive checks, the CLI is shorter:

```bash
gh run list --branch main --limit 5
gh run view <run-id>
gh run view <run-id> --log-failed       # only failed step logs
gh run watch <run-id>                   # live tail until completion
gh run rerun <run-id> --failed
gh workflow run <workflow.yml> -f environment=production
```

The `--log-failed` flag is gold — it pulls just the failed step's log and prints it, no zip-unwrapping needed.

---

## Common patterns

### "Did my latest commit pass CI?"

```ts
const commit = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/commits/${branch}/check-runs`,
  headers,
})
// check_runs[].conclusion, check_runs[].name, check_runs[].html_url
```

The check-runs endpoint shows ALL checks on a commit (Actions + third-party like Vercel, CodeQL, Dependabot). The `/actions/runs` endpoint only shows GitHub Actions.

### "Why is my PR's merge button red?"

```ts
const pr = await http({
  method: 'GET',
  url: `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}`,
  headers,
})

// pr.mergeable: true | false | null (still calculating)
// pr.mergeable_state: 'clean' | 'dirty' | 'unstable' | 'blocked' | 'behind' | 'unknown'
```

- `dirty` — merge conflict
- `behind` — branch is behind base; merge or rebase needed
- `unstable` — required checks failing
- `blocked` — required reviews missing or branch protection unsatisfied
- `clean` — good to merge

Use this to give the user a specific reason, not just "GitHub says it can't merge."

---

## Don't

- Don't auto-rerun failed workflows. Flakes mask real bugs — let the user decide.
- Don't dump full workflow logs into chat. Extract the failure region (last error line + ~30 lines of preceding context).
- Don't conflate workflow-run status with deploy status. A green workflow can contain a failed deploy job.
- Don't poll faster than every 10-15s. Actions doesn't update faster than that, and you'll burn rate limit.
- Don't trust `status: 'completed'` alone — always check `conclusion` too.
- Don't trigger workflow_dispatch on someone else's repo without explicit confirmation — even read-only Actions can consume their billing minutes.
