---
name: radar-config
description: Write and check radar.config.json for a portfolio-radar repo (owner, owners, client orgs, goal repos, ignore list, noise). Use when setting up, adding goals or owners, or when the report shows a config problem.
---

# radar.config.json

Lives at the root of the person's private radar repo. It's theirs: `/radar-update` never touches it.

| Key | Meaning | Wizard default |
|---|---|---|
| `owner` | The main account. Just me and consultants: their GitHub login. Product team watching only the team's org: that org. Required: the radar stops without it | Login, or the team's org |
| `owners` | Accounts and orgs they run, including their own login | Everything they ticked |
| `clientOwners` | Client orgs, marked as client work | Consultants only |
| `includePrivate` | Include private repos | `true` |
| `staleDays` | No push for this many days counts as drift | `90` |
| `lookbackHours` | Window for "changed" | `24` |
| `maxPrsListed` | Max people's PRs per repo in "needs you" | `10` |
| `goalRepos` | `{ "Goal (date)": ["repo", "owner/repo"] }` | `{}` |
| `ignoreRepos` | Repo names to skip | `[]` |
| `noise` | `{ "archived": true, "forks": true }` | both `true` |
| `activeForks` | Forks that are really their own work | `[]` |
| `metrics` | Optional (engine 0.5.0+). `enabled`, `weekday` (UTC, 1 = Monday) for the weekly fields, `activeForkMonths`, `loc` (weekly shallow clone to count lines of code, about 10 to 15 Actions minutes a week for 120 repos), `packages` (`{ "repo": ["npm:name", "crates:name", "pypi:name", "dockerhub:ns/repo"] }` for packages the radar can't find itself), `ignorePackages` | Leave it out: everything on, Monday, 6 months. Write `{ "loc": false }` only if they turn line counts off |

## Checks before writing

- `owner` is set and is in `owners`.
- No owner appears in both `owners` and `clientOwners`. Names compare case-insensitively.
- Every `goalRepos` entry names a repo that exists (`gh repo view`). Unknown ones: ask, don't drop silently.
- Keep 2-space JSON and a trailing newline.

Commit config changes on a branch with a PR once the repo has CI; the very first config commit during setup goes straight to the new repo's default branch.

## Privacy

Client org names and goal names appear only in this private repo. Don't copy them into the plugin, the template, issues, or anywhere public.
