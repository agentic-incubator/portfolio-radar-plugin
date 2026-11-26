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
  "dataFile": "",
  "steward": false,
  "stewardRepos": [],
  "preferRenovate": false,
  "runsWhere": "a new Claude Code task"
}
```

- `ownerName`: how Ask Claude refers to them. Their first name or "you".
- `triggerId`: the actions task's id (Full tier only). Null elsewhere.
- `dataFile`: artifact tiers in a Claude Code project only. The path, inside the project's files, of the radar data the page reads at open time (for example `radar/dashboard.json`). Empty means the page uses only its published `data.json`. See "Keeping it fresh".
- `steward`, `stewardRepos`: from system detection. Steward's own repos (for example `<login>/workstation-steward`, `<login>/workstation-steward-config`) get Ship it only.
- `preferRenovate`: from `handoff-rules.md`. When false, the "Move to Renovate" button is hidden.

## Artifact tier

Load the `artifact-design` and `artifact-capabilities` skills first if you have them. Publish `index.html` as the page with `data.json` and `config.json` as files, private to the person, icon `radar`. Capabilities the page uses, each optional: the project's files, for `dataFile` (see "Keeping it fresh"); a database (collection `actions`) for the button queue and In flight; the viewer's identity, so only the owner can approve or ship; asking Claude, for Ask Claude; and, Full tier only, calling the Claude Code Remote connector's `fire_trigger` with the `triggerId`. Grant only what the tier needs. Save the URL to state as `dashboardUrl`.

To refresh, publish again to the same URL with the new `data.json`. Never change `index.html` from the plugin's copy except through a plugin update.

## Keeping it fresh

- **Artifact tiers in a Claude Code project (preferred):** the page reads its data from the project's files, so the morning task never republishes the artifact. Publish once with the `files` capability (`{files: {project: "<the project's id>"}}`) beside the others, and `dataFile` in `config.json`. Then offer a daily scheduled task about an hour after the radar's run (the radar runs 11:23 UTC). Its job: fetch `data/dashboard.json` from the radar repo, check it's valid JSON with `schema` 1 and `generated` under 30 hours old, and copy it to `dataFile` in the project folder. If the data is stale, don't copy. The page uses the project copy when it's newer than its published `data.json`, and if it can't read it, it shows the published copy with "published copy" on the timestamp and the reason in its tooltip.
  Why: a cloud task that publishes data naming private repos is stopped by the auto mode safety check ("Sensitive Information Leakage") and waits for a tap every day, even though the artifact is private. Copying the file inside the person's own private project doesn't publish anything.
- **Artifact tiers elsewhere:** the same daily task, but it republishes `data.json` to the artifact instead of copying it. Read the published `data.json` first (or name it in `overwrite_unread`), or the publish is refused. Expect the safety check above to ask for a tap when the data names private repos.
- **Full tier:** also a second task, started by the buttons, whose prompt runs `/radar-actions` on the queue. Put its id in `config.json` as `triggerId` and republish.
- **HTML tier:** re-run `/radar-dashboard html` to rebuild the file. Offer to do that as part of `/radar-report`.

## Rules for the buttons

Every hand-off follows the `handoff-rules` skill: open a PR and stop. Only Ship it and Ship all merge, only for the owner, only if the head is unchanged and every check is green now. Sweep all is a hand-off (one PR per repo, never merges); it sends the radar's advisory data with the request, takes 5 repos per run and starts the next run itself until every repo has a result. Couldn't check shows security features that are switched off apart from real read failures, with copy buttons for the commands and for `/radar-coverage`, which turns them on with the person's own `gh` login. Ship all and Sweep all each list everything in a confirmation first and report each item's result under In flight.
