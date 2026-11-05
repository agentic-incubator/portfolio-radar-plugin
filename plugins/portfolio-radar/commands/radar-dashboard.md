---
description: Publish or refresh your portfolio radar dashboard, in the best form your account supports.
argument-hint: "[artifact | html]"
---

Publish the dashboard with the `dashboard` skill. Get the radar repo from `node "${CLAUDE_PLUGIN_ROOT}/scripts/state.mjs" get` (ask if missing).

1. Pick the tier (the skill explains each). If `$ARGUMENTS` says `artifact` or `html`, use that. Otherwise: if you have the Artifact tool, use **artifact**; else **html**. Say which one and why, in one line.
2. Fetch today's data: `gh api repos/<repo>/contents/data/dashboard.json -H "Accept: application/vnd.github.raw" > <scratch>/data.json`. If it's missing, say the first daily run hasn't finished and stop.
3. Write `config.json` from state and the person's answers (skill, "config.json").
4. Publish:
   - **artifact**: follow the skill's "Artifact tier". Save the artifact URL to state as `dashboardUrl`.
   - **html**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-dashboard.mjs" --data <scratch>/data.json --config <scratch>/config.json --out <clone>/dashboard.html`. Make sure `dashboard.html` is in the clone's `.gitignore` before writing it (add the line if not, and tell them). Then tell them to open it in a browser. Save `dashboardFile` to state.
5. Offer the morning refresh (skill, "Keeping it fresh"). Set it up only on yes.

Never put the data or the page anywhere public. The artifact stays private to its owner.
