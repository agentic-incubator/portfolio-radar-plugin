# portfolio-radar-plugin

A Claude Code plugin that sets up a **daily, read-only report on every repo you have on GitHub**, across your account, your orgs and your client orgs, plus a mission-control dashboard with buttons that open pull requests for you and never merge on their own.

For solo devs, agentic engineers, consultants and product teams with more repos than they can keep an eye on.

## Install

In Claude Code:

```
/plugin marketplace add agentic-incubator/portfolio-radar-plugin
/plugin install portfolio-radar@portfolio-radar
/radar-setup
```

The wizard takes about 20 minutes. It checks your machine and offers to install anything missing, makes your own **private** radar repo from [the template](https://github.com/agentic-incubator/portfolio-radar-template), creates a read-only GitHub App in one click, asks whether you want merged branches cleaned up, runs the first report and sets up the dashboard. It asks before every step that changes anything.

## Commands

| Command | What it does |
|---|---|
| `/radar-setup` | The guided setup. Safe to run again; it picks up where you stopped |
| `/radar-doctor` | Checks tools, sign-in, your radar repo, secrets, the last run, dashboard freshness and engine version |
| `/radar-add-owner` | Adds an account or org and gives you its install links |
| `/radar-report` | Today's top moves, in plain words |
| `/radar-update` | Brings the newest engine into your copy as a pull request |
| `/radar-dashboard` | Publishes or refreshes the dashboard: a private claude.ai artifact, or a single HTML file |
| `/radar-actions` | Runs dashboard button requests: hand-offs, triage plans, approved steps, Ship it |

Skills: `system-detect`, `github-app-manifest`, `radar-config`, `handoff-rules`, `branch-cleanup`, `dashboard`, `triage-plan`. Agents: `radar-installer`, `repo-handoff`, `portfolio-analyst`. A session-start hook says one line if your radar needs attention, and stays quiet otherwise.

## How it fits together

| Piece | Where | Holds |
|---|---|---|
| This plugin | Public, here | Commands, skills, agents |
| [portfolio-radar-template](https://github.com/agentic-incubator/portfolio-radar-template) | Public | The radar engine. No data |
| Your radar repo | **Private**, yours | Your config, daily reports and data |

Your copy is made from the template, not forked: a fork of a public repo has to stay public, and your report lists your repo names. `/radar-update` pulls new engine versions into it as a pull request.

## The dashboard

A dark mission-control page: every repo as a dot on a radar scope (closer to the centre needs you sooner), vitals with 60-day sparklines, today's moves, and lanes for what needs you, what's ready to ship, one fix across many repos, bots, goals, clients, noise and drift. It comes in three forms, and `/radar-dashboard` picks the best one your account supports:

| Form | Buttons |
|---|---|
| Private claude.ai artifact with scheduled tasks | Press a button and Claude runs it in the cloud |
| Private claude.ai artifact | Buttons queue requests; `/radar-actions` runs them |
| One HTML file on your computer | Buttons give you a line to paste into Claude Code |

Preview it with made-up data: `node plugins/portfolio-radar/scripts/build-dashboard.mjs --out preview.html`, then open `preview.html`.

## Safety

- The radar's GitHub App is **read-only**. The plugin refuses to create it with any write permission.
- Your app's private key goes from GitHub straight into your repo's Actions secrets. It's never shown, logged or saved.
- Buttons that change things use Anthropic's Claude GitHub app, open a PR and stop. Only "Ship it", pressed by you, merges, and only if the PR is unchanged and green.
- Nothing is installed without your yes, and nothing is deleted unless you chose it.

## Branch cleanup (your choice)

Setup asks two separate questions. Both default to no.

| Choice | What happens |
|---|---|
| **Remote** | Turns on GitHub's "Automatically delete head branches" for your radar repo, or every repo you own. GitHub then removes a PR's branch once it merges. Client orgs are left alone |
| **Local** | After Ship it, brings your clone up to date and removes the merged branch with `git branch -d` and any clean worktree for it. It stops if your clone has unsaved work, and never forces anything |

`/radar-doctor` flags it if you chose remote cleanup and it's off. Change your mind any time with `/radar-setup cleanup`.

## With or without workstation-steward

If you use [workstation-steward](https://github.com/pacphi/workstation-steward), hand-offs follow its rules. If not, the plugin writes an editable `handoff-rules.md` into your radar repo: 3-day release age, majors held back, and an option (off by default) to prefer Renovate over Dependabot.

## Claude Code and Cowork

Claude Code does everything. In Cowork, the plugin handles the questions, config and dashboard, and gives click-by-click steps for what needs a terminal; you can finish those later in Claude Code with `/radar-setup`.

## License

MIT. See [LICENSE](LICENSE).

Built with ❤️ by Chris Phillipson, Principal, CP Ventures Group, LLC
