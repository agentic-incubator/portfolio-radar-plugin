#!/usr/bin/env node
// Health check for a portfolio-radar setup. Read-only: it only reads from GitHub through `gh`.
//   node doctor.mjs [--repo <owner>/<radar-repo>] [--json] [--quiet]
// --quiet prints nothing when everything is fine (used by the SessionStart hook).
// Anything it can't read is reported as "couldn't check", never as fine.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { detect } from "./detect.mjs";
import { readState } from "./state.mjs";

const TEMPLATE = "agentic-incubator/portfolio-radar-template";
const STALE_HOURS = 30;

function gh(args, timeout = 20000) {
  const r = spawnSync("gh", args, { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"] });
  if (r.error || r.status !== 0) return { ok: false, err: (r.stderr || r.error?.message || "").trim().split("\n")[0] };
  return { ok: true, out: r.stdout.trim() };
}
const ghJson = (args) => {
  const r = gh(args);
  if (!r.ok) return r;
  try { return { ok: true, data: JSON.parse(r.out) }; } catch { return { ok: false, err: "unreadable reply" }; }
};

// One check = { name, status: "ok" | "warn" | "fail" | "unknown", detail, fix? }
export function freshness(generatedIso, now = Date.now()) {
  if (!generatedIso) return { status: "unknown", detail: "no generated time in data/dashboard.json" };
  const hours = (now - Date.parse(generatedIso)) / 3600e3;
  if (Number.isNaN(hours)) return { status: "unknown", detail: "unreadable generated time" };
  return hours > STALE_HOURS
    ? { status: "warn", detail: `last data is ${Math.round(hours)} hours old`, fix: "Check the Actions tab of your radar repo for a failed run" }
    : { status: "ok", detail: `last data ${Math.max(0, Math.round(hours))} hours old` };
}

export function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, "").split(".").map(Number), pb = String(b).replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1;
  return 0;
}

// GitHub's "Automatically delete head branches" on the radar repo, judged against the person's choice.
export function autoDeleteCheck(on, wanted) {
  if (on === undefined || on === null) return { status: "unknown", detail: "couldn't read the setting" };
  if (on) return { status: "ok", detail: "on: merged branches are removed by GitHub" };
  if (wanted) return { status: "warn", detail: "off, but you chose remote branch cleanup", fix: "Run /radar-setup cleanup" };
  return { status: "ok", detail: wanted === false ? "off (you chose to keep branches)" : "off. /radar-setup cleanup can turn it on" };
}

