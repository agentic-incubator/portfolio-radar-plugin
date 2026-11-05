---
name: branch-cleanup
description: Branch cleanup after a merge, as two choices the person makes - remote (GitHub deletes a merged PR's branch) and local (Ship it updates their clone and removes the merged branch safely). Use in /radar-setup's cleanup step, after Ship it, and when /radar-doctor flags branch cleanup.
---

# Branch cleanup

Merged PRs leave branches behind: on GitHub, and in the person's clone. This skill offers two cleanups. **Each is the person's choice, asked separately, and both default to no.** Save the answers with `state.mjs set '{"cleanup":{"remote":<true|false>,"local":<true|false>}}'` (merge with what's there).

The script is `node "${CLAUDE_PLUGIN_ROOT}/scripts/cleanup.mjs"`. Without `--yes` it only shows what it would do. Show that plan first, ask, and only then run it again with `--yes`.

## Remote: GitHub removes merged branches

This turns on GitHub's own **Automatically delete head branches** setting. GitHub then deletes a PR's branch when the PR merges. It never touches unmerged branches, and a deleted branch can be restored from the PR page.

Ask: "Should GitHub delete a pull request's branch once it's merged? 1) Only my radar repo, 2) Every repo I own in the owners I picked, 3) No, keep branches." Default 3.

- 1: `cleanup.mjs remote --repos <radar repo>`
- 2: `cleanup.mjs remote --owners <their own login and orgs, never client orgs>`. A client org's repos are the client's call.

It needs admin rights on each repo. Report what it turned on, what failed and why, and any owner it couldn't list. Never show a repo it couldn't read as done. With no terminal, give the click path: repo **Settings → General → Pull Requests → Automatically delete head branches**.

## Local: tidy the clone after Ship it

Ask: "After Ship it merges a PR, should I bring your local copy up to date and remove the merged branch? I only do it when your copy has no unsaved work." Default no.

When on, after a successful Ship it, and only on a machine with that clone: `cleanup.mjs local --clone <path> --branch <PR branch> --head-sha <merged head SHA>`, show the plan, and on yes rerun with `--yes`. It:

- stops and changes nothing if the clone has uncommitted or untracked files, or a rebase, merge or cherry-pick in progress,
- fetches with prune, checks out the default branch and fast-forwards it,
- removes a worktree for the merged branch only if that worktree is clean,
- deletes the local branch with `git branch -d` only. After a squash merge git usually refuses. Then it says so, and if every commit on the branch is in the merged PR it gives the person the `git branch -D` command to run themselves. Never run `-D` or any `--force` yourself.
- never touches main, master, develop, trunk or release branches.

## Fewer prompts (optional)

Claude Code asks before each delete. If the person wants fewer prompts, show these and let them add them. Claude can't write its own permissions, and some setups block it, so don't write these files for them.

Cloud sessions read `.claude/settings.json` from the repo they work in (commit it to the default branch):

```json
{
  "permissions": {
    "allow": ["Bash(git fetch --prune:*)", "Bash(git push origin --delete:*)"],
    "deny": [
      "Bash(git push origin --delete main)", "Bash(git push origin --delete master)",
      "Bash(git push origin --delete develop)", "Bash(git push --force:*)", "Bash(git push -f:*)"
    ]
  }
}
```

On their own computer, merge these into `~/.claude/settings.json`, keeping what's there:

```json
{
  "permissions": {
    "allow": ["Bash(git fetch --prune:*)", "Bash(git branch -d:*)", "Bash(git worktree remove:*)", "Bash(git worktree prune:*)"],
    "deny": [
      "Bash(git branch -D:*)", "Bash(git branch --delete --force:*)",
      "Bash(git worktree remove --force:*)", "Bash(git worktree remove -f:*)",
      "Bash(git push --force:*)", "Bash(git push -f:*)", "Bash(rm -rf:*)"
    ]
  }
}
```

A deny rule always wins over an allow rule, so the forced versions stay blocked.

## Where cloud sessions can't help

A cloud session often can't delete a GitHub branch (its git access is limited to its own branch) or change repo settings. When a delete or setting change fails there, say so in one line and give the exact command for the person to run, for example `gh api -X DELETE repos/<owner>/<repo>/git/refs/heads/<branch>`. A 422 from that command means the branch is already gone.
