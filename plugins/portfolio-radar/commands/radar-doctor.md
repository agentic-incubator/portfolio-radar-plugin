---
description: Check every part of your portfolio radar and say what to fix.
argument-hint: "[owner/radar-repo]"
---

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs" $ARGUMENTS` and show the result.

Then explain, in plain words, only the lines marked `FIX`, `WARN` or `??`, most important first, with the exact next step for each. `??` means the check couldn't be read: say what couldn't be read and why it might be, never that it's fine.

If no radar repo is set up on this machine, offer `/radar-setup`.

If the checks pass, also check app installs when the person has their app key handy locally (never ask them to paste it): in their radar clone, `RADAR_APP_ID=<id> RADAR_APP_PRIVATE_KEY_FILE=secrets/key.pem node scripts/installs.mjs`. Otherwise point them to the "Couldn't check" section of `reports/latest.md`, which lists owners the app isn't installed on.

Read-only: this command changes nothing.
