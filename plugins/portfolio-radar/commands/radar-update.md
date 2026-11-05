---
description: Bring the newest radar engine from the template into your private copy, as a pull request.
---

Update the engine files in the person's private radar repo from `agentic-incubator/portfolio-radar-template`. Never touch their config, reports or data. Never merge.

1. Get the repo and clone path from `node "${CLAUDE_PLUGIN_ROOT}/scripts/state.mjs" get`. In the clone, `git pull` on the default branch.
2. Read their `engine.json` (`version`, `engineFiles`). Find the newest template tag: `gh api repos/agentic-incubator/portfolio-radar-template/tags --jq '.[].name'`, highest semver. If theirs is the same or newer, say "You're up to date" and stop.
3. Fetch the template's `engine.json` at that tag. The file list to update is the **template's** `engineFiles` at the new tag (it may add files). Never write a path that appears in their `userFiles`.
4. Show a short summary: from version X to Y, which files change, and the template's release notes for the versions in between (`gh release view <tag> --repo agentic-incubator/portfolio-radar-template`, if releases exist).
5. If any engine file was edited in their copy since their last update (`git log` on that path shows commits other than engine updates), warn that the update replaces it and ask before going on.
6. On yes: branch `chore/engine-<new version>`, then for each engine file, write the template's version at the tag: `gh api "repos/agentic-incubator/portfolio-radar-template/contents/<path>?ref=<tag>" -H "Accept: application/vnd.github.raw" > <path>`. Files the template removed from `engineFiles`: list them and ask; never delete without a yes.
7. Run `node --check scripts/radar.mjs && node --test test/*.test.mjs`. If they fail, stop and show the output.
8. Commit `chore: update radar engine to <version>`, push, and open a PR with the summary. Stop. Tell them CI will run and they merge when ready.
