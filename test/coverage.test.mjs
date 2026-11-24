import { test } from "node:test";
import assert from "node:assert/strict";
import { coveragePlan, explain } from "../plugins/portfolio-radar/scripts/coverage.mjs";

const data = {
  repos: [
    { fullName: "octo-user/web", readable: true, updaters: { tools: ["renovate"] } },
    { fullName: "octo-org/api", readable: true, updaters: { tools: ["dependabot"] } },
    { fullName: "octo-org/both", readable: true, updaters: { tools: ["renovate", "dependabot"] } },
    { fullName: "octo-user/gone", readable: false, updaters: null },
  ],
  coverage: {
    dependabot: [{ repo: "octo-org/api", private: true }],
    secretScanning: [{ repo: "octo-user/web", private: false }, { repo: "octo-org/api", private: true }],
    codeScanning: [{ repo: "octo-user/web", private: false }],
  },
};

test("alerts go on everywhere; security updates follow the updater: off with Renovate, on without", () => {
  const { steps } = coveragePlan(data);
  const of = (repo) => steps.filter((s) => s.repo === repo).map((s) => s.args.slice(0, 4).join(" "));
  assert.ok(of("octo-org/api").includes("api -X PUT repos/octo-org/api/vulnerability-alerts"));
  assert.ok(of("octo-org/api").includes("api -X PUT repos/octo-org/api/automated-security-fixes"), "no Renovate yet: Dependabot security updates stay on");
  assert.ok(of("octo-user/web").includes("api -X DELETE repos/octo-user/web/automated-security-fixes"), "Renovate repo: no duplicate security PRs");
  assert.ok(of("octo-org/both").includes("api -X DELETE repos/octo-org/both/automated-security-fixes"), "Renovate present counts as Renovate");
  assert.equal(of("octo-user/gone").length, 0, "an unreadable repo gets no steps");
  const alerts = steps.findIndex((s) => s.what.startsWith("Dependabot alerts"));
  const updates = steps.findIndex((s) => s.what.startsWith("Dependabot security updates"));
  assert.ok(alerts < updates, "alerts are turned on before security updates, which need them");
});

test("paid features are never turned on for private repos; public ones get the free tier", () => {
  const { steps, held } = coveragePlan(data);
  assert.ok(steps.some((s) => s.repo === "octo-user/web" && /secret_scanning_push_protection/.test(s.args.join(" "))));
  assert.ok(steps.some((s) => s.repo === "octo-user/web" && s.args.includes("state=configured")));
  assert.ok(!steps.some((s) => s.repo === "octo-org/api" && /secret_scanning/.test(s.args.join(" "))));
  assert.match(held.find((h) => h.repo === "octo-org/api").why, /paid/);
});

test("nothing deletes: the only DELETE is turning off Dependabot security updates", () => {
  const { steps } = coveragePlan(data);
  for (const s of steps.filter((s) => s.args.includes("DELETE"))) assert.match(s.args.join(" "), /\/automated-security-fixes$/);
});

test("--skip leaves a repo out, and old data without coverage plans nothing", () => {
  const { steps, held } = coveragePlan(data, { skip: ["octo-user/web"] });
  assert.ok(!steps.some((s) => s.repo === "octo-user/web"));
  assert.ok(held.some((h) => h.repo === "octo-user/web"));
  const old = coveragePlan({ repos: [] });
  assert.equal(old.steps.length, 0);
  assert.match(old.note, /0\.7\.0/);
});

test("refusals are explained in plain words", () => {
  assert.match(explain("gh: Must have admin rights to Repository. (HTTP 403)"), /admin/);
  assert.match(explain("no supported languages found"), /CodeQL supports none/);
  assert.match(explain("Advanced Security must be enabled"), /paid/);
});
