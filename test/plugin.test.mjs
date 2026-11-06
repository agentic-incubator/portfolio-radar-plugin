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
