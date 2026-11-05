---
name: github-app-manifest
description: Create the read-only portfolio-radar GitHub App in one click with GitHub's manifest flow and store its ID and key as Actions secrets, without the key ever being shown. Use in setup step "app" or when the app or its secrets need replacing.
---

# The read-only GitHub App

The radar reads every owner through one GitHub App with **read-only** permissions. The manifest flow fills in every setting; the person only clicks **Create GitHub App** on GitHub.

## Run it

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/app-manifest.mjs" --repo <owner>/<radar-repo> [--org <org>] [--name <app-name>]
```

- `--org`: make the app belong to an org instead of the person's account (they must be an org owner). Default: their account. Either way it can be installed on any account they choose.
- `--name`: default `<owner>-portfolio-radar`. App names are unique across GitHub, so if GitHub says it's taken, run again with another name.

It opens a local page (127.0.0.1, random port, closes itself after). The person clicks **Continue to GitHub**, checks the permissions, and clicks **Create GitHub App**. GitHub sends them back to the local page, and the script:

1. trades GitHub's one-time code for the App ID and private key,
2. runs `gh secret set RADAR_APP_ID` and `gh secret set RADAR_APP_PRIVATE_KEY` on the radar repo, passing the key on stdin,
3. prints one JSON line: `{ ok, appId, slug, installUrl, settingsUrl }`.

The key is never printed, logged or written to disk. Run the script in the foreground and wait for that line (up to 15 minutes); then confirm with `gh secret list --repo <repo>` (names only).

## Permissions it asks for (all read-only)

Actions, Contents, Issues, Metadata, Pull requests, Code scanning alerts (`security_events`), Secret scanning alerts, Dependabot alerts (`vulnerability_alerts`), and org Projects. No webhook. The script refuses to run if any permission isn't `read`. Never change that.

The manifest sets the app to **public** ("any account can install"). That isn't about visibility of data: it only lets the person install their own app on their other accounts and orgs, and lets a client org owner install it. Installing grants nothing until someone with rights on that account picks repos. Say this in one line if they ask.

## After it's made

Send the person to `installUrl`. For each owner: pick it, choose **All repositories**, install. Then check it worked: `gh api user/installations --paginate --jq '.installations[] | select(.app_slug == "<slug>") | .account.login'` should list every owner. Say which are missing; never assume an install happened because the person said so. For an org they're only a member of, GitHub asks the org owner to approve. For a client org, draft the note in the template's `docs/setup.md` for them to send.

## If something goes wrong

| Problem | What to do |
|---|---|
| `gh secret set` failed | The app exists. Have them open `settingsUrl`, generate a new private key, and upload it straight to the repo's secret page (Settings → Secrets and variables → Actions). Never into the chat |
| Name taken | Run again with `--name` |
| They want a local copy of the key (for `scripts/installs.mjs`) | They generate one on `settingsUrl` and save it in `secrets/` in their clone, which is gitignored. Check with `git check-ignore -q secrets/key.pem` |
| No terminal | Manual steps in the template's `docs/setup.md`, sections 1 to 3 |
