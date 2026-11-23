---
name: handoff-rules
description: The rules every portfolio-radar hand-off follows when it opens a PR in someone's repo, read from workstation-steward when installed or from handoff-rules.md otherwise. Use before any hand-off, triage plan, sweep or Ship it.
---

# Hand-off rules

A hand-off is any action that changes a repo: fold bot PRs, fix CI, add AGENTS.md, sweep a package across repos (or every package at once with Sweep all, one PR per repo), an approved triage step. Ship it is the only action that merges.

## Where the rules come from

1. **workstation-steward installed** (`steward` on the PATH, or the person names a `workstation-steward-config` repo): read its `AGENTS.md` and `skills/pr-consolidation/rules.md` fresh on every run, from the steward repo and their config repo. Where steward and the defaults below differ, steward wins. Steward's own repos get Ship it only; everything else there goes through `/steward-maintain`.
2. **Otherwise:** `handoff-rules.md` at the root of their radar repo. The wizard writes it from `default-rules.md` next to this file. The person may edit it; their version wins.

## Rules that always apply, whatever the source says

- Work in a fresh clone. Open a PR and stop. Never merge in a hand-off.
- Never push to someone else's branch, rewrite history, or force-push the default branch. (The only push to an existing PR branch is Ship it's conflict repair, below, and only on the person's own PRs.)
- Never close a Renovate PR by hand.
- Never skip, disable or quarantine a test to get CI green.
- Never delete branches, repos, files or releases except: Ship it (and Ship all, per PR) deletes the merged PR's branch.
- The radar's own GitHub App stays read-only. All writes go through the Claude app under the person's account.
- Repos without the Claude app installed: stop and say "Install the Claude app on <owner> for buttons there" with https://github.com/apps/claude/installations/select_target.

## Ship it

Squash-merge and delete the branch only when: the person who owns the dashboard pressed it, the PR head is the same commit the dashboard showed, and every check on that head is green now. Otherwise stop and say which condition failed. Pass the commit message explicitly so no AI co-author trailer is added.

A conflict is the one case where Ship it may push, and only to a PR branch the person's own account opened (never a bot's, a fork's, someone else's, a release PR or a steward repo): merge the base into the branch with a normal merge commit, resolve only lockfiles and changes git merges cleanly, run the repo's gates, push, and stop. Never rebase or force-push. The push changes the head, so the person's "ship it" no longer covers it: report `conflicts-resolved` with the new head and let them press Ship it again. Real conflicts are skipped and the files named. The same repair applies in Sweep all and Sweep (one package) to an already-open PR that clears the package but conflicts. Details are in `/radar-actions` under "Conflict repair".

Ship all is Ship it run on each PR the person confirmed in its list, one at a time, with every condition checked per PR just before its merge. A PR that fails a condition is skipped and reported; the rest go on.