export function doctor(repo, prefs = readState().cleanup || {}) {
  const checks = [];
  const add = (name, status, detail, fix) => checks.push({ name, status, detail, ...(fix ? { fix } : {}) });
  const d = detect();

  add("git", d.tools.git.found ? "ok" : "fail", d.tools.git.version ?? "not found", d.install.git);
  add("node", d.tools.node.ok ? "ok" : "fail", `${d.tools.node.version} (needs ${d.tools.node.min}+)`, d.install.node);
  add("gh", d.tools.gh.found ? "ok" : "fail", d.tools.gh.version ?? "not found", d.install.gh);
  if (!d.tools.gh.found) return { repo, checks };
  add("gh sign-in", d.tools.gh.authed ? "ok" : "fail", d.tools.gh.login ? `as ${d.tools.gh.login}` : "not signed in", "Run: gh auth login");
  add("workstation-steward", "ok", d.tools.steward.found ? "found: hand-offs use its rules" : "not found: hand-offs use handoff-rules.md (that's fine)");
  if (!d.tools.gh.authed) return { repo, checks };

  if (!repo) {
    add("radar repo", "fail", "no radar repo set up on this machine", "Run /radar-setup");
    return { repo, checks };
  }
  const info = ghJson(["repo", "view", repo, "--json", "visibility,isArchived,defaultBranchRef,deleteBranchOnMerge"]);
  if (!info.ok) {
    add("radar repo", "unknown", `couldn't read ${repo}: ${info.err}`);
    return { repo, checks };
  }
  const vis = info.data.visibility;
  add("radar repo private", vis === "PRIVATE" ? "ok" : "fail", `${repo} is ${vis.toLowerCase()}`, vis === "PRIVATE" ? undefined : `Reports list your repo names. Make it private: gh repo edit ${repo} --visibility private --accept-visibility-change-consequences`);

  const ad = autoDeleteCheck(info.data.deleteBranchOnMerge, prefs.remote);
  add("branch cleanup", ad.status, ad.detail, ad.fix);

  const secrets = ghJson(["secret", "list", "--repo", repo, "--json", "name"]);
  if (!secrets.ok) add("app secrets", "unknown", `couldn't list secret names: ${secrets.err}`);
  else {
    const names = new Set(secrets.data.map((s) => s.name));
    const missing = ["RADAR_APP_ID", "RADAR_APP_PRIVATE_KEY"].filter((n) => !names.has(n));
    add("app secrets", missing.length ? "fail" : "ok", missing.length ? `missing ${missing.join(", ")}` : "both set (names only checked)", missing.length ? "Run /radar-setup and pick the app step" : undefined);
  }

  const runs = ghJson(["run", "list", "--repo", repo, "--workflow", "daily-radar.yml", "--limit", "1", "--json", "conclusion,status,createdAt,url"]);
  if (!runs.ok) add("last daily run", "unknown", `couldn't read runs: ${runs.err}`);
  else if (!runs.data.length) add("last daily run", "warn", "no runs yet", `Start one: gh workflow run daily-radar.yml --repo ${repo}`);
  else {
    const r = runs.data[0];
    const status = r.status !== "completed" ? "ok" : r.conclusion === "success" ? "ok" : "fail";
    add("last daily run", status, `${r.status === "completed" ? r.conclusion : r.status}, ${r.createdAt}`, status === "fail" ? `Open the log: ${r.url}` : undefined);
  }

  const dash = gh(["api", `repos/${repo}/contents/data/dashboard.json`, "-H", "Accept: application/vnd.github.raw", "--jq", ".generated"]);
  if (!dash.ok) add("dashboard data", "unknown", `couldn't read data/dashboard.json: ${dash.err}`);
  else { const f = freshness(dash.out); add("dashboard data", f.status, f.detail, f.fix); }

  const mine = gh(["api", `repos/${repo}/contents/engine.json`, "-H", "Accept: application/vnd.github.raw", "--jq", ".version"]);
  const tags = ghJson(["api", `repos/${TEMPLATE}/tags`, "--jq", "[.[].name]"]);
  if (!mine.ok || !tags.ok) add("engine version", "unknown", "couldn't compare with the template");
  else {
    const latest = tags.data.filter((t) => /^v?\d+\.\d+\.\d+$/.test(t)).sort(compareVersions).at(-1);
    if (!latest) add("engine version", "ok", `${mine.out} (no template releases yet)`);
    else if (compareVersions(mine.out, latest) < 0) add("engine version", "warn", `${mine.out}, newer ${latest} available`, "Run /radar-update");
    else add("engine version", "ok", `${mine.out}, up to date`);
  }
  return { repo, checks };
}

const ICON = { ok: "ok   ", warn: "WARN ", fail: "FIX  ", unknown: "??   " };
export function render({ repo, checks }) {
  const lines = [`portfolio-radar doctor${repo ? `: ${repo}` : ""}`];
  for (const c of checks) {
    lines.push(`${ICON[c.status]} ${c.name}: ${c.detail}`);
    if (c.fix && c.status !== "ok") lines.push(`      fix: ${c.fix}`);
  }
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--repo");
  const repo = i >= 0 ? argv[i + 1] : readState().repo;
  if (argv.includes("--quiet") && !repo) process.exit(0); // not set up on this machine: stay silent
  const result = doctor(repo);
  const bad = result.checks.filter((c) => c.status === "fail" || c.status === "warn");
  if (argv.includes("--quiet")) {
    if (repo && bad.length) console.log(`portfolio-radar: ${bad.map((c) => `${c.name} (${c.detail})`).join("; ")}. Run /radar-doctor.`);
  } else console.log(argv.includes("--json") ? JSON.stringify(result, null, 2) : render(result));
  // The hook must never block a session, so --quiet always exits 0.
  process.exit(!argv.includes("--quiet") && result.checks.some((c) => c.status === "fail") ? 1 : 0);
}
