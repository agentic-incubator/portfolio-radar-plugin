---
name: handoff-rules
description: The rules every portfolio-radar hand-off follows when it opens a PR in someone's repo, read from workstation-steward when installed or from handoff-rules.md otherwise. Use before any hand-off, triage plan, sweep or Ship it.
---

# Hand-off rules

A hand-off is any action that changes a repo: fold bot PRs, fix CI, add AGENTS.md, sweep a package across repos, an approved triage step. Ship it is the only action that merges.

## Where the rules come from

1. **workstation-steward installed** (`steward` on the PATH, or the person names a `workstation-steward-config` repo): read its `AGENTS.md` and `skills/pr-consolidation/rules.md` fresh on every run, from the steward repo and their config repo. Where steward and the defaults below differ, steward wins. Steward's own repos get Ship it only; everything else there goes through `/steward-maintain`.
2. **Otherwise:** `handoff-rules.md` at the root of their radar repo. The wizard writes it from `default-rules.md` next to this file. The person may edit it; their version wins.

## Rules that always apply, whatever the source says

- Work in a fresh clone. Open a PR and stop. Never merge in a hand-off.
- Never push to someone else's branch, rewrite history, or force-push the default branch.
- Never close a Renovate PR by hand.
- Never skip, disable or quarantine a test to get CI green.
- Never delete branches, repos, files or releases except: Ship it deletes the merged PR's branch.
- The radar's own GitHub App stays read-only. All writes go through the Claude app under the person's account.
- Repos without the Claude app installed: stop and say "Install the Claude app on <owner> for buttons there" with https://github.com/apps/claude/installations/select_target.

## Ship it

Squash-merge and delete the branch only when: the person who owns the dashboard pressed it, the PR head is the same commit the dashboard showed, and every check on that head is green now. Otherwise stop and say which condition failed. Pass the commit message explicitly so no AI co-author trailer is added.
