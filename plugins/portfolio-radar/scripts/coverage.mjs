#!/usr/bin/env node
// Turns GitHub's security features on where the radar found them off, the way a Renovate estate wants them:
//   Dependabot alerts            on for every active repo (Renovate reads them to raise security PRs at once)
//   Dependabot security updates  off where Renovate runs (it would open duplicate PRs), on where it doesn't yet
//   Secret scanning + push protection, CodeQL default setup   on for public repos only (free there; paid on private)
//
//   node coverage.mjs plan  --data <dashboard.json> [--skip <o/r,...>]
//   node coverage.mjs apply --data <dashboard.json> [--skip <o/r,...>] --yes
//
// Runs on the person's machine with their own `gh` login, because these are repo settings that need admin rights;
// the radar's app and the Claude app never get them. `plan` changes nothing. `apply` runs each step once, carries on
// past failures and reports each one. It never deletes a repo, a branch or an alert.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const usesRenovate = (r) => !!r?.updaters?.tools?.includes("renovate");

// Pure: the steps for one dashboard.json. Each step is { repo, what, args } where args are the `gh` arguments.
export function coveragePlan(data, { skip = [] } = {}) {
  const cov = data?.coverage;
  if (!cov) return { steps: [], held: [], note: "This radar data has no coverage list (engine 0.7.0 or later adds it)." };
  const repos = new Map((data.repos ?? []).map((r) => [r.fullName, r]));
  const skipped = new Set(skip.map((s) => s.toLowerCase()));
  const steps = [], held = [];
  const add = (repo, what, args) => (skipped.has(repo.toLowerCase()) ? held.push({ repo, what, why: "left out (--skip)" }) : steps.push({ repo, what, args }));
  for (const { repo } of cov.dependabot ?? []) add(repo, "Dependabot alerts on", ["api", "-X", "PUT", `repos/${repo}/vulnerability-alerts`]);
  // Security updates need alerts on, so they come after every alerts step. Every active repo gets the right state,
  // not only the ones with alerts off, because a Renovate repo with security updates on gets duplicate PRs.
  for (const r of data.repos ?? []) {
    if (!r.fullName || r.readable === false || !r.updaters) continue;
    if (usesRenovate(r)) add(r.fullName, "Dependabot security updates off (Renovate handles them)", ["api", "-X", "DELETE", `repos/${r.fullName}/automated-security-fixes`]);
    else add(r.fullName, "Dependabot security updates on (until it moves to Renovate)", ["api", "-X", "PUT", `repos/${r.fullName}/automated-security-fixes`]);
  }
  for (const { repo, private: priv } of cov.secretScanning ?? []) {
    if (priv) { held.push({ repo, what: "secret scanning", why: "private repo: needs GitHub Secret Protection (paid)" }); continue; }
    add(repo, "Secret scanning and push protection on", ["api", "-X", "PATCH", `repos/${repo}`, "-f", "security_and_analysis[secret_scanning][status]=enabled", "-f", "security_and_analysis[secret_scanning_push_protection][status]=enabled"]);
  }
  for (const { repo, private: priv } of cov.codeScanning ?? []) {
    if (priv) { held.push({ repo, what: "code scanning", why: "private repo: needs GitHub Code Security (paid)" }); continue; }
    add(repo, "CodeQL default setup on", ["api", "-X", "PATCH", `repos/${repo}/code-scanning/default-setup`, "-f", "state=configured"]);
  }
  for (const s of steps) if (!repos.has(s.repo) && !s.what.startsWith("Dependabot alerts")) s.note = "not in today's active repos";
  return { steps, held, note: null };
}

// Plain words for the usual refusals, so the report says what to do instead of echoing an HTTP error.
export function explain(stderr) {
  const m = String(stderr || "");
  if (/no (supported|analyzable) languages|languages? .* not supported|CodeQL .* not supported/i.test(m)) return "CodeQL supports none of this repo's languages";
  if (/must have admin|Must have admin rights|admin access/i.test(m)) return "your gh login isn't an admin of this repo";
  if (/Advanced Security/i.test(m)) return "needs GitHub Advanced Security (paid) on this repo";
  if (/archived/i.test(m)) return "the repo is archived";
  if (/HTTP 404|Not Found/i.test(m)) return "not found from your gh login";
  return m.trim().split("\n").pop()?.slice(0, 160) || "failed";
}

function summary(plan) {
  const by = new Map();
  for (const s of plan.steps) by.set(s.what, (by.get(s.what) ?? 0) + 1);
  return [...by.entries()].map(([w, n]) => `${n} × ${w}`);
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
  const dataPath = opt("--data");
  if (!["plan", "apply"].includes(cmd) || !dataPath) {
    console.error("usage: coverage.mjs plan|apply --data <dashboard.json> [--skip o/r,...] [--yes]");
    process.exit(2);
  }
  const plan = coveragePlan(JSON.parse(readFileSync(dataPath, "utf8")), { skip: (opt("--skip") ?? "").split(",").filter(Boolean) });
  if (plan.note) { console.log(plan.note); return; }
  if (cmd === "plan" || !rest.includes("--yes")) {
    console.log(JSON.stringify({ summary: summary(plan), steps: plan.steps.map(({ repo, what }) => ({ repo, what })), held: plan.held }, null, 2));
    if (cmd === "apply") console.log("Nothing changed: add --yes to apply.");
    return;
  }
  const results = [];
  for (const s of plan.steps) {
    const r = spawnSync("gh", s.args, { encoding: "utf8" });
    results.push({ repo: s.repo, what: s.what, ok: r.status === 0, why: r.status === 0 ? null : explain(r.stderr || r.stdout) });
  }
  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ done: results.length - failed.length, failed, held: plan.held }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main(process.argv.slice(2));
