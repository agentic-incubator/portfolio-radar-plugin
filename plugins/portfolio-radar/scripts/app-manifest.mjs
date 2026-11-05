#!/usr/bin/env node
// Creates the read-only portfolio-radar GitHub App with GitHub's manifest flow, then stores its
// App ID and private key as Actions secrets on the user's radar repo.
//
//   node app-manifest.mjs --repo <you>/portfolio-radar [--org <org>] [--name <app-name>] [--no-open]
//
// How it works: it serves one page on 127.0.0.1 (random port). That page posts a pre-filled app to
// GitHub. The person clicks "Create GitHub App"; GitHub redirects back here with a one-time code,
// which this script trades for the App ID and private key. The key goes straight into
// `gh secret set` on stdin. It is never printed, logged or written to disk.
//
// Prints a JSON line at the end: { ok, appId, slug, installUrl, settingsUrl }. Never the key.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Read-only, and only what the radar reads. Matches docs/setup.md in the template.
export const PERMISSIONS = {
  actions: "read",
  contents: "read",
  issues: "read",
  metadata: "read",
  pull_requests: "read",
  security_events: "read", // code scanning alerts
  secret_scanning_alerts: "read",
  vulnerability_alerts: "read", // Dependabot alerts
  organization_projects: "read",
};

export function buildManifest({ name, repoUrl, redirectUrl }) {
  return {
    name,
    url: repoUrl,
    description: "Read-only daily status report across my repos. Reads PRs, issues, CI and security alerts; never writes.",
    hook_attributes: { url: repoUrl, active: false },
    redirect_url: redirectUrl,
    public: true, // "Any account": needed to install on your orgs and client orgs. Grants nothing by itself.
    default_permissions: PERMISSIONS,
    default_events: [],
  };
}

export function newAppUrl({ org, state }) {
  const base = org ? `https://github.com/organizations/${encodeURIComponent(org)}/settings/apps/new` : "https://github.com/settings/apps/new";
  return `${base}?state=${encodeURIComponent(state)}`;
}

// Every write fails closed: no write permission may ever slip into the manifest.
export function assertReadOnly(perms) {
  const bad = Object.entries(perms).filter(([, v]) => v !== "read");
  if (bad.length) throw new Error(`Refusing: non-read permissions ${bad.map(([k, v]) => `${k}=${v}`).join(", ")}`);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function page(body) {
  return `<!doctype html><meta charset="utf-8"><title>portfolio-radar setup</title>
<body style="font:16px/1.5 system-ui;background:#060a13;color:#e7edf8;max-width:640px;margin:48px auto;padding:0 16px">${body}</body>`;
}

function setSecret(repo, name, value) {
  const r = spawnSync("gh", ["secret", "set", name, "--repo", repo], { input: value, encoding: "utf8", stdio: ["pipe", "ignore", "pipe"] });
  if (r.status !== 0) throw new Error(`gh secret set ${name} failed: ${(r.stderr || "").trim().split("\n")[0]}`);
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); } catch { /* the URL is printed too */ }
}

function args(argv) {
  const out = { open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") out.repo = argv[++i];
    else if (a === "--org") out.org = argv[++i];
    else if (a === "--name") out.name = argv[++i];
    else if (a === "--no-open") out.open = false;
  }
  return out;
}

async function main() {
  const opt = args(process.argv.slice(2));
  if (!opt.repo || !/^[\w.-]+\/[\w.-]+$/.test(opt.repo)) {
    console.error("Usage: node app-manifest.mjs --repo <owner>/<radar-repo> [--org <org>] [--name <app-name>] [--no-open]");
    process.exit(1);
  }
  const owner = opt.org || opt.repo.split("/")[0];
  const name = (opt.name || `${owner}-portfolio-radar`).slice(0, 34); // GitHub caps app names at 34 characters
  const repoUrl = `https://github.com/${opt.repo}`;
  const state = randomBytes(16).toString("hex");
  assertReadOnly(PERMISSIONS);

  const server = createServer();
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  const port = server.address().port;
  const redirectUrl = `http://127.0.0.1:${port}/callback`;
  const manifest = buildManifest({ name, repoUrl, redirectUrl });
  const timeout = setTimeout(() => { console.error("Timed out after 15 minutes. Run it again when ready."); process.exit(3); }, 15 * 60e3);

  const result = await new Promise((resolve) => {
    server.on("request", async (req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (url.pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(page(`<h1>Create your read-only radar app</h1>
<p>This makes a GitHub App named <b>${esc(name)}</b> that can only <b>read</b> your repos. You'll see every permission on the next page before you confirm.</p>
<form method="post" action="${esc(newAppUrl({ org: opt.org, state }))}">
<input type="hidden" name="manifest" value="${esc(JSON.stringify(manifest))}">
<button style="font:inherit;padding:10px 18px;border-radius:8px;border:0;background:#3ad6ff;color:#04131c;cursor:pointer">Continue to GitHub</button></form>`));
        return;
      }
      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        if (url.searchParams.get("state") !== state || !code) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(page("<h1>That link didn't match this setup.</h1><p>Close this tab and run the setup step again.</p>"));
          return;
        }
        try {
          const r = await fetch(`https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`, {
            method: "POST",
            headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "portfolio-radar-setup" },
          });
          if (!r.ok) throw new Error(`GitHub returned ${r.status} for the app code`);
          const app = await r.json();
          setSecret(opt.repo, "RADAR_APP_ID", String(app.id));
          setSecret(opt.repo, "RADAR_APP_PRIVATE_KEY", app.pem);
          const installUrl = `${app.html_url}/installations/new`;
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(page(`<h1>Done. Your app is ready.</h1><p>Both secrets are saved on <b>${esc(opt.repo)}</b>. The private key was never shown or saved anywhere else.</p>
<p>Next: <a style="color:#3ad6ff" href="${esc(installUrl)}">install it on your account and orgs</a>, choosing <b>All repositories</b>. Then go back to Claude.</p>`));
          resolve({ ok: true, appId: app.id, slug: app.slug, installUrl, settingsUrl: opt.org ? `https://github.com/organizations/${opt.org}/settings/apps/${app.slug}` : `https://github.com/settings/apps/${app.slug}` });
        } catch (e) {
          res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
          res.end(page(`<h1>Something went wrong.</h1><p>${esc(e.message)}</p><p>Go back to Claude; it will help you finish.</p>`));
          resolve({ ok: false, error: e.message });
        }
        return;
      }
      res.writeHead(404).end();
    });
    const start = `http://127.0.0.1:${port}/`;
    console.error(`Open this page to create the app: ${start}`);
    if (opt.open) openBrowser(start);
  });

  clearTimeout(timeout);
  server.close();
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 2);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
