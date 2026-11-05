# Removing a radar

Use this to take a radar down completely, for example after a test run or to demo `/radar-setup` again from scratch. The plugin never deletes anything for you, so this is a checklist for you to run.

## What lives where

A radar has four separate pieces. Removing one doesn't remove the others.

| Piece | Where it is | Removed by deleting the repo? |
|---|---|---|
| Radar repo: workflows, reports, data, and the `RADAR_APP_ID` / `RADAR_APP_PRIVATE_KEY` secrets | `<owner>/portfolio-radar` | Yes |
| GitHub App registration and its private keys | The account or org that created it: **Settings → Developer settings → GitHub Apps** | **No** |
| App installs (which accounts it can read) | Each account or org it's installed on: **Settings → GitHub Apps** (Installed) | **No** |
| The plugin's setup state on your computer | `~/.config/portfolio-radar/state.json`, or `%APPDATA%\portfolio-radar` on Windows, or `$PORTFOLIO_RADAR_HOME` if you set it | No |

Deleting the repo removes the only copy of the key that the plugin made, so a leftover app can't read anything unless someone generates a new key. Still delete the app if you want a clean slate.

## Steps

Run these in order. Each one is safe to skip if that piece was never created.

1. **Check you have the right one.** Make sure the owner, repo and app slug are the ones you mean. These steps can't be undone.

2. **Delete the radar repo.** On the repo, open **Settings → General → Danger Zone → Delete this repository**. Or use the command line:
   ```bash
   gh auth refresh -h github.com -s delete_repo   # one time; gh asks you to confirm in the browser
   gh repo delete <owner>/portfolio-radar          # asks you to type the name
   ```

3. **Delete the GitHub App.** Open the app's **Advanced** page:
   - App owned by an org: `https://github.com/organizations/<org>/settings/apps/<slug>/advanced`
   - App owned by you: `https://github.com/settings/apps/<slug>/advanced`

   Then click **Delete GitHub App**. This also uninstalls it everywhere and revokes all its keys. Its slug becomes free to use again.

   If you'd rather keep the app and only stop it reading one account, uninstall it there instead: **Settings → GitHub Apps → Configure → Uninstall**.

4. **Check it's gone.** `gh api user/installations --jq '.installations[].app_slug'` should no longer list the slug. `gh repo view <owner>/portfolio-radar` should say the repo can't be found.

5. **Clean up your computer.** These live only on your machine:
   - Any clone of the radar repo. Move it to the Trash.
   - The setup state. Open `state.json` first and check the `repo` it names. Only remove it if it belongs to the radar you're taking down. If you used `PORTFOLIO_RADAR_HOME` for a test run, remove that folder instead and leave your real state alone.
   - Any key file you saved yourself, such as `secrets/key.pem` in a clone.

6. **Remove the dashboard.** If `/radar-dashboard` made one, take it down too:
   - A claude.ai artifact: delete it from your artifacts.
   - A scheduled refresh: delete it from your routines.
   - An HTML file: move it to the Trash.

## Demoing setup again

After the steps above, `/radar-setup` starts fresh. To keep your real setup untouched during a demo, run it with a scratch state folder:

```bash
export PORTFOLIO_RADAR_HOME="$(mktemp -d)"
```

Don't change `XDG_CONFIG_HOME` for this. `gh` keeps its sign-in there, and it would look signed out.
