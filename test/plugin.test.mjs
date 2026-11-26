import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildManifest, assertReadOnly, newAppUrl, PERMISSIONS } from "../plugins/portfolio-radar/scripts/app-manifest.mjs";
import { parseGhAuth, firstVersion, installHint, packageManager } from "../plugins/portfolio-radar/scripts/detect.mjs";
import { freshness, compareVersions, render } from "../plugins/portfolio-radar/scripts/doctor.mjs";
import { stateDir } from "../plugins/portfolio-radar/scripts/state.mjs";

const P = "plugins/portfolio-radar";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));

test("marketplace and plugin manifests agree", () => {
  const m = json(".claude-plugin/marketplace.json");
  const p = json(`${P}/.claude-plugin/plugin.json`);
  const entry = m.plugins.find((x) => x.name === p.name);
  assert.ok(entry, "plugin listed in marketplace");
  assert.equal(entry.source, `./${P}`);
  assert.equal(entry.version, p.version);
});

test("every command, agent and skill has frontmatter with a description", () => {
  const files = [
    ...readdirSync(`${P}/commands`).map((f) => `${P}/commands/${f}`),
    ...readdirSync(`${P}/agents`).map((f) => `${P}/agents/${f}`),
    ...readdirSync(`${P}/skills`).map((d) => `${P}/skills/${d}/SKILL.md`),
  ];
  for (const f of files) {
    assert.ok(existsSync(f), `${f} exists`);
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(readFileSync(f, "utf8"));
    assert.ok(fm, `${f} has frontmatter`);
    assert.match(fm[1], /^description: .{20,}/m, `${f} has a description`);
  }
});

test("skill names match their folders", () => {
  for (const d of readdirSync(`${P}/skills`)) {
    const name = /^name: (.+)$/m.exec(readFileSync(`${P}/skills/${d}/SKILL.md`, "utf8"))?.[1];
    assert.equal(name, d);
  }
});

test("hooks.json points at a script that exists", () => {
  const h = json(`${P}/hooks/hooks.json`);
  const cmd = h.hooks.SessionStart[0].hooks[0].command;
  const script = /scripts\/([\w.-]+)/.exec(cmd)[1];
  assert.ok(existsSync(join(P, "scripts", script)));
});

test("the app manifest is read-only, has no webhook, and installs on any account", () => {
  const m = buildManifest({ name: "me-portfolio-radar", repoUrl: "https://github.com/me/portfolio-radar", redirectUrl: "http://127.0.0.1:5000/callback" });
  assert.ok(Object.values(m.default_permissions).every((v) => v === "read"));
  assert.equal(m.hook_attributes.active, false);
  assert.deepEqual(m.default_events, []);
  assert.equal(m.public, true);
  for (const k of ["metadata", "contents", "pull_requests", "issues", "actions", "vulnerability_alerts", "secret_scanning_alerts", "security_events"]) assert.equal(PERMISSIONS[k], "read", k);
});

test("assertReadOnly refuses any write permission", () => {
  assert.throws(() => assertReadOnly({ contents: "write" }), /Refusing/);
  assert.doesNotThrow(() => assertReadOnly(PERMISSIONS));
});

test("new-app URL for a user and for an org", () => {
  assert.equal(newAppUrl({ state: "abc" }), "https://github.com/settings/apps/new?state=abc");
  assert.equal(newAppUrl({ org: "my-org", state: "abc" }), "https://github.com/organizations/my-org/settings/apps/new?state=abc");
});

test("parses gh auth status, old and new wording", () => {
  assert.deepEqual(parseGhAuth("github.com\n  ✓ Logged in to github.com account octo (keyring)\n  - Token scopes: 'gist', 'read:org', 'repo'"), { authed: true, login: "octo", scopes: ["gist", "read:org", "repo"] });
  assert.equal(parseGhAuth("✓ Logged in to github.com as octo (oauth_token)").login, "octo");
  assert.equal(parseGhAuth("You are not logged into any GitHub hosts.").authed, false);
});

test("versions and install hints", () => {
  assert.equal(firstVersion("gh version 2.89.0 (2026-10-01)"), "2.89.0");
  assert.equal(installHint("gh", "brew"), "brew install gh");
  assert.match(installHint("node", null), /nodejs\.org/);
  assert.equal(packageManager("darwin", (c) => c === "brew"), "brew");
  assert.equal(packageManager("linux", (c) => c === "dnf"), "dnf");
});

