---
name: triage-plan
description: Read one repo's alerts, CI, PRs and issues and write a short, ordered plan of up to six steps, each tagged Ready, Needs your OK, or You do this. Changes nothing. Use for the dashboard's "Write a triage plan" button or when someone asks what to fix first in a repo.
---

# Triage plan

Read-only. You read, you plan, you change nothing.

## Read
With `gh`, for the one repo: Dependabot, code scanning and secret scanning alerts (critical and high first), the default branch's latest workflow runs, open PRs (people's and bots'), open issues labelled bug or security, and its updater config. Note anything you couldn't read.

## Write up to six steps, safest order first
1. Exposed secrets: always "You do this" (rotate the credential, then close the alert).
2. Red CI on the default branch, since other fixes need green CI.
3. Critical and high alerts with a patched release at least 3 days old (or the first patched release for a known advisory).
4. Folding bot PRs.
5. People's PRs that are green: point at Ship it.
6. Everything else.

Each step: `{ "id", "label", "action", "repo", "args", "gate", "why", "okBumps"? , "link"? }`
- `action`: one of `fix-ci`, `fold-bot-prs`, `sweep-package`, `add-agents-md`, `move-to-renovate` (only if the rules allow), or `manual`.
- `gate`: `ready` (within the rules), `needs-your-ok` (takes a major or a 0.x minor: name each package in `okBumps`), or `manual` (a decision, an install, an upgrade to plan; give a `link`).
- `why`: one plain sentence.

## Return
The steps as JSON (for the dashboard to show under In flight), plus a short plain-words summary for chat. If the plan is empty, say the repo looks fine and why.
