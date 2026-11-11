// Turns the open loops gathered by /radar-triage (PRs, issues, queued dashboard requests, and asks left in
// chat threads) into one de-duplicated action list. Pure logic, no network: the skill reads GitHub and the
// host, writes items as JSON, and this script sorts them. Changes nothing anywhere.
//
// Item: { kind: "pr"|"issue"|"request"|"ask", repo, number?, url?, title, author?, pkg?, createdAt?,
//         state: "open"|"merged"|"closed"|"unknown", draft?, checks?: "green"|"red"|"pending"|"unknown",
//         mergeable?: true|false|null, needs?: "decide"|"you-do"|"wait", lockfile?, mainRed?, detail?,
//         sources?: [string] }
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const BUCKETS = [
  ["decide", "Decide"],
  ["you-do", "You do this"],
  ["ship", "Ready to ship"],
  ["fix", "Needs a fix"],
  ["duplicates", "Duplicates to close"],
  ["wait", "Waiting on someone else"],
  ["done", "Already done"],
  ["unknown", "Couldn't check"],
];

// "chore(deps): bump vitest to 4.1.12 (#46)" and "Chore(deps): Bump vitest to 4.1.12" are the same change.
export function normTitle(t = "") {
  return String(t).toLowerCase().replace(/\(#\d+\)/g, "").replace(/[^a-z0-9.@/+-]+/g, " ").trim();
}

const byAge = (a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || (a.number || 0) - (b.number || 0);
const isBot = (a = "") => /\[bot\]$|^(renovate|dependabot)/i.test(a);

// The same PR or issue mentioned in several places becomes one item that remembers every source.
export function merge(items) {
  const out = new Map();
  for (const it of items) {
    const key = it.number ? `${it.kind === "issue" ? "issue" : "pr"}:${it.repo}#${it.number}` : `${it.kind}:${it.repo}:${normTitle(it.title)}`;
    const prev = out.get(key);
    if (!prev) { out.set(key, { ...it, sources: [...new Set(it.sources || [])] }); continue; }
    // Live GitHub state beats what a thread remembered; keep the strongest "needs" either one gave.
    const live = it.state && it.state !== "unknown" ? it : prev;
    out.set(key, { ...prev, ...live, needs: prev.needs || it.needs, detail: prev.detail || it.detail, sources: [...new Set([...(prev.sources || []), ...(it.sources || [])])] });
  }
  return [...out.values()];
}

// Open PRs in one repo that make the same change (same package, or same title) are duplicates. Keep one:
// a green one first, then the oldest. Bot PRs (Renovate, Dependabot) are never marked: their own tools
// fold them, and a Renovate PR is never closed by hand.
export function findDuplicates(items) {
  const groups = new Map();
  for (const it of items) {
    if (it.kind !== "pr" || it.state !== "open" || isBot(it.author)) continue;
    const key = `${it.repo}|${it.pkg ? `pkg:${String(it.pkg).toLowerCase()}` : normTitle(it.title)}`;
    groups.set(key, [...(groups.get(key) || []), it]);
  }
  const dup = new Map();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const keep = [...g].sort((a, b) => (a.checks === "green" ? 0 : 1) - (b.checks === "green" ? 0 : 1) || byAge(a, b))[0];
    for (const it of g) if (it !== keep) dup.set(it, keep);
  }
  return dup;
}

export function bucketOf(it, dupOf) {
  if (dupOf) return "duplicates";
  if (!it.state || it.state === "unknown") return "unknown";
  if (it.state === "merged" || it.state === "closed") return "done";
  if (it.needs === "decide") return "decide";
  if (it.needs === "you-do") return "you-do";
  if (it.kind === "pr") {
    if (it.checks === "red" || it.mergeable === false) return "fix";
    if (it.checks === "green" && !it.draft && it.mergeable !== null) return "ship";
    if (it.checks === "unknown" || !it.checks) return "unknown";
    return "wait"; // pending checks, a draft, or mergeability still being computed
  }
  return it.needs === "wait" ? "wait" : "decide";
}

export function triage(items) {
  const merged = merge(items);
  const dups = findDuplicates(merged);
  const buckets = Object.fromEntries(BUCKETS.map(([k]) => [k, []]));
  for (const it of merged) {
    const keep = dups.get(it);
    buckets[bucketOf(it, keep)].push(keep ? { ...it, duplicateOf: keep.url || `${keep.repo}#${keep.number}` } : it);
  }
  for (const k of Object.keys(buckets)) buckets[k].sort(byAge);
  // Green PRs in one repo that rewrite the same lockfile can't all merge as they stand: each merge after the
  // first needs a rebase. Number them so they're shipped one at a time (or folded into one PR).
  const shared = new Map();
  for (const it of buckets.ship) if (it.lockfile) { const k = `${it.repo}|${it.lockfile}`; shared.set(k, [...(shared.get(k) || []), it]); }
  for (const g of shared.values()) if (g.length > 1) g.forEach((it, i) => { it.shipOrder = `${i + 1} of ${g.length}`; });
  const sources = [...new Set(merged.flatMap((it) => it.sources || []))];
  return { total: merged.length, buckets, sources };
}

const ref = (it) => (it.number ? `${it.repo}#${it.number}` : it.repo);
const link = (it) => (it.url ? `[${ref(it)}](${it.url})` : ref(it));

export function render(result) {
  const lines = [];
  for (const [k, label] of BUCKETS) {
    const list = result.buckets[k];
    if (!list.length) continue;
    lines.push(`## ${label} (${list.length})`, "");
    for (const it of list) {
      const notes = [
        it.duplicateOf && `same change as ${it.duplicateOf}`,
        it.shipOrder && `ship ${it.shipOrder}, shares ${it.lockfile}`,
        it.mainRed && "red because the default branch is red",
        it.detail,
      ].filter(Boolean);
      const extra = notes.length ? ` - ${notes.join("; ")}` : "";
      lines.push(`- ${link(it)}: ${it.title}${extra}`);
    }
    lines.push("");
  }
  if (!lines.length) lines.push("Nothing open. Every loop is closed.", "");
  return lines.join("\n");
}

// CLI: node triage.mjs items.json [--md]   (or pipe the JSON array on stdin)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const items = JSON.parse(readFileSync(file || 0, "utf8"));
  const result = triage(items);
  console.log(args.includes("--md") ? render(result) : JSON.stringify(result, null, 2));
}