test("dashboard freshness: fresh, stale and unknown", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");
  assert.equal(freshness("2026-11-05T03:00:00Z", now).status, "ok");
  assert.equal(freshness("2026-11-03T03:00:00Z", now).status, "warn");
  assert.equal(freshness(null, now).status, "unknown");
  assert.equal(freshness("garbage", now).status, "unknown");
});

test("semver compare", () => {
  assert.equal(compareVersions("0.1.0", "v0.2.0"), -1);
  assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareVersions("v1.2.3", "1.2.3"), 0);
});

test("doctor never shows an unreadable check as ok", () => {
  const out = render({ repo: "me/r", checks: [{ name: "app secrets", status: "unknown", detail: "couldn't list" }] });
  assert.match(out, /\?\?\s+app secrets/);
});

test("state lives in the config dir, never in a repo", () => {
  assert.equal(stateDir({ XDG_CONFIG_HOME: "/x" }, "linux"), "/x/portfolio-radar");
  assert.match(stateDir({ APPDATA: "C:\\Users\\a\\AppData\\Roaming" }, "win32"), /portfolio-radar$/);
});

import { build, safeJson } from "../plugins/portfolio-radar/scripts/build-dashboard.mjs";

test("dashboard template carries nothing personal", () => {
  // The author's credit line is public (it's in the README); nothing else personal may appear.
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8").replace("Built with ❤️ by Chris Phillipson, Principal, CP Ventures Group, LLC", "");
  for (const bad of [/pacphi/i, /AI OS/, /\bChris\b/, /trig_[0-9A-Za-z]{10,}/, /RFP-Portfolio/i, /cf-toolsuite/i]) assert.doesNotMatch(html, bad);
});

test("sample data uses made-up owners only", () => {
  const d = json(`${P}/dashboard/sample-data.json`);
  const owners = new Set(d.repos.map((r) => r.owner));
  assert.deepEqual([...owners].sort(), ["acme-client", "octo-org", "octo-user"]);
  assert.equal(d.schema, 1);
});

test("safeJson can't close a script tag", () => {
  const s = safeJson({ x: "</script><script>alert(1)</script> " });
  assert.doesNotMatch(s, /<\/script/i);
  assert.deepEqual(JSON.parse(s), { x: "</script><script>alert(1)</script> " });
});

test("built dashboard has data and config inline before the page script", () => {
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8");
  const out = build(html, { generated: "2026-11-05T00:00:00Z", repos: [] }, { ownerName: "Sam" });
  assert.ok(out.startsWith("<!doctype html>"));
  const cfg = out.indexOf('id="radar-config"'), data = out.indexOf('id="radar-data"'), page = out.indexOf("<script>");
  assert.ok(cfg > 0 && data > cfg && page > data);
});

