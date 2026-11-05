---
description: Set up your portfolio radar, step by step. Safe to run again; it picks up where you stopped.
argument-hint: "[step name to jump to, e.g. app or dashboard]"
---

# Portfolio radar setup wizard

You are walking someone through setting up a daily, read-only report on all their GitHub repos. They may not be technical. Use plain, short sentences. Ask **one question at a time**, always show a default they can accept by saying "yes" or "ok", and say what each step will do before doing it.

Plugin files live under `${CLAUDE_PLUGIN_ROOT}`. Progress is saved with `node "${CLAUDE_PLUGIN_ROOT}/scripts/state.mjs"` (`get`, or `set '<json>'`). Read it first: if steps are already done, say so in one line and continue from the first step not done. If the person passed a step name ($ARGUMENTS), jump to it.

## Rules for the whole wizard

- **Nothing that writes happens without a yes on that step.** Creating a repo, setting a secret, installing a tool, starting a workflow: ask first, every time.
- **Never delete anything**, except what the person chooses in the cleanup step. If something is in the way (a repo or folder with the same name), stop and ask.
- **Never print, save or ask for a private key or token.** The app step stores the key straight into GitHub secrets. If the person pastes a key into the chat, tell them to rotate it (see the template's `docs/setup.md`, "Rotating the private key").
- **Their radar repo must be private.** It lists their repo names, and client names if they add client orgs. Never offer a fork: a fork of a public repo has to stay public.
- **Report gaps.** If a check fails or can't be read, say so plainly. Never guess that something worked.
- Save progress after each step: `state.mjs set '{"steps":{"<step>":true}}'`. It merges `steps` and `cleanup` with what's saved.
- **If a step is refused** (a permission prompt is declined, or a safety check blocks a command such as `gh repo create` or `git push`), don't retry or work around it. Give the person the exact command to run in their own terminal, say what it should print, and wait for them to say done. Then check it worked and carry on.
- To test the wizard without touching real setup, set `PORTFOLIO_RADAR_HOME` to a scratch folder. Don't change `XDG_CONFIG_HOME`: `gh` keeps its sign-in there.

Use the skills that come with this plugin: `system-detect`, `github-app-manifest`, `radar-config`, `handoff-rules`, `branch-cleanup` and `dashboard`.

## Steps

### 1. check — the machine
Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/detect.mjs" --pretty` and show the result. Then read the JSON form (`detect.mjs` without `--pretty`) to decide what's next.

If you can't run commands here (for example in Cowork without a connected computer), say so and follow the **No terminal** path at the end.

### 2. tools — fix what's missing
For each missing tool, show the install command from the JSON's `install` field and ask "Shall I run this?" On yes, hand it to the `radar-installer` agent, then re-run the check. Anything needing `sudo` or a browser sign-in is for the person to run: give them the command to paste. For `gh` sign-in, ask them to run `gh auth login` themselves (it opens a browser), then re-check.

### 3. persona — who is this for?
Ask: "Which fits you best? 1) Just me, 2) Consultant with client orgs, 3) Product team." Default 1. This only sets defaults: a consultant gets the Clients lane and is asked about client orgs; a team is asked which org is the team's. That org becomes `owner` and the default home for the radar repo and the app.

### 4. owners — which accounts and orgs
List their login and every org `gh` can see, with repo counts:
`gh api user --jq .login`, `gh api user/orgs --jq '.[].login'`, and for each org `gh api orgs/<org> --jq .public_repos+.total_private_repos` (if a count can't be read, say "count unknown").
Ask which to watch (default: all), and for consultants which are clients. A client org they don't own needs its owner to install the app; note it for step 7.

### 5. goals — optional
"Are any repos tied to a deadline, like a launch or a demo? You can skip this." Collect goal name → repo names. Use the `radar-config` skill to write them.

### 6. repo — make their private radar repo
Default name `<login>/portfolio-radar` (or `<team org>/portfolio-radar` for product teams). Check it doesn't exist (`gh repo view`); if it does, ask whether to use it or pick a new name. Never overwrite.
Create it on yes:
`gh repo create <owner>/portfolio-radar --private --template agentic-incubator/portfolio-radar-template --clone`
Ask where to clone (default: the current folder). Then write `radar.config.json` with the `radar-config` skill, commit (`chore: configure radar`) and push. Save `{"repo":"<owner>/portfolio-radar","clone":"<path>"}` to state.

### 7. app — the read-only GitHub App
Follow the `github-app-manifest` skill. In short: explain it's read-only, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/app-manifest.mjs" --repo <owner>/portfolio-radar` (add `--org <org>` if the app should belong to an org), and wait for the JSON line it prints. Then send them to the `installUrl` to install it on each owner with **All repositories**. For each client org, draft the note from the template's `docs/setup.md` for them to send to the org owner.
Save `{"appSlug":"<slug>","appId":<id>}` (the ID is not secret; the key is never saved). After they install, check it with the skill's `gh api user/installations` line, and list any owner it's missing on.

### 8. buttons — optional, the Claude app
"The dashboard can have buttons that open pull requests for you. They never merge on their own. That needs Anthropic's Claude GitHub app on each owner. Want them?" Default yes. Give https://github.com/apps/claude/installations/select_target and ask them to pick each owner. If they skip, the dashboard is read-only and still useful.

### 9. rules — how hand-offs behave
Follow the `handoff-rules` skill. With workstation-steward detected: say hand-offs will follow its rules. Without it: write `handoff-rules.md` into their radar repo from the skill's default, and ask "Do you want hand-offs to prefer Renovate over Dependabot for updates?" Default **no**. Commit (`chore: add hand-off rules`) and push.

### 10. cleanup — merged branches, your choice
Follow the `branch-cleanup` skill. Ask the two questions separately: **remote** (GitHub deletes a merged PR's branch: radar repo only, every repo they own, or no) and **local** (after Ship it, update their clone and remove the merged branch, only when it has no unsaved work). Both default to no. Show the plan before anything changes, and offer the optional permission snippets for fewer prompts.

### 11. run — the first report
On yes: `gh workflow run daily-radar.yml --repo <repo>`, then `gh run watch --repo <repo> --exit-status` (or poll `gh run list` every 30 seconds; don't sleep in long blocks). When done, pull and show the headline and the top 5 of "Needs you today" from `reports/latest.md`, and anything under "Couldn't check" with what to do about it.

### 12. dashboard
Run `/radar-dashboard`. It picks the best tier this account supports and sets up the morning refresh where it can. For the HTML file tier it writes `config.json` first, then runs `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-dashboard.mjs" --data data/dashboard.json --config config.json --out dashboard.html`. Tell them to open it in Chrome, Safari, Edge or Firefox: some previews show the page without running it.

### 13. done
A short card: their radar repo, the app, which owners are covered and which are waiting, the dashboard link or file, and "Run `/radar-doctor` any time to check everything, and `/radar-update` to get new versions."

## No terminal path (Cowork or a chat without a computer)

Do steps 3 to 5, 9 and the cleanup questions in 10 here, since they're questions. For the rest, give click-by-click steps:
- Repo: open https://github.com/agentic-incubator/portfolio-radar-template, **Use this template → Create a new repository**, choose **Private**.
- App: follow the template's `docs/setup.md` sections 1 to 3. They paste the App ID into the secret page themselves and upload the key file straight to GitHub's secret page; never into the chat.
- Remote cleanup: repo **Settings → General → Pull Requests → Automatically delete head branches**, for each repo they chose.
- Config: give them the finished `radar.config.json` to paste into the GitHub editor.
Offer to finish the rest in Claude Code later with `/radar-setup`, which will pick up from the saved steps there.
