#!/usr/bin/env node
// Builds the dashboard as one self-contained HTML file (the "HTML file" tier), with today's data and
// the person's settings inline, so it opens straight from disk with no server.
//   node build-dashboard.mjs --data <dashboard.json> [--config <config.json>] --out <file.html>
// Without --data it uses the bundled sample data (made-up names), for a preview.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DASH = join(here, "..", "dashboard");

// JSON inside <script type="application/json"> must not be able to close the tag.
export const safeJson = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

export function build(html, data, config = {}) {
  const block = `<script type="application/json" id="radar-config">${safeJson(config)}</script>\n<script type="application/json" id="radar-data">${safeJson(data)}</script>\n`;
  const at = html.indexOf("<script>");
  if (at < 0) throw new Error("dashboard template has no <script> block");
  return `<!doctype html>\n${html.slice(0, at)}${block}${html.slice(at)}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2);
  const arg = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const out = arg("--out");
  if (!out) { console.error("Usage: node build-dashboard.mjs [--data dashboard.json] [--config config.json] --out file.html"); process.exit(1); }
  const data = JSON.parse(readFileSync(arg("--data") || join(DASH, "sample-data.json"), "utf8"));
  const config = arg("--config") ? JSON.parse(readFileSync(arg("--config"), "utf8")) : {};
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, build(readFileSync(join(DASH, "index.html"), "utf8"), data, config));
  console.log(`Wrote ${out} (data from ${data.generated ?? "unknown time"})`);
}
