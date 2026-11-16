---
name: dashboard
description: How the portfolio-radar mission-control dashboard works, its three tiers (claude.ai artifact with buttons, artifact without scheduled tasks, single HTML file), its config.json, and how to publish and refresh it. Use for /radar-dashboard, /radar-actions, or any dashboard question.
---

# The dashboard

`${CLAUDE_PLUGIN_ROOT}/dashboard/index.html` is the page. It reads two files beside it: `data.json` (the radar's `data/dashboard.json`) and `config.json` (the person's settings). A built single-file copy carries both inline instead. `sample-data.json` is made-up data for previews.

## Tiers

| Tier | When | Buttons |
|---|---|---|
| **Full** | Artifact tool available, and the person wants scheduled tasks (Claude Code on the web / claude.ai) | Queue to the artifact's database, then start the actions task. Ask Claude answers in the page |
| **Artifact only** | Artifact tool, no scheduled tasks | Queue only; `/radar-actions` runs the queue |
| **HTML file** | No Artifact tool, or they prefer a local file | Copy a `/radar-actions '<json>'` line to paste into Claude Code |

The page detects what it has at run time, so the same file serves every tier.

The footer shows the credit line, the plugin version (`PLUGIN_VERSION` in `index.html`, bumped with the manifests) and the engine version from `data.json`'s `engine` (engine 0.4.0 and later). With an older engine it says the version isn't reported and suggests `/radar-update`.

## Section menu

The page shows one section at a time. It opens on **Overview** (the scope, vitals and today's moves); a menu at the top switches sections, grouped by what you do next:

| Group | Sections |
|---|---|
| Start | Overview |
| Act now | Needs you, Ready to ship, In flight |
| Clean up in bulk | One fix, many repos, Dependency bots, Noise |
| Keep an eye on | Goals, Clients, Metrics, Drift |
| Today's read | Couldn't check |

Each tab shows a count. The owner filters and search apply everywhere, vitals included: with a filter on, each vital counts only the repos in view and says how many there are across all owners, and the sparklines and day-on-day changes are hidden because history is kept for all repos only. `#<section>` at the end of the page's address opens that section (for example `#metrics`, `#flight`). In flight is a fixed-height table that shows about 10 rows and scrolls the rest; click a column (When, Action, Repo, Status) to sort, and the sort is remembered in the browser.

## Metrics section

With engine 0.5.0 or later, each repo in `data.json` carries `metrics`, and the page shows a Metrics table: stars, forks (active and all), open issues, PRs closed (merged), lines of code, downloads for 7 days, 30 days and 6 months, last commit and created date. Click a column to sort; the sort is remembered in the browser. "?" means unread (never 0), "-" means the repo ships nothing countable, and "since <date>" means a download window isn't full yet. The lines-of-code column is hidden when no repo has a count (`metrics.loc: false`). With an older engine the section says to run `/radar-update`. What each number means is in the template's `docs/how-it-works.md#metrics`.

## config.json

```json
{
  "ownerName": "Sam",
  "radarRepo": "octo-user/portfolio-radar",
  "triggerId": null,
  "steward": false,
  "stewardRepos": [],
  "preferRenovate": false,
  "runsWhere": "a new Claude Code task"
}
```

- `ownerName`: how Ask Claude refers to them. Their first name or "you".
- `triggerId`: the actions task's id (Full tier only). Null elsewhere.
- `steward`, `stewardRepos`: from system detection. Steward's own repos (for example `<login>/workstation-steward`, `<login>/workstation-steward-config`) get Ship it only.
- `preferRenovate`: from `handoff-rules.md`. When false, the "Move to Renovate" button is hidden.

## Artifact tier

Load the `artifact-design` and `artifact-capabilities` skills first if you have them. Publish `index.html` as the page with `data.json` and `config.json` as files, private to the person, icon `radar`. Capabilities the page uses, each optional: a database (collection `actions`) for the button queue and In flight; the viewer's identity, so only the owner can approve or ship; asking Claude, for Ask Claude; and, Full tier only, calling the Claude Code Remote connector's `fire_trigger` with the `triggerId`. Grant only what the tier needs. Save the URL to state as `dashboardUrl`.

To refresh, publish again to the same URL with the new `data.json`. Never change `index.html` from the plugin's copy except through a plugin update.

## Keeping it fresh

- **Artifact tiers:** offer a daily scheduled task about an hour after the radar's run (the radar runs 11:23 UTC). Its job: fetch `data/dashboard.json` from the radar repo, check `generated` is under 30 hours old, and republish `data.json` to the artifact. If the data is stale, don't publish; the page turns its timestamp amber after 30 hours by itself.
- **Full tier:** also a second task, started by the buttons, whose prompt runs `/radar-actions` on the queue. Put its id in `config.json` as `triggerId` and republish.
- **HTML tier:** re-run `/radar-dashboard html` to rebuild the file. Offer to do that as part of `/radar-report`.

## Rules for the buttons

Every hand-off follows the `handoff-rules` skill: open a PR and stop. Only Ship it and Ship all merge, only for the owner, only if the head is unchanged and every check is green now. Ship all lists every PR in a confirmation first and reports each PR's result (merged, skipped and why, or failed) under In flight.
