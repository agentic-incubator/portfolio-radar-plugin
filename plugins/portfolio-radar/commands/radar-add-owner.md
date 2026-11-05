---
description: Add a GitHub account or org to your radar, and get the install links for it.
argument-hint: "<owner>[,owner...] [--client]"
---

Add the owners in `$ARGUMENTS` to the radar. Use the radar clone path from `node "${CLAUDE_PLUGIN_ROOT}/scripts/state.mjs" get` (ask if it's missing).

1. In the clone, pull, make a branch `chore/add-owner-<name>`, and run `scripts/add-owner.sh $ARGUMENTS --app <appSlug from state>`. It adds them to `radar.config.json` and prints two links per owner.
2. Show the links. The radar app link is needed. The Claude app link is only for dashboard buttons on that owner.
3. For a client org (`--client`), draft the note in the template's `docs/setup.md` for the person to send to that org's owner.
4. On yes, commit `chore: add <owner> to radar`, push, and open a PR. Stop there; the person merges it.

The next daily run picks the owner up. Until the app is installed there, the report lists it under "Couldn't check".
