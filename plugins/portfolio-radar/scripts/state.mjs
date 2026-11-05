// Where the plugin remembers setup progress on this machine: ~/.config/portfolio-radar/state.json
// (or $XDG_CONFIG_HOME, or %APPDATA% on Windows). Names and step flags only, never a key or token.
// PORTFOLIO_RADAR_HOME overrides the folder, e.g. for a test run, without moving gh's own config the way
// changing XDG_CONFIG_HOME would.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function stateDir(env = process.env, platform = process.platform) {
  if (env.PORTFOLIO_RADAR_HOME) return env.PORTFOLIO_RADAR_HOME;
  if (platform === "win32" && env.APPDATA) return join(env.APPDATA, "portfolio-radar");
  return join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "portfolio-radar");
}
export const statePath = () => join(stateDir(), "state.json");

export function readState() {
  try { return JSON.parse(readFileSync(statePath(), "utf8")); } catch { return {}; }
}

const FORBIDDEN = /pem|private|secret|token|key/i;
// Objects one level down (steps, cleanup) merge instead of replacing, so a step never wipes the others.
export function mergeState(prev, patch) {
  const next = { ...prev };
  for (const [k, v] of Object.entries(patch)) {
    next[k] = v && typeof v === "object" && !Array.isArray(v) && prev[k] && typeof prev[k] === "object" && !Array.isArray(prev[k]) ? { ...prev[k], ...v } : v;
  }
  return next;
}

export function writeState(patch) {
  const keys = (o) => Object.entries(o).flatMap(([k, v]) => [k, ...(v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v) : [])]);
  for (const k of keys(patch)) if (FORBIDDEN.test(k)) throw new Error(`Refusing to store "${k}" in state`);
  const next = { ...mergeState(readState(), patch), updated: new Date().toISOString() };
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(statePath(), JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
  return next;
}

// CLI: node state.mjs get | node state.mjs set '{"repo":"me/portfolio-radar"}'
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, json] = process.argv.slice(2);
  if (cmd === "set") console.log(JSON.stringify(writeState(JSON.parse(json || "{}")), null, 2));
  else console.log(JSON.stringify(readState(), null, 2));
}
