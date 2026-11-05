// Fixes from the 2026-11-05 dry run on a throwaway org.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { stateDir, mergeState } from "../plugins/portfolio-radar/scripts/state.mjs";
import { installCheck, rulesCheck } from "../plugins/portfolio-radar/scripts/doctor.mjs";

const P = "plugins/portfolio-radar";

test("PORTFOLIO_RADAR_HOME moves only the radar's state folder", () => {
  assert.equal(stateDir({ PORTFOLIO_RADAR_HOME: "/tmp/x", XDG_CONFIG_HOME: "/c" }, "linux"), "/tmp/x");
  assert.equal(stateDir({ XDG_CONFIG_HOME: "/c" }, "linux"), join("/c", "portfolio-radar"));
});

test("saving one step keeps the others", () => {
  const prev = { repo: "octo-user/portfolio-radar", steps: { tools: true }, cleanup: { remote: true } };
  const next = mergeState(prev, { steps: { app: true }, cleanup: { local: false } });
  assert.deepEqual(next.steps, { tools: true, app: true });
  assert.deepEqual(next.cleanup, { remote: true, local: false });
  assert.equal(next.repo, "octo-user/portfolio-radar");
});

test("state refuses key-like names one level down too", () => {
  const home = mkdtempSync(join(tmpdir(), "radar-state-"));
  const r = spawnSync(process.execPath, [`${P}/scripts/state.mjs`, "set", '{"steps":{"privateKey":"x"}}'], { env: { ...process.env, PORTFOLIO_RADAR_HOME: home }, encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Refusing/);
});

test("install check names the owners the app is missing on, and never guesses", () => {
  assert.equal(installCheck(null, ["octo-user"], ["octo-user"]).status, "unknown");
  assert.equal(installCheck("radar", null, ["octo-user"]).status, "unknown");
  assert.equal(installCheck("radar", ["Octo-User", "octo-org"], ["octo-user", "octo-org"]).status, "ok");
  const w = installCheck("radar", ["octo-user"], ["octo-user", "octo-org"]);
  assert.equal(w.status, "warn");
  assert.match(w.detail, /octo-org/);
  assert.doesNotMatch(w.detail, /octo-user/);
});

test("hand-off rules check accepts handoff-rules.md without workstation-steward", () => {
  assert.equal(rulesCheck(true, false).status, "ok");
  assert.equal(rulesCheck(false, true).status, "ok");
  assert.equal(rulesCheck(false, false).status, "warn");
  assert.equal(rulesCheck(null, false).status, "unknown");
});

test("dashboard says when its script didn't run, and only talks Renovate when asked", () => {
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8");
  assert.match(html, /id="js-note"/);
  assert.match(html, /getElementById\("js-note"\)\?\.remove\(\)/);
  const sub = html.match(/<p[^>]*id="bots-sub"[^>]*>([^<]*)</);
  assert.ok(sub, "bots subtitle has an id");
  assert.doesNotMatch(sub[1], /Moving everything/);
  assert.match(html, /CFG\.preferRenovate/);
});

test("building without --config warns instead of failing silently", () => {
  const out = join(mkdtempSync(join(tmpdir(), "radar-build-")), "d.html");
  const r = spawnSync(process.execPath, [`${P}/scripts/build-dashboard.mjs`, "--out", out], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /No --config given/);
});

test("setup hands over the command when a step is refused", () => {
  const md = readFileSync(`${P}/commands/radar-setup.md`, "utf8");
  assert.match(md, /If a step is refused/);
  assert.match(md, /chore: add hand-off rules/);
  assert.match(md, /user\/installations/);
});

test("dashboard footer carries the credit line and a plugin version that matches the manifests", () => {
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8");
  assert.match(html, /<footer[^>]*>[\s\S]*Built with ❤️ by Chris Phillipson, Principal, CP Ventures Group, LLC/);
  const v = html.match(/const PLUGIN_VERSION = "([^"]+)"/)?.[1];
  assert.equal(v, JSON.parse(readFileSync(`${P}/.claude-plugin/plugin.json`, "utf8")).version);
  assert.equal(v, JSON.parse(readFileSync(".claude-plugin/marketplace.json", "utf8")).plugins.find((p) => p.name === "portfolio-radar").version);
  assert.match(html, /version not reported/, "a missing engine version is named, never blank");
});
