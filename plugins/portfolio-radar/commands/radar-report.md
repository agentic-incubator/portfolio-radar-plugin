---
description: Read today's radar report and tell me the few things that need me.
argument-hint: "[owner filter]"
---

Read today's report from the radar repo in state (`node "${CLAUDE_PLUGIN_ROOT}/scripts/state.mjs" get`):
`gh api repos/<repo>/contents/reports/latest.md -H "Accept: application/vnd.github.raw"`.

Reply with:
1. One line: the date and headline totals.
2. Up to five moves for today, most urgent first (exposed secrets, then critical/high alerts, CI red on the default branch, people's PRs waiting). For each: the repo, what's wrong, and the one next step.
3. Anything under "Couldn't check", in one line each.

If `$ARGUMENTS` names an owner, only include that owner's repos. If the report is more than 30 hours old, say so first and suggest `/radar-doctor`.

Read-only. Offer hand-offs (see the dashboard skill) but don't start any without a yes.
