// Where the plugin remembers setup progress on this machine: ~/.config/portfolio-radar/state.json
// (or $XDG_CONFIG_HOME, or %APPDATA% on Windows). Names and step flags only, never a key or token.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function stateDir(env = process.env, platform = process.platform) {
  if (platform === "win32" && env.APPDATA) return join(env.APPDATA, "portfolio-radar");
  return join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "portfolio-radar");
}
export const statePath = () => join(stateDir(), "state.json");

export function readState() {
  try { return JSON.parse(readFileSync(statePath(), "utf8")); } catch { return {}; }
}

const FORBIDDEN = /pem|private|secret|token|key/i;
export function writeState(patch) {
  for (const k of Object.keys(patch)) if (FORBIDDEN.test(k)) throw new Error(`Refusing to store "${k}" in state`);
  const next = { ...readState(), ...patch, updated: new Date().toISOString() };
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
