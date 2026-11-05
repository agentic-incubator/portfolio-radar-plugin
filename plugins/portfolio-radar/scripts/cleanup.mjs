#!/usr/bin/env node
// Branch cleanup, as two separate choices the person makes in /radar-setup:
//   remote: GitHub's "Automatically delete head branches" setting, so a merged PR's branch is removed
//   local:  after a Ship it, bring their clone up to date and remove the merged branch, safely
//
//   node cleanup.mjs status --repos <o/r,...> | --owners <o,...>
//   node cleanup.mjs remote --repos <o/r,...> | --owners <o,...> [--yes]
//   node cleanup.mjs local  --clone <path> --branch <name> [--head-sha <sha>] [--yes]
//
// Without --yes, `remote` and `local` only print what they would do. They never force anything:
// no `git branch -D`, no `worktree remove --force`, no force push, and never main/master/develop/release.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const isProtected = (b) => /^(main|master|develop|trunk)$/.test(b) || /^release(s)?[/-]/.test(b);

// `git status --porcelain=v1` lines. Gitignored files (like secrets/) never show up here.
export const dirtyLines = (porcelain) => String(porcelain || "").split("\n").filter((l) => l.trim());

// `git worktree list --porcelain` → [{ path, branch }]
export function parseWorktrees(text) {
  const out = [];
  let cur = null;
  for (const line of String(text || "").split("\n")) {
    if (line.startsWith("worktree ")) { cur = { path: line.slice(9), branch: null }; out.push(cur); }
    else if (cur && line.startsWith("branch ")) cur.branch = line.slice(7).replace(/^refs\/heads\//, "");
  }
  return out;
}

// Decides what a local cleanup may do. Pure, so it can be tested without git.
export function localPlan({ branch, defaultBranch, porcelain, inProgress, worktrees = [], mainPath, branchExists }) {
  if (!branch) return { ok: false, reason: "no branch given" };
  if (isProtected(branch) || branch === defaultBranch) return { ok: false, reason: `${branch} is a protected branch; it is never removed` };
  const dirty = dirtyLines(porcelain);
  if (dirty.length) return { ok: false, reason: `the clone has ${dirty.length} uncommitted or untracked change(s); nothing was touched` };
  if (inProgress) return { ok: false, reason: `a ${inProgress} is in progress; nothing was touched` };
  const steps = [
    ["git", "fetch", "--prune", "origin"],
    ["git", "checkout", defaultBranch],
    ["git", "pull", "--ff-only", "origin", defaultBranch],
  ];
  for (const w of worktrees) if (w.branch === branch && w.path !== mainPath) steps.push(["git", "worktree", "remove", w.path]);
  if (branchExists) steps.push(["git", "branch", "-d", branch]);
  return { ok: true, steps };
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "pipe"] });
  return { ok: !r.error && r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || r.error?.message || "").trim() };
}

function inProgressOp(gitDir) {
  for (const [f, name] of [["rebase-merge", "rebase"], ["rebase-apply", "rebase"], ["MERGE_HEAD", "merge"], ["CHERRY_PICK_HEAD", "cherry-pick"], ["REVERT_HEAD", "revert"]])
    if (existsSync(join(gitDir, f))) return name;
  return null;
}

