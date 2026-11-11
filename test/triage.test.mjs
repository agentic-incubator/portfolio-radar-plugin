import { test } from "node:test";
import assert from "node:assert/strict";
import { triage, merge, normTitle, render } from "../plugins/portfolio-radar/scripts/triage.mjs";

const pr = (o) => ({ kind: "pr", repo: "octo-user/app", state: "open", checks: "green", mergeable: true, author: "octo-user", ...o });

test("titles normalise across case, punctuation and PR numbers", () => {
  assert.equal(normTitle("chore(deps): Bump vitest to 4.1.12 (#46)"), normTitle("chore(deps): bump vitest to 4.1.12"));
});

test("one PR mentioned in two threads becomes one item with both sources, live state winning", () => {
  const out = merge([
    pr({ number: 7, title: "x", state: "unknown", checks: "unknown", needs: "decide", sources: ["thread-a"] }),
    pr({ number: 7, title: "x", state: "open", checks: "red", sources: ["github", "thread-b"] }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].checks, "red");
  assert.equal(out[0].needs, "decide");
  assert.deepEqual(out[0].sources.sort(), ["github", "thread-a", "thread-b"]);
});

test("parallel runs that opened the same change: keep the green one, flag the rest", () => {
  const r = triage([
    pr({ number: 105, title: "fix: bump vitest", pkg: "vitest", checks: "red", createdAt: "2026-11-08T10:00:00Z" }),
    pr({ number: 106, title: "fix(deps): vitest 4.1.12", pkg: "vitest", checks: "green", createdAt: "2026-11-08T10:01:00Z" }),
  ]);
  assert.deepEqual(r.buckets.ship.map((x) => x.number), [106]);
  assert.deepEqual(r.buckets.duplicates.map((x) => x.number), [105]);
  assert.equal(r.buckets.duplicates[0].duplicateOf, "octo-user/app#106");
});

test("with no green one, the oldest is kept", () => {
  const r = triage([
    pr({ number: 9, title: "chore: add AGENTS.md", checks: "pending", createdAt: "2026-11-09T00:00:00Z" }),
    pr({ number: 8, title: "chore: add AGENTS.md", checks: "pending", createdAt: "2026-11-08T00:00:00Z" }),
  ]);
  assert.deepEqual(r.buckets.wait.map((x) => x.number), [8]);
  assert.deepEqual(r.buckets.duplicates.map((x) => x.number), [9]);
});

test("bot PRs are never marked duplicate (a Renovate PR is never closed by hand)", () => {
  const r = triage([
    pr({ number: 1, title: "Update vitest", author: "renovate[bot]" }),
    pr({ number: 2, title: "Update vitest", author: "renovate[bot]" }),
  ]);
  assert.equal(r.buckets.duplicates.length, 0);
});

test("same title in different repos is not a duplicate", () => {
  const r = triage([pr({ number: 1, title: "chore: add AGENTS.md" }), pr({ repo: "octo-org/lib", number: 1, title: "chore: add AGENTS.md" })]);
  assert.equal(r.buckets.ship.length, 2);
});

test("buckets: merged is done, red is fix, decisions and your steps stay on top", () => {
  const r = triage([
    pr({ number: 1, title: "a", state: "merged" }),
    pr({ number: 2, title: "b", checks: "red" }),
    pr({ number: 3, title: "c", mergeable: false }),
    pr({ number: 4, title: "d", needs: "decide", detail: "takes zip 9 (a major)" }),
    { kind: "ask", repo: "octo-user/portfolio-radar", title: "Push tag v0.5.0", state: "open", needs: "you-do" },
    { kind: "ask", repo: "acme-client/site", title: "Client owner installs the app", state: "open", needs: "wait" },
    pr({ number: 5, title: "e", draft: true }),
  ]);
  assert.deepEqual(r.buckets.done.map((x) => x.number), [1]);
  assert.deepEqual(r.buckets.fix.map((x) => x.number), [2, 3]);
  assert.deepEqual(r.buckets.decide.map((x) => x.number), [4]);
  assert.equal(r.buckets["you-do"].length, 1);
  assert.deepEqual(r.buckets.wait.map((x) => x.number ?? x.title), ["Client owner installs the app", 5]);
});

test("an unreadable item goes under Couldn't check, never as done or green", () => {
  const r = triage([pr({ number: 1, title: "a", state: "unknown" }), pr({ number: 2, title: "b", checks: "unknown" })]);
  assert.equal(r.buckets.unknown.length, 2);
  assert.equal(r.buckets.done.length + r.buckets.ship.length, 0);
  assert.match(render(r), /## Couldn't check \(2\)/);
});

test("render says so when nothing is open", () => {
  assert.match(render(triage([])), /Nothing open/);
});

test("green PRs sharing a lockfile are numbered to ship one at a time", () => {
  const r = triage([
    pr({ number: 3, title: "a", lockfile: "pnpm-lock.yaml", createdAt: "2026-11-08T03:00:00Z" }),
    pr({ number: 4, title: "b", lockfile: "pnpm-lock.yaml", createdAt: "2026-11-08T04:00:00Z" }),
    pr({ number: 5, title: "c", lockfile: "Cargo.lock" }),
  ]);
  const byNum = Object.fromEntries(r.buckets.ship.map((x) => [x.number, x.shipOrder]));
  assert.deepEqual(byNum, { 3: "1 of 2", 4: "2 of 2", 5: undefined });
  assert.match(render(r), /ship 1 of 2, shares pnpm-lock\.yaml/);
});

test("a PR red only because main is red says so", () => {
  assert.match(render(triage([pr({ number: 1, title: "a", checks: "red", mainRed: true })])), /red because the default branch is red/);
});
