---
description: Gather every open radar loop (PRs, stopped requests, waiting decisions, and open radar threads in a Claude project) into one de-duplicated action list, then close the old threads with your yes.
argument-hint: "[owner filter]"
---

Follow the `radar-triage` skill.

If `$ARGUMENTS` names an owner, only include that owner's repos and say so in the first line.

Read-only until step 5. Closing old threads or duplicate PRs waits for the person's yes; merging stays with Ship it.