export function local({ clone, branch, headSha, yes }) {
  const g = (args, cwd = clone) => run("git", args, cwd);
  const top = g(["rev-parse", "--show-toplevel"]);
  if (!top.ok) return { ok: false, reason: `${clone} is not a git clone` };
  const gitDir = g(["rev-parse", "--absolute-git-dir"]).out;
  const def = g(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  const defaultBranch = def.ok ? def.out.replace(/^origin\//, "") : "main";
  const plan = localPlan({
    branch,
    defaultBranch,
    porcelain: g(["status", "--porcelain=v1"]).out,
    inProgress: inProgressOp(gitDir),
    worktrees: parseWorktrees(g(["worktree", "list", "--porcelain"]).out),
    mainPath: top.out,
    branchExists: g(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]).ok,
  });
  if (!plan.ok || !yes) return { ...plan, dryRun: !yes };

  const done = [], skipped = [];
  for (const step of plan.steps) {
    const [, ...args] = step;
    if (args[0] === "worktree") {
      const wt = args[2];
      if (dirtyLines(run("git", ["status", "--porcelain=v1"], wt).out).length) { skipped.push(`worktree ${wt}: has changes, kept`); continue; }
    }
    const r = g(args);
    if (r.ok) { done.push(step.join(" ")); continue; }
    if (args[0] === "branch") {
      // A squash merge makes `git branch -d` refuse. Say whether the branch's commits were all in the merged PR.
      const inPr = headSha && g(["merge-base", "--is-ancestor", branch, headSha]).ok;
      skipped.push(`branch ${branch}: git kept it (${r.err.split("\n")[0]})${inPr ? `. Every commit on it is in the merged PR, so it is safe to remove by hand: git branch -D ${branch}` : ""}`);
      continue;
    }
    if (args[0] === "worktree") { skipped.push(`worktree ${args[2]}: ${r.err.split("\n")[0]}`); continue; }
    return { ok: false, reason: `${step.join(" ")} failed: ${r.err.split("\n")[0]}`, done, skipped };
  }
  return { ok: true, defaultBranch, head: g(["rev-parse", "--short", "HEAD"]).out, done, skipped };
}

const gh = (args) => run("gh", args);

export function listRepos({ repos, owners }) {
  if (repos?.length) return { repos, unread: [] };
  const out = [], unread = [];
  for (const o of owners || []) {
    const r = gh(["repo", "list", o, "--no-archived", "--source", "--limit", "1000", "--json", "nameWithOwner", "--jq", ".[].nameWithOwner"]);
    if (r.ok) out.push(...r.out.split("\n").filter(Boolean));
    else unread.push(`${o}: ${r.err.split("\n")[0]}`);
  }
  return { repos: out, unread };
}

export function status(list) {
  return list.map((repo) => {
    const r = gh(["api", `repos/${repo}`, "--jq", ".delete_branch_on_merge"]);
    return { repo, autoDelete: r.ok ? r.out === "true" : null, ...(r.ok ? {} : { error: r.err.split("\n")[0] }) };
  });
}

export function remote(list, yes) {
  const before = status(list);
  const todo = before.filter((s) => s.autoDelete === false).map((s) => s.repo);
  if (!yes) return { dryRun: true, wouldTurnOn: todo, alreadyOn: before.filter((s) => s.autoDelete).map((s) => s.repo), unread: before.filter((s) => s.autoDelete === null) };
  const turnedOn = [], failed = [];
  for (const repo of todo) {
    const r = gh(["api", "-X", "PATCH", `repos/${repo}`, "-F", "delete_branch_on_merge=true", "--silent"]);
    (r.ok ? turnedOn : failed).push(r.ok ? repo : { repo, error: r.err.split("\n")[0] });
  }
  return { turnedOn, failed, unread: before.filter((s) => s.autoDelete === null) };
}

function args(argv) {
  const o = { cmd: argv[0] };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes") o.yes = true;
    else if (a.startsWith("--")) o[a.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = argv[++i];
  }
  const csv = (s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined);
  o.repos = csv(o.repos); o.owners = csv(o.owners);
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const o = args(process.argv.slice(2));
  let result;
  if (o.cmd === "local") result = local({ clone: o.clone || process.cwd(), branch: o.branch, headSha: o.headSha, yes: o.yes });
  else if (o.cmd === "status" || o.cmd === "remote") {
    const { repos, unread } = listRepos(o);
    if (!repos.length) { console.error("Give --repos owner/name,... or --owners login,..."); process.exit(1); }
    result = o.cmd === "status" ? { repos: status(repos), unreadOwners: unread } : { ...remote(repos, o.yes), unreadOwners: unread };
  } else {
    console.error("Usage: node cleanup.mjs status|remote --repos o/r,... | --owners o,...  [--yes]\n       node cleanup.mjs local --clone <path> --branch <name> [--head-sha <sha>] [--yes]");
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok === false ? 2 : 0);
}
