#!/usr/bin/env node
// Checks the machine for what the portfolio-radar setup needs and prints one JSON object.
// Read-only: it runs version and status commands only, and never installs or changes anything.
//   node detect.mjs            → JSON
//   node detect.mjs --pretty   → a short green/amber/red list for people
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const MIN_NODE = 24;

function run(cmd, args = []) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "pipe"] });
  if (r.error) return null; // not installed
  return { code: r.status, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

export const firstVersion = (s) => /(\d+\.\d+(?:\.\d+)?)/.exec(s || "")?.[1] ?? null;
export const major = (v) => (v ? Number(v.split(".")[0]) : null);

// `gh auth status` prints to stderr on older versions and stdout on newer ones.
export function parseGhAuth(text) {
  const login = /Logged in to github\.com (?:account|as) (\S+)/i.exec(text)?.[1] ?? null;
  const scopes = /Token scopes:\s*(.+)/i.exec(text)?.[1]?.replace(/'/g, "").split(/,\s*/).filter(Boolean) ?? [];
  return { authed: Boolean(login), login, scopes };
}

export function packageManager(os, has) {
  if (os === "darwin") return has("brew") ? "brew" : null;
  if (os === "win32") return has("winget") ? "winget" : null;
  for (const pm of ["apt-get", "dnf", "pacman"]) if (has(pm)) return pm;
  return null;
}

// The exact command to offer for a missing tool. The person says yes first; this script never runs it.
export function installHint(tool, pm) {
  const table = {
    brew: { git: "brew install git", gh: "brew install gh", node: "brew install node" },
    winget: { git: "winget install --id Git.Git -e", gh: "winget install --id GitHub.cli -e", node: "winget install --id OpenJS.NodeJS -e" },
    "apt-get": { git: "sudo apt-get install -y git", gh: "sudo apt-get install -y gh", node: "see https://nodejs.org/en/download (apt's node is usually too old)" },
    dnf: { git: "sudo dnf install -y git", gh: "sudo dnf install -y gh", node: "sudo dnf install -y nodejs" },
    pacman: { git: "sudo pacman -S git", gh: "sudo pacman -S github-cli", node: "sudo pacman -S nodejs" },
  };
  if (!pm) return tool === "node" ? "https://nodejs.org/en/download" : tool === "gh" ? "https://cli.github.com" : "https://git-scm.com/downloads";
  return table[pm]?.[tool] ?? null;
}

export function detect() {
  const os = process.platform;
  const has = (c) => run(os === "win32" ? "where" : "which", [c])?.code === 0;
  const pm = packageManager(os, has);

  const gitR = run("git", ["--version"]);
  const ghR = run("gh", ["--version"]);
  const ghAuth = ghR ? run("gh", ["auth", "status", "--hostname", "github.com"]) : null;
  const nodeV = process.versions.node;
  const stewardR = run("steward", ["--version"]);

  const tools = {
    git: { found: Boolean(gitR && gitR.code === 0), version: firstVersion(gitR?.out) },
    gh: { found: Boolean(ghR && ghR.code === 0), version: firstVersion(ghR?.out), ...parseGhAuth(`${ghAuth?.out ?? ""}\n${ghAuth?.err ?? ""}`) },
    node: { found: true, version: nodeV, ok: major(nodeV) >= MIN_NODE, min: MIN_NODE },
    steward: { found: Boolean(stewardR && stewardR.code === 0), version: firstVersion(stewardR?.out) },
  };
  const missing = [];
  if (!tools.git.found) missing.push("git");
  if (!tools.gh.found) missing.push("gh");
  if (!tools.node.ok) missing.push("node");
  return {
    os,
    arch: process.arch,
    surface: process.env.CLAUDECODE === "1" ? "claude-code" : "unknown",
    packageManager: pm,
    tools,
    missing,
    install: Object.fromEntries(missing.map((t) => [t, installHint(t, pm)])),
    nextStep: missing.length ? "install" : !tools.gh.authed ? "gh auth login" : "ready",
  };
}

export function pretty(d) {
  const mark = (ok, warn) => (ok ? "green" : warn ? "amber" : "red  ");
  const lines = [
    `${mark(d.tools.git.found)}  git ${d.tools.git.version ?? "not found"}`,
    `${mark(d.tools.gh.found)}  gh ${d.tools.gh.version ?? "not found"}`,
    `${mark(d.tools.gh.authed, d.tools.gh.found)}  gh sign-in ${d.tools.gh.login ? `as ${d.tools.gh.login}` : "not signed in"}`,
    `${mark(d.tools.node.ok)}  node ${d.tools.node.version} (needs ${d.tools.node.min}+)`,
    `${d.tools.steward.found ? "green" : "grey "}  workstation-steward ${d.tools.steward.found ? d.tools.steward.version ?? "found" : "not found (optional)"}`,
  ];
  for (const [t, hint] of Object.entries(d.install)) lines.push(`       to install ${t}: ${hint}`);
  lines.push(d.nextStep === "ready" ? "Ready: everything setup needs is here." : d.nextStep === "install" ? `Next: install ${d.missing.join(", ")}.` : "Next: sign in to GitHub with gh auth login.");
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const d = detect();
  console.log(process.argv.includes("--pretty") ? pretty(d) : JSON.stringify(d, null, 2));
}
