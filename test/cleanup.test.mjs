import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { isProtected, parseWorktrees, localPlan, local, dirtyLines } from "../plugins/portfolio-radar/scripts/cleanup.mjs";

test("protected branches are never cleanup targets", () => {
  for (const b of ["main", "master", "develop", "trunk", "release/1.2", "releases-2026"]) assert.ok(isProtected(b), b);
  for (const b of ["feat/x", "claude/thread-abc", "mainline-fix"]) assert.ok(!isProtected(b), b);
  const plan = localPlan({ branch: "main", defaultBranch: "main", porcelain: "" });
  assert.equal(plan.ok, false);
});

test("a dirty clone or an operation in progress stops local cleanup before any step", () => {
  const base = { branch: "feat/x", defaultBranch: "main", branchExists: true };
  assert.match(localPlan({ ...base, porcelain: " M README.md\n?? notes.txt\n" }).reason, /2 uncommitted/);
  assert.match(localPlan({ ...base, porcelain: "", inProgress: "rebase" }).reason, /rebase is in progress/);
  assert.equal(dirtyLines("\n  \n").length, 0);
});

test("local plan never forces anything", () => {
  const plan = localPlan({
    branch: "feat/x", defaultBranch: "main", porcelain: "", branchExists: true, mainPath: "/r",
    worktrees: [{ path: "/r", branch: "main" }, { path: "/r-x", branch: "feat/x" }],
  });
  assert.equal(plan.ok, true);
  const flat = plan.steps.map((s) => s.join(" "));
  assert.deepEqual(flat, ["git fetch --prune origin", "git checkout main", "git pull --ff-only origin main", "git worktree remove /r-x", "git branch -d feat/x"]);
  assert.ok(!flat.some((s) => /(-D|--force|-f\b)/.test(s)));
});

test("parseWorktrees reads git's porcelain list", () => {
  const wt = parseWorktrees("worktree /a\nHEAD 1\nbranch refs/heads/main\n\nworktree /b\nHEAD 2\ndetached\n\nworktree /c\nHEAD 3\nbranch refs/heads/feat/y\n");
  assert.deepEqual(wt, [{ path: "/a", branch: "main" }, { path: "/b", branch: null }, { path: "/c", branch: "feat/y" }]);
});

// A real clone: origin with main, a feature branch merged by squash, then local cleanup.
const git = (cwd, ...a) => {
  const r = spawnSync("git", a, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
function setup() {
  const root = mkdtempSync(join(tmpdir(), "radar-cleanup-"));
  const origin = join(root, "origin.git"), clone = join(root, "clone");
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, clone);
  for (const [k, v] of [["user.name", "Test"], ["user.email", "t@example.com"], ["commit.gpgsign", "false"]]) git(clone, "config", k, v);
  writeFileSync(join(clone, "a.txt"), "1\n");
  git(clone, "add", "a.txt"); git(clone, "commit", "-qm", "init"); git(clone, "push", "-q", "origin", "main");
  git(clone, "remote", "set-head", "origin", "main");
  return { root, origin, clone };
}

test("local cleanup on a real clone: updates main, keeps a squash-merged branch and says it's safe", () => {
  const { clone } = setup();
  git(clone, "checkout", "-qb", "feat/x");
  writeFileSync(join(clone, "b.txt"), "2\n");
  git(clone, "add", "b.txt"); git(clone, "commit", "-qm", "feat"); git(clone, "push", "-q", "origin", "feat/x");
  const headSha = git(clone, "rev-parse", "HEAD");
  // Squash-merge on the "server": a new commit on main with the same tree.
  git(clone, "checkout", "-q", "main"); git(clone, "merge", "-q", "--squash", "feat/x"); git(clone, "commit", "-qm", "feat (#1)");
  git(clone, "push", "-q", "origin", "main"); git(clone, "reset", "-q", "--hard", "HEAD~1");
  git(clone, "push", "-q", "origin", "--delete", "feat/x");
  git(clone, "checkout", "-q", "feat/x");

  const dry = local({ clone, branch: "feat/x", headSha });
  assert.equal(dry.dryRun, true);
  assert.equal(git(clone, "branch", "--show-current"), "feat/x", "dry run changes nothing");

  const r = local({ clone, branch: "feat/x", headSha, yes: true });
  assert.equal(r.ok, true, r.reason);
  assert.equal(git(clone, "branch", "--show-current"), "main");
  assert.equal(git(clone, "rev-parse", "HEAD"), git(clone, "rev-parse", "origin/main"));
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0], /safe to remove by hand: git branch -D feat\/x/);
  assert.ok(git(clone, "branch", "--list", "feat/x"), "git -d refused, so the branch is still there");
});

test("local cleanup removes a normally merged branch, and refuses a dirty clone", () => {
  const { clone } = setup();
  git(clone, "checkout", "-qb", "feat/y");
  writeFileSync(join(clone, "c.txt"), "3\n");
  git(clone, "add", "c.txt"); git(clone, "commit", "-qm", "y");
  git(clone, "checkout", "-q", "main"); git(clone, "merge", "-q", "--ff-only", "feat/y"); git(clone, "push", "-q", "origin", "main");
  const r = local({ clone, branch: "feat/y", yes: true });
  assert.equal(r.ok, true, r.reason);
  assert.equal(git(clone, "branch", "--list", "feat/y"), "");

  writeFileSync(join(clone, "wip.txt"), "unsaved\n");
  git(clone, "checkout", "-qb", "feat/z");
  const stop = local({ clone, branch: "feat/z", yes: true });
  assert.equal(stop.ok, false);
  assert.match(stop.reason, /uncommitted or untracked/);
  assert.equal(git(clone, "branch", "--show-current"), "feat/z", "nothing touched");
});

test("doctor's branch-cleanup check follows the person's choice", async () => {
  const { autoDeleteCheck } = await import("../plugins/portfolio-radar/scripts/doctor.mjs");
  assert.equal(autoDeleteCheck(true, false).status, "ok");
  assert.equal(autoDeleteCheck(false, true).status, "warn");
  assert.equal(autoDeleteCheck(false, false).status, "ok");
  assert.match(autoDeleteCheck(false, undefined).detail, /radar-setup cleanup/);
  assert.equal(autoDeleteCheck(undefined, true).status, "unknown", "unreadable is never shown as fine");
});
