# Hand-off rules

The portfolio-radar dashboard's buttons follow these rules when they open PRs in your repos. Edit them to suit you; this file is yours and updates never overwrite it.

## Updates

- **Release age:** only take releases at least **3 days** old. Exception: the first patched release for a security advisory listed in the GitHub Advisory Database, RustSec or OSV.
- **Majors and 0.x minors:** held back and listed, never taken, unless you approved that package on a triage-plan step marked "Needs your OK". Your OK covers that step only.
- **Updater:** prefer-renovate: false
  - When `true`, a hand-off may add a Renovate config and turn off Dependabot version updates (Dependabot alerts stay on). Superseded Dependabot PRs are closed with "Superseded by #N."
  - When `false`, hand-offs leave each repo's updater as it is. The report still shows repos running both.

## Always

- Work in a fresh clone, open a PR, and stop. Only Ship it merges.
- Never close a Renovate PR by hand.
- Never skip or disable a test to get CI green.
- No AI co-author trailer in commits.

## Repos to leave alone

List repos here (one per line, `owner/name`) that hand-offs should never change. Ship it still works on them.
