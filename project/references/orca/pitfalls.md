# Known pitfalls

Collected from real runs. Symptom → cause → fix.

| Symptom | Cause | Fix |
|---|---|---|
| The agent opened but sits empty; dispatch says "not ready, do not launch a duplicate" | agent started separately from worktree creation; prompt delivery raced the TUI | agent-first create (`--agent --prompt`); by hand: put the prompt in a file and send one line "read the file and follow it" — never a second worker |
| A new workspace's setup fails on the database | infrastructure moved only in a local, unpushed commit | land the infrastructure change on main first, then dispatch |
| A worker's PR contains unrelated commits | the dispatcher branched from local main with unpushed commits | branch from `origin/main`; stop when local and remote main diverged |
| CI gate red on a "clean" PR | the gate reads committed files only; it ran before the commit | commit → gate → push |
| Every cleanup "fails" | teardown calls an old cluster address | fix the hook; verify leftovers directly |
| Updating local main is refused | staged changes in the root checkout | leave someone else's index alone; update later |
| A plain test run wiped the dev database | the app's `.env` loads before the test config | always pass an explicit `DATABASE_URL` to the test database |
| The full suite fails a different few tests every run | flaky tests on main | re-run only the failed suites, alone; never re-run the whole suite to "see if it settles" |
| A rejection appeared minutes after the merge | the card was read long before merging | re-read the card in the minute you merge |
| The post-deploy check is red on every deploy | the environment it targets was never configured | disable the workflow until the environment exists; file a task |
| Browser tests in CI are always "cancelled" | the suite outgrew the job timeout | its own task — cancelled is not passed |
| A gate fails on a third-party skill pack | the pack contains words or paths the repo forbids | run the project gates right after adding a pack |
| Background jobs exit, results look fine, but the worker reported something else | reading a worker's claim instead of the source | read the tracker and PR yourself; a worker's summary is not evidence |
| The agent warns it has < 25% of its weekly limit | provider usage limits | watch the TUI warning; do not dispatch more than the limit can finish |
| `git stash` lost changes | the stash is shared by all worktrees | never stash; deny it |
| `gh pr merge --match-head-commit` rejected | a short sha | pass the full 40-char sha |
| A deferred step was never done after acceptance | acceptance deleted the workspace that owned it | finish timed observations / provider cleanups before accepting |
