# Accepting a task

The owner's explicit acceptance authorizes and instructs the agent to: merge the PR,
update local main, move the ticket to Done, remove the workspace and its local and
remote branches — **in that order**. Never merge or clean up on your own judgement.

If a reviewer verdict is unresolved or a DoD item was missed, say so in one sentence
first — then act anyway. The decision is the owner's.

## Checklist

```bash
# 0. Re-read the card IN THE SAME MINUTE you merge — a verdict may have just landed
./orca/jira.sh comments KEY
./orca/jira.sh get KEY | grep status

# 1. Did the branch move after it was checked?
git fetch origin && git rev-parse origin/<branch>
gh pr view N --json headRefOid,mergeable,statusCheckRollup

# 2. Merge exactly the head you checked (FULL sha — the API rejects a short one)
gh pr merge N --merge --match-head-commit "$(git rev-parse origin/<branch>)"

# 3. Update local main, close the ticket, leave a note
git merge origin/main            # on the coordinator's main, if its index is clean
./orca/jira.sh move KEY Done
./orca/jira.sh comment KEY "Accepted by the owner. PR #N merged (<sha>); workspace and branches removed."

# 4. Remove the workspace WITH its archive hook (skipped without --run-hooks)
orca worktree rm --worktree path:<workspace> --run-hooks
#    for a known false hook failure: add --allow-failed-archive-hook,
#    then verify what was left directly (databases, namespace)

# 5. Delete the remote branch and confirm nothing is left behind
git push origin --delete <branch>
```

## Traps

- `mergeable=CLEAN` says nothing about a verdict in the tracker — verdicts live in
  comments, not in GitHub reviews.
- The worker may push after your check. Compare the head; if it moved, re-check.
- `origin/main` may move under you; gate on the merge result, not only the branch.
- Updating local main fails if the root checkout has **staged** changes (someone's
  unfinished work). Do not touch someone else's index; postpone and say so.
- Acceptance deletes the workspace. If the task has a deferred step (a timed
  observation, cancelling test resources at a provider), finish it **before**
  accepting — afterwards nobody is left to do it.
- An agent accepting a task from inside its own workspace must arrange cleanup from
  outside, not abandon it because it cannot delete its current folder.
- Some deny rules block `git branch -D`. A merged local branch that `-d` refuses
  (because local main does not contain it yet) can simply stay; it is harmless.

## Sending a task back

Owner feedback goes to the **same** worker: `In Progress` for edits, `In Testing` for
verification, `In Review` again. Send it as one message to the worker's terminal,
including exactly what is wrong, what to change, what not to do (e.g. "do not add an
allow-list entry"), the checks to run, and "do not merge".
