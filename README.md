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

The wizard takes about 20 minutes. It checks your machine and offers to install anything missing, makes your own **private** radar repo from [the template](https://github.com/agentic-incubator/portfolio-radar-template), creates a read-only GitHub App in one click, runs the first report and sets up the dashboard. It asks before every step that changes anything.

## Commands

| Command | What it does |
|---|---|
| `/radar-setup` | The guided setup. Safe to run again; it picks up where you stopped |
| `/radar-doctor` | Checks tools, sign-in, your radar repo, secrets, the last run, dashboard freshness and engine version |
| `/radar-add-owner` | Adds an account or org and gives you its install links |
| `/radar-report` | Today's top moves, in plain words |
| `/radar-update` | Brings the newest engine into your copy as a pull request |
| `/radar-dashboard` | Publishes or refreshes the dashboard *(coming in the next release)* |

Skills: `system-detect`, `github-app-manifest`, `radar-config`, `handoff-rules`. Agents: `radar-installer`, `repo-handoff`, `portfolio-analyst`. A session-start hook says one line if your radar needs attention, and stays quiet otherwise.

## How it fits together

| Piece | Where | Holds |
|---|---|---|
| This plugin | Public, here | Commands, skills, agents |
| [portfolio-radar-template](https://github.com/agentic-incubator/portfolio-radar-template) | Public | The radar engine. No data |
| Your radar repo | **Private**, yours | Your config, daily reports and data |

Your copy is made from the template, not forked: a fork of a public repo has to stay public, and your report lists your repo names. `/radar-update` pulls new engine versions into it as a pull request.

## Safety

- The radar's GitHub App is **read-only**. The plugin refuses to create it with any write permission.
- Your app's private key goes from GitHub straight into your repo's Actions secrets. It's never shown, logged or saved.
- Buttons that change things use Anthropic's Claude GitHub app, open a PR and stop. Only "Ship it", pressed by you, merges, and only if the PR is unchanged and green.
- Nothing is deleted. Nothing is installed without your yes.

## With or without workstation-steward

If you use [workstation-steward](https://github.com/pacphi/workstation-steward), hand-offs follow its rules. If not, the plugin writes an editable `handoff-rules.md` into your radar repo: 3-day release age, majors held back, and an option (off by default) to prefer Renovate over Dependabot.

## Claude Code and Cowork

Claude Code does everything. In Cowork, the plugin handles the questions, config and dashboard, and gives click-by-click steps for what needs a terminal; you can finish those later in Claude Code with `/radar-setup`.

## License

MIT. See [LICENSE](LICENSE).

Built with ❤️ by Chris Phillipson, Principal, CP Ventures Group, LLC
