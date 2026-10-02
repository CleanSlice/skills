# Workspace infrastructure: setup, isolation, teardown

## setup.sh, per workspace

1. Allocate a **port block** from the worktree pool (e.g. 10 ports per workspace) and
   write it to `.orca/.ports.env`. Claims are machine-local so two workspaces never
   get the same port.
2. Copy the `.env` files from the root checkout (secrets are never committed).
3. Install dependencies in every sub-project from the committed lockfile.
4. Create **two databases**: dev and test (`<ws>` and `<ws>_test`); apply
   migrations; choose a Redis database index.
5. Optionally: a namespace in a shared local cluster and a worker image.
6. Write `.orca/.setup-complete` or `.orca/.setup-failed`. With
   `setupAgentStartupPolicy: wait-for-setup` the worker does not start until setup
   succeeded.

## teardown.sh (archive hook), mirrored

Stop the servers on the workspace's ports, drop both databases, flush the Redis
index, delete the namespace and image, release the ports. It **must verify** that
each thing is gone and say loudly what is left ("left N things on the shared infra"),
appending to an orphans log. `orphans.sh` is a read-only report of infrastructure
that no workspace owns.

## Ports

Keep a machine-wide **port registry** (one JSON as the source of truth plus a readable
view) with a block per project and a pool for worktrees, and a script that checks it.
Reserve before use; fix the assignment rather than killing someone else's process.

## Traps

- **A workspace runs the scripts of its own base.** If you move infrastructure ports
  only in an unpushed local commit, new workspaces created from `origin/main` look for
  the old ports (`Can't reach database server at localhost:5432`). Land
  infrastructure changes on main first, then dispatch.
- **A stale cluster address in teardown** (the local cluster moved to a new port, the
  hook still calls the old one) makes every cleanup "fail", and the log can no longer
  tell real leftovers from false alarms. Check leftovers directly and fix the hook.
- **An empty kubeconfig path is not "no cluster".** `KUBECONFIG=""` and
  `--kubeconfig=` make kubectl fall back to `~/.kube/config` — possibly a production
  context. Prove the file exists and is non-empty before calling kubectl.
- **`k3d cluster create` rewrites `~/.kube/config`** and switches the current context
  by default — pass `--kubeconfig-update-default=false
  --kubeconfig-switch-context=false`. Give a workspace a namespaced ServiceAccount
  token, not the cluster-admin certificate.
- **A build can kill the workspace's own running server** (e.g. `nest build`,
  `nuxt build` replacing files under a watcher). Restart the project after the gate
  and update the terminal handle in the report.
- **Shared Postgres/Redis are shared.** Never `docker compose up/down` from a
  workspace; each workspace uses its own database names and Redis index on the
  shared servers.