test("every dashboard table has sortable column headers", () => {
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8");
  // Each table's header row is built by sortHead() or has its own sort buttons (In flight).
  const tables = html.split('h("table"').slice(1);
  assert.ok(tables.length >= 4, "expected the Ready to ship, bots, metrics and In flight tables");
  for (const t of tables) {
    const head = t.slice(0, t.indexOf('h("tbody"') > 0 ? t.indexOf('h("tbody"') : 400);
    assert.match(head, /sortHead\(|head\b/, `a table's header isn't sortable: ${head.slice(0, 120)}`);
  }
  assert.ok(!/h\("th", \{\}, "(Repo|PR|CI|Updater|Bot PRs)"\)/.test(html), "a table still has a plain, unsortable header");
});

test("every action the dashboard queues is handled by /radar-actions", () => {
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8");
  const doc = readFileSync(`${P}/commands/radar-actions.md`, "utf8");
  const actions = new Set([...html.matchAll(/action: "([a-z-]+)"/g), ...html.matchAll(/handoffBtn\([^,]+, "([a-z-]+)"/g)].map((m) => m[1]));
  for (const a of ["ship-it", "ship-all"]) assert.ok(actions.has(a), `dashboard should queue ${a}`);
  for (const a of actions) assert.ok(doc.includes(`\`${a}\``), `/radar-actions doesn't handle ${a}`);
});

test("a PR handed to Ship it or Ship all leaves Ready to ship until its request stops or fails", () => {
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8");
  assert.match(html, /function refreshShipKeys/, "dashboard should track PRs already shipping");
  const fn = html.slice(html.indexOf("function refreshShipKeys"), html.indexOf("const isShipping"));
  for (const k of ['"stopped"', '"ship-it"', '"ship-all"', '"skipped"', '"failed"']) assert.ok(fn.includes(k), `refreshShipKeys should consider ${k}`);
  const ship = html.slice(html.indexOf("function renderShip"), html.indexOf("function renderPatterns"));
  assert.match(ship, /isShipping\(r, p\)/, "renderShip should skip PRs already shipping");
  assert.match(html, /case "ship": return rs\.reduce\(\(n, r\) => n \+ r\.humanPrs\.filter\(\(p\) => isReady\(p\) && !isShipping/, "the tab count should skip them too");
});

test("Ship it repairs a conflict once and asks for a fresh ship it on the new head", () => {
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8");
  const doc = readFileSync(`${P}/commands/radar-actions.md`, "utf8");
  const rules = readFileSync(`${P}/skills/handoff-rules/SKILL.md`, "utf8");
  assert.match(doc, /## Conflict repair/, "radar-actions should describe the repair");
  assert.match(doc, /Never rebase, amend or force-push/);
  assert.match(doc, /`conflicts-resolved`/);
  assert.match(rules, /conflicts-resolved/, "handoff-rules should allow the one push");
  assert.match(html, /"conflicts-resolved"/, "the dashboard should show the outcome");
  assert.match(html, /const headOf = /, "the next Ship it should use the new head");
  assert.ok(html.includes("headSha: headOf(r, p)"), "Ship it and Ship all must send the new head");
});

test("the Overview shows week-over-week flow and health cards under the vitals, grouped in rows", () => {
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8");
  const v = html.indexOf('id="vitals"'), t = html.indexOf('id="trends"');
  assert.ok(v > 0 && t > v, "trends sit under the vitals");
  assert.ok(!html.includes('id="moves"') && !html.includes("renderMoves();"), "Today's moves is gone from the Overview");
  assert.match(html, /rowOf\(\["PRs merged", "Bot PRs merged", "People's PRs waiting"\]\)/, "PR cards share one row");
  assert.match(html, /rowOf\(\["Issues closed", "Issues opened"\]\)/, "issue cards share one row");
  assert.match(html, /if \(k === "failing" && !filtered\) return failingCard\(\)/, "the red CI vital is the weekly card");
  for (const f of ["prsMerged", "botPrsMerged", "issuesClosed", "issuesOpened"]) assert.ok(html.includes(`flow("${f}"`), `flow card for ${f}`);
  for (const f of ["humanPrs", "stale", "renovatePct", "agentsPct"]) assert.ok(html.includes(`health("${f}"`), `health card for ${f}`);
  assert.match(html, /now == null \? "\?"/, "an unknown value shows ? and never 0");
  assert.match(html, /engine 0\.6\.0/, "says what to do when the engine has no weekly series yet");
});

test("Ship all asks first and lists each PR it will merge", () => {
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8");
  const fn = html.slice(html.indexOf("function confirmShipAll"), html.indexOf("async function fire"));
  assert.match(fn, /drawer\(/, "Ship all must open a confirmation");
  assert.match(fn, /ready\.map\(/, "the confirmation lists every PR");
  assert.match(fn, /headSha/, "each PR carries the head it was green on");
  assert.match(fn, /isOwner\(\)/, "only the owner can ship");
  assert.ok(!/fire\(/.test(html.slice(html.indexOf("function renderShip"), html.indexOf("function renderPatterns"))), "the table's button must not queue without the confirmation");
});

test("Sweep all asks first, lists each repo, and never merges", () => {
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8");
  const fn = html.slice(html.indexOf("function confirmSweepAll"), html.indexOf("async function fire"));
  assert.match(fn, /drawer\(/, "Sweep all must open a confirmation");
  assert.match(fn, /targets\.map\(/, "the confirmation lists every repo");
  assert.match(fn, /isOwner\(\)/, "only the owner can sweep everything");
  assert.match(fn, /STEWARD\.includes/, "steward-managed repos are left out");
  assert.ok(!/fire\(/.test(html.slice(html.indexOf("function renderPatterns"), html.indexOf("const fullOf"))), "the section's button must not queue without the confirmation");
  const doc = readFileSync(`${P}/commands/radar-actions.md`, "utf8");
  const sweep = doc.slice(doc.indexOf("## Sweep all"), doc.indexOf("## After"));
  assert.match(sweep, /never merges/);
  assert.match(sweep, /repo by repo/);
  assert.match(sweep, /conflicts-resolved/, "Sweep all repairs a conflicting PR that already covers a repo");
  assert.match(doc.slice(doc.indexOf("## Each request"), doc.indexOf("## Conflict repair")), /sweep-package[\s\S]{0,400}Conflict repair/, "one-package Sweep repairs too");
  assert.match(html, /"conflicts-resolved": "conflicts resolved"/, "the dashboard labels the sweep outcome");
});

test("Ready to ship counts only green PRs and the rest have their own Act now tabs", () => {
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8");
  assert.match(html, /case "ship": return rs\.reduce\(\(n, r\) => n \+ r\.humanPrs\.filter\(\(p\) => isReady\(p\) && !isShipping/, "the tab counts only green PRs");
  const grp = html.slice(html.indexOf("const shipGroup"), html.indexOf("const CI_ORDER"));
  for (const k of ['"ready"', '"fix"', '"running"', '"review"', '"draft"']) assert.ok(grp.includes(k), `Ready to ship should have a ${k} group`);
  for (const l of ["Ready to ship", "Fix first", "Review by hand", "Drafts"]) assert.ok(grp.includes(`"${l}"`), `missing group heading ${l}`);
  // Only a green, non-draft PR gets a Ship it button; every other group links to the PR instead.
  const table = html.slice(html.indexOf("function shipTable"), html.indexOf("function renderShip"));
  assert.match(table, /isReady\(p\) \? shipBtn\(r, p\) : link\(p\.url, "Review ↗"\)/);
});

test("the page reads fresher data from the project's files only when dataFile is set, and says when it can't", () => {
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8");
  const block = html.slice(html.indexOf("async function loadProjectData"), html.indexOf("Promise.allSettled([cfgReady, dataReady])"));
  assert.match(block, /if \(!path \|\| inlineData\) return;/, "no dataFile (or a built HTML file) means no project read");
  assert.match(block, /use\("files"\)/, "it reads through the files capability");
  assert.match(html, /d\.schema === 1/, "it checks the schema before using the data");
  assert.match(block, /new Date\(d\.generated\) > new Date\(D\.generated\)/, "it only replaces the published copy with newer data");
  assert.match(block, /showing the copy published with the page/, "a failed read is named, never hidden");
  assert.match(html, /\$\("stamp"\)\.title = dataNote/, "the reason shows on the timestamp");
  const skill = readFileSync(`${P}/skills/dashboard/SKILL.md`, "utf8");
  assert.match(skill, /`dataFile`/, "the skill documents dataFile");
});

test("Fix first, Review by hand and Drafts are Act now tabs with counts, not groups inside Ready to ship", () => {
  const html = readFileSync(`${P}/dashboard/index.html`, "utf8");
  const act = html.slice(html.indexOf('["Act now"'), html.indexOf('["Clean up in bulk"'));
  for (const [k, l] of [["fix", "Fix first"], ["review", "Review by hand"], ["drafts", "Drafts"]]) {
    assert.ok(act.includes(`["${k}", "${l}"`), `Act now should have a ${l} tab`);
    assert.ok(html.includes(`<section id="s-${k}">`) && html.includes(`<div id="${k}">`), `${l} needs its own section`);
  }
  assert.match(html, /case "fix": case "review": case "drafts": return prsIn\(rs, PR_TAB\[k\]\);/, "each tab shows its count");
  const ship = html.slice(html.indexOf("function renderShip"), html.indexOf("function renderPrTab"));
  assert.match(ship, /SHIP_GROUPS\.filter\(\(\[k\]\) => k === "ready" \|\| k === "running"\)/, "Ready to ship shows only green and CI running");
  assert.ok(!/<details class="shipgrp"|"details", \{ class: "shipgrp" \}/.test(ship), "drafts no longer sit inside Ready to ship");
});
