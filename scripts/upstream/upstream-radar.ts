#!/usr/bin/env tsx
/**
 * Upstream Sync Radar for the AAStar SDK.
 *
 * The SDK vendors 4 upstream infrastructure stacks (AirAccount contracts,
 * SuperPaymaster, KMS, DVT/YetAnotherAA-Validator). Each upstream evolves on its
 * own cadence; when it does, the SDK's vendored ABIs / pinned versions / contract
 * addresses / API references silently go stale and on-chain calls break with the
 * wrong selector, a stale address, or an incompatible wire format.
 *
 * This tool generalizes the manual per-cycle audits into ONE re-runnable check.
 * For each upstream it reports drift across 4 anchors:
 *
 *   1. version   — SDK pin (README table + addresses.ts header) vs upstream latest
 *                  git tag (or, for KMS, openapi.yaml info.version).
 *   2. ABIs      — function-name SETS of every vendored ABI vs the upstream ABI:
 *                    added   = upstream has, SDK lacks  -> coverage gap
 *                    removed = SDK has, upstream lacks   -> ABI-absent-wrapper risk (#30 class)
 *   3. addresses — CANONICAL_ADDRESSES (Sepolia 11155111) vs the upstream deployment
 *                  record (SP deployments/config.sepolia.json + AirAccount E2E_TESTDATA).
 *   4. API (KMS) — every openapi.yaml path referenced by a kms-*.ts service?
 *
 * Plus a best-effort, clearly-labelled self-contradiction scan per upstream
 * (e.g. the same contract has different addresses in two of the upstream's own
 * deployment docs; a version constant in the repo != its latest tag).
 *
 * Exit code: non-zero if ANY drift is found (so CI can gate). Self-contradictions
 * and KMS API gaps count as drift. ABI "added" (coverage gap) and "removed"
 * (absent-wrapper risk) both count as drift.
 *
 * Flags:
 *   --json                machine-readable output (no exit-code change)
 *   --upstream <name>     filter to one upstream (airaccount|superpaymaster|kms|dvt)
 *   --rehearse            after the report, run the existing gates (check:addresses,
 *                         doc-coverage, @aastar/core build) and print an "upgrade
 *                         worklist" — a dry-run of what a sync PR would touch.
 *                         NEVER modifies any SDK file.
 *
 * Run: pnpm exec tsx scripts/upstream/upstream-radar.ts [--json] [--upstream <name>] [--rehearse]
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_ADDRESSES } from "../../packages/core/src/addresses.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..");

// ---------------------------------------------------------------------------
// Upstream repo locations (kept locally at latest dev by convention).
// ---------------------------------------------------------------------------
const UPSTREAM_REPOS = {
  airaccount: "/Users/jason/Dev/aastar/airaccount-contract",
  superpaymaster: "/Users/jason/Dev/aastar/SuperPaymaster",
  // KMS spec lives inside the AirAccount runtime repo.
  kms: "/Users/jason/Dev/aastar/AirAccount",
  dvt: "/Users/jason/Dev/aastar/YetAnotherAA-Validator",
} as const;

const README = join(REPO, "README.md");
const ADDRESSES_TS = join(REPO, "packages", "core", "src", "addresses.ts");
const ABI_DIR = join(REPO, "packages", "core", "src", "abis");
const OPENAPI = join(UPSTREAM_REPOS.kms, "kms", "docs", "api", "openapi.yaml");
const KMS_SERVICES_DIR = join(REPO, "packages", "airaccount", "src", "server", "services");
const SEPOLIA = 11155111;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const ARGV = process.argv.slice(2);
const JSON_OUT = ARGV.includes("--json");
const REHEARSE = ARGV.includes("--rehearse");
const VERSIONS_OUT = ARGV.includes("--versions");
const UPSTREAM_FILTER = (() => {
  const i = ARGV.indexOf("--upstream");
  return i >= 0 && ARGV[i + 1] ? ARGV[i + 1].toLowerCase() : null;
})();

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------
function readText(p: string): string {
  return readFileSync(p, "utf8");
}

/** Latest git tag of a repo (most recent reachable; falls back to creatordate sort). */
function gitLatestTag(repo: string): string | null {
  try {
    return execFileSync("git", ["-C", repo, "describe", "--tags", "--abbrev=0"], {
      encoding: "utf8",
    }).trim();
  } catch {
    try {
      const out = execFileSync("git", ["-C", repo, "tag", "--sort=-creatordate"], {
        encoding: "utf8",
      }).trim();
      return out.split("\n")[0] || null;
    } catch {
      return null;
    }
  }
}

/** Strip a leading "v" / "openapi " / surrounding whitespace so versions compare cleanly. */
function normVersion(v: string): string {
  return v
    .trim()
    .replace(/^openapi\s+/i, "")
    .replace(/^v/i, "")
    .trim();
}

const ADDRESS_RE = /0x[0-9a-fA-F]{40}/;

/** Parse the function-name SET of an ABI JSON (forge artifact `.abi` or a bare array). */
function abiFunctionNames(file: string): Set<string> {
  const raw = JSON.parse(readText(file));
  const abi = Array.isArray(raw) ? raw : raw.abi;
  const names = new Set<string>();
  if (Array.isArray(abi)) {
    for (const item of abi) {
      if (item && item.type === "function" && item.name) names.add(item.name);
    }
  }
  return names;
}

/**
 * Canonical type string for one ABI input, with tuples expanded RECURSIVELY to
 * `(comp,comp,...)` and the array suffix preserved (`[]`, `[3]`). This is what lets
 * the radar see PARAM-SHAPE changes — e.g. a factory `InitConfig` tuple gaining two
 * `bytes32[3]` fields — that a bare function-name diff is blind to (v0.20.0 lesson).
 */
function canonicalAbiType(input: any): string {
  if (input && typeof input.type === "string" && input.type.startsWith("tuple")) {
    const inner = (input.components || []).map(canonicalAbiType).join(",");
    const suffix = input.type.slice("tuple".length); // "" | "[]" | "[3]" ...
    return `(${inner})${suffix}`;
  }
  return input?.type ?? "";
}

/** Canonical signature `name(type,type,...)` with tuples fully expanded. */
function abiFunctionSignature(fn: any): string {
  const params = (fn.inputs || []).map(canonicalAbiType).join(",");
  return `${fn.name}(${params})`;
}

/**
 * Map each ABI member keyed as `type:name` -> the set of its canonical signatures
 * (handles overloads). Covers functions, EVENTS, and errors — so a changed event
 * param shape (e.g. `RecoveryProposed` gaining `uint8 guardianIdx`, which moves
 * topic0) is caught too, not just function signatures.
 */
function abiMemberSignatures(file: string): Map<string, Set<string>> {
  const raw = JSON.parse(readText(file));
  const abi = Array.isArray(raw) ? raw : raw.abi;
  const map = new Map<string, Set<string>>();
  if (Array.isArray(abi)) {
    for (const item of abi) {
      if (
        item &&
        (item.type === "function" || item.type === "event" || item.type === "error") &&
        item.name
      ) {
        const key = `${item.type}:${item.name}`;
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(abiFunctionSignature(item));
      }
    }
  }
  return map;
}

/**
 * Resolve an upstream ABI for a contract. Order matters: prefer a MERGED/full ABI
 * (e.g. AirAccount's `abi/<C>.full.json` flattens proxy + extension + module
 * functions into one ABI, which is exactly what the SDK vendors), then a clean
 * exported ABI array (SuperPaymaster's `abis/<C>.json`), and only fall back to the
 * single-contract forge artifact (`out/<C>.sol/<C>.json`) last — that artifact omits
 * inherited/extension functions and a stale `out/` would yield false drift.
 */
function resolveUpstreamAbi(repo: string, contract: string): string | null {
  const candidates = [
    join(repo, "abi", `${contract}.full.json`),
    join(repo, "abis", `${contract}.json`),
    join(repo, "abi", `${contract}.json`),
    join(repo, "out", `${contract}.sol`, `${contract}.json`),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

// ---------------------------------------------------------------------------
// SDK source corpus (for KMS path-reference coverage). Excludes tests + abis.
// ---------------------------------------------------------------------------
function walkTs(dir: string, acc: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (["node_modules", "dist", "__tests__", "abis", ".git"].includes(entry)) continue;
      walkTs(full, acc);
    } else if (
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx") &&
      !entry.endsWith(".d.ts")
    ) {
      acc.push(full);
    }
  }
}

let _sdkCorpus: string | null = null;
function sdkCorpus(): string {
  if (_sdkCorpus !== null) return _sdkCorpus;
  const files: string[] = [];
  const pkgs = join(REPO, "packages");
  for (const pkg of readdirSync(pkgs)) {
    walkTs(join(pkgs, pkg, "src"), files);
  }
  _sdkCorpus = files.map((f) => readText(f)).join("\n\n");
  return _sdkCorpus;
}

// ---------------------------------------------------------------------------
// SDK version pins
// ---------------------------------------------------------------------------
/**
 * Parse the README "Integration Infrastructure" table. Rows look like:
 *   | **AirAccount** (contracts) | `v0.18.0-beta.2` | ... |
 * Returns the backticked pin in the 2nd column keyed by the bolded upstream name.
 */
function parseReadmePins(): Record<string, string> {
  const text = readText(README);
  const pins: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*\*\*([^*]+)\*\*[^|]*\|\s*`([^`]+)`\s*\|/);
    if (m) {
      const name = m[1].trim().toLowerCase();
      pins[name] = m[2].trim();
    }
  }
  return pins;
}

/** Best-effort: pull version-like tokens from the addresses.ts header/comments. */
function addressesHeaderMentions(token: RegExp): string[] {
  const text = readText(ADDRESSES_TS);
  const hits = new Set<string>();
  for (const line of text.split("\n")) {
    const m = line.match(token);
    if (m) hits.add(m[0]);
  }
  return [...hits];
}

const README_PINS = parseReadmePins();

// ---------------------------------------------------------------------------
// KMS openapi.yaml parsing (lifted from scripts/coverage/check-doc-coverage.ts)
// ---------------------------------------------------------------------------
function parseOpenApiPaths(): { method: string; path: string }[] {
  const lines = readText(OPENAPI).split("\n");
  const out: { method: string; path: string }[] = [];
  let inPaths = false;
  let curPath = "";
  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (!inPaths) continue;
    if (/^\S/.test(line) && !/^\s/.test(line)) break; // next top-level key ends paths
    const pathMatch = line.match(/^ {2}(\/\S*):\s*$/);
    if (pathMatch) {
      curPath = pathMatch[1];
      continue;
    }
    const methodMatch = line.match(/^ {4}(get|post|put|delete|patch):\s*$/);
    if (methodMatch && curPath) out.push({ method: methodMatch[1].toUpperCase(), path: curPath });
  }
  return out;
}

function openApiVersion(): string | null {
  const m = readText(OPENAPI).match(/^\s*version:\s*([^\s#]+)/m);
  return m ? m[1].trim() : null;
}

// KMS endpoints that are not programmatic SDK surface (mirrors the doc-coverage allowlist).
const KMS_API_EXEMPT = new Set<string>([
  "GET /",
  "GET /test",
  "GET /.well-known/attestation-measurements.json",
  "GET /.well-known/attestation-measurements-proof.json",
]);

// ---------------------------------------------------------------------------
// Address parsing for deployment docs
// ---------------------------------------------------------------------------
/**
 * Parse a markdown table of `| <label> | 0x... |` rows into label->address.
 * Only the FIRST address on each line is taken.
 */
function parseAddressTableFromText(text: string): { label: string; address: string }[] {
  const out: { label: string; address: string }[] = [];
  for (const line of text.split("\n")) {
    const addr = line.match(ADDRESS_RE);
    if (!addr) continue;
    // label = first table cell text (strip leading pipe + backticks)
    const cell = line.split("|")[1];
    if (cell === undefined) continue;
    const label = cell.replace(/[`*]/g, "").trim();
    if (label) out.push({ label, address: addr[0] });
  }
  return out;
}

function parseAddressTableByLabel(file: string): { label: string; address: string }[] {
  return parseAddressTableFromText(readText(file));
}

/**
 * The AirAccount addresses the SDK tracks follow the LATEST upstream release.
 * Each release redeploys the full stack on a version bump (new bytecode →
 * new CREATE addresses) even with no Solidity change, so the per-release
 * "Deployed (Sepolia ...)" table at the TOP of the upstream CHANGELOG.md is the
 * authoritative address record — NOT a fixed version-specific E2E doc (which
 * would silently false-green a redeploy, as v0.19.0-beta.2 did). Returns the
 * latest release's version heading + parsed table rows.
 */
function latestAirAccountRelease(repo: string): { version: string | null; rows: { label: string; address: string }[] } {
  const changelog = join(repo, "CHANGELOG.md");
  if (!existsSync(changelog)) return { version: null, rows: [] };
  const text = readText(changelog);
  const first = text.indexOf("## [");
  if (first < 0) return { version: null, rows: [] };
  const next = text.indexOf("\n## [", first + 4);
  const section = next < 0 ? text.slice(first) : text.slice(first, next);
  const vMatch = section.match(/##\s*\[v?([0-9][^\]]*)\]/);

  // Restrict to the first markdown table under the "Deployed" HEADING (matched as
  // a heading line, not any prose mention of "deployed") so sibling tables or
  // descriptive text cannot pollute the address anchor. If a Deployed heading
  // exists but has no table beneath it, return NO rows — do NOT fall back to the
  // whole section (that is the false-green bug being fixed). Only when there is no
  // Deployed heading at all do we parse the whole section.
  let rows: { label: string; address: string }[];
  const depMatch = section.match(/^#{2,6}\s+.*deployed.*$/im);
  if (depMatch && depMatch.index !== undefined) {
    const after = section.slice(depMatch.index + depMatch[0].length);
    const block: string[] = [];
    let started = false;
    for (const line of after.split("\n")) {
      if (line.includes("|")) {
        started = true;
        block.push(line);
      } else if (started) {
        break; // first contiguous table block ended
      }
    }
    rows = parseAddressTableFromText(block.join("\n"));
  } else {
    rows = parseAddressTableFromText(section);
  }
  return { version: vMatch ? vMatch[1] : null, rows };
}

/**
 * v0.20.0+ records each release's deploy in a dedicated per-version doc
 * `docs/DEPLOYMENT-v<version>.md` ("Core addresses" table) — the authoritative
 * current-deploy record. This is preferred over the CHANGELOG "Deployed" tables,
 * because a fresh release may not (re)publish a Deployed table under its own
 * `## [vX]` heading, in which case `latestAirAccountRelease` would otherwise read
 * an OLDER release's table and false-flag drift (the v0.20.0 anchor bug). Returns
 * the rows of the first table under a "Core addresses" heading (or all tables in
 * the doc if that heading is absent); `[]` when the doc does not exist.
 */
function airAccountDeploymentDocRows(repo: string, version: string | null): { label: string; address: string }[] {
  if (!version) return [];
  const dep = join(repo, "docs", `DEPLOYMENT-v${version}.md`);
  if (!existsSync(dep)) return [];
  const text = readText(dep);
  const m = text.match(/^#{2,6}\s+.*core addresses.*$/im);
  if (m && m.index !== undefined) {
    const after = text.slice(m.index + m[0].length);
    const block: string[] = [];
    let started = false;
    for (const line of after.split("\n")) {
      if (line.includes("|")) {
        started = true;
        block.push(line);
      } else if (started) {
        break; // first contiguous table block ended
      }
    }
    return parseAddressTableFromText(block.join("\n"));
  }
  return parseAddressTableFromText(text);
}

/**
 * Map an AirAccount deployment-doc label -> SDK canonical address key.
 * Ordered: first matching substring wins. Returns null for non-contract rows
 * (EOAs / test tokens), which are then ignored.
 */
const AA_LABEL_TO_KEY: [RegExp, string][] = [
  [/blsalgorithm/i, "aaStarBLSAlgorithm"],
  [/blsaggregator/i, "aaStarBLSAggregator"],
  [/sessionkeyvalidator/i, "sessionKeyValidator"],
  [/validatorrouter|aastarvalidator/i, "aaStarValidator"],
  [/forceexitmodule/i, "forceExitModule"],
  [/calldataparserregistry/i, "calldataParserRegistry"],
  [/agentregistry/i, "agentRegistry"],
  [/airaccountdelegate|delegate/i, "airAccountDelegate"],
  [/extension/i, "airAccountExtension"],
  [/factory/i, "airAccountFactoryV7"],
  [/implementation/i, "airAccountV7Impl"],
];

function aaLabelToKey(label: string): string | null {
  for (const [re, key] of AA_LABEL_TO_KEY) if (re.test(label)) return key;
  return null;
}

// ---------------------------------------------------------------------------
// Drift model
// ---------------------------------------------------------------------------
type AnchorStatus = "in-sync" | "drift" | "skipped";

interface AnchorResult {
  anchor: "version" | "abis" | "addresses" | "api" | "self-contradiction";
  status: AnchorStatus;
  findings: string[]; // human lines; empty when in-sync/skipped
}

interface UpstreamResult {
  name: string;
  key: string;
  repo: string;
  pinnedVersion: string | null;
  upstreamVersion: string | null;
  anchors: AnchorResult[];
}

function hasDrift(r: UpstreamResult): boolean {
  return r.anchors.some((a) => a.status === "drift");
}

// ---------------------------------------------------------------------------
// ABI diff anchor (shared by AirAccount + SuperPaymaster)
// ---------------------------------------------------------------------------
function analyzeAbis(repo: string, sdkAbiFiles: string[]): AnchorResult {
  const findings: string[] = [];
  let drift = false;
  let matched = 0;
  const noUpstream: string[] = [];

  for (const file of sdkAbiFiles) {
    const contract = file.replace(/\.json$/, "");
    const upstreamPath = resolveUpstreamAbi(repo, contract);
    if (!upstreamPath) {
      noUpstream.push(contract);
      continue;
    }
    matched++;
    const sdkFns = abiFunctionNames(join(ABI_DIR, file));
    const upFns = abiFunctionNames(upstreamPath);
    const added = [...upFns].filter((f) => !sdkFns.has(f)).sort(); // upstream has, SDK lacks
    const removed = [...sdkFns].filter((f) => !upFns.has(f)).sort(); // SDK has, upstream lacks

    // Signature-level diff for members (function/event/error) present on BOTH sides:
    // catches param/struct changes (an InitConfig tuple gaining fields, an event gaining
    // a topic) that the name-set diff is blind to.
    const sdkSigs = abiMemberSignatures(join(ABI_DIR, file));
    const upSigs = abiMemberSignatures(upstreamPath);
    const sigChanged: string[] = [];
    for (const key of [...sdkSigs.keys()].filter((k) => upSigs.has(k)).sort()) {
      const s = sdkSigs.get(key) ?? new Set<string>();
      const u = upSigs.get(key) ?? new Set<string>();
      const onlyUp = [...u].filter((x) => !s.has(x));
      const onlySdk = [...s].filter((x) => !u.has(x));
      if (onlyUp.length || onlySdk.length) {
        const label = key.replace(":", " "); // "event RecoveryProposed" / "function getAddress"
        sigChanged.push(`${label}: SDK \`${[...s].join(" | ")}\` != upstream \`${[...u].join(" | ")}\``);
      }
    }

    if (added.length || removed.length || sigChanged.length) {
      drift = true;
      const parts: string[] = [];
      if (added.length)
        parts.push(`+coverage-gap [${added.join(", ")}] (upstream added; SDK lacks)`);
      if (removed.length)
        parts.push(`-absent-wrapper [${removed.join(", ")}] (SDK has; upstream removed, #30 risk)`);
      if (sigChanged.length)
        parts.push(`~signature-changed [${sigChanged.join("; ")}] (param/tuple shape drift — would-revert on-chain, #InitConfig class)`);
      findings.push(`${contract}: ${parts.join("  ")}`);
    }
  }
  if (noUpstream.length)
    findings.push(`(no upstream ABI match, skipped: ${noUpstream.join(", ")})`);

  return {
    anchor: "abis",
    status: drift ? "drift" : matched ? "in-sync" : "skipped",
    findings,
  };
}

// ---------------------------------------------------------------------------
// Address anchor helpers
// ---------------------------------------------------------------------------
const canonicalSepolia = (CANONICAL_ADDRESSES as Record<number, Record<string, string>>)[SEPOLIA];

function compareAddress(key: string, upstreamAddr: string, findings: string[]): boolean {
  const canonical = canonicalSepolia[key];
  if (!canonical) return false; // key not tracked canonically
  if (canonical.toLowerCase() !== upstreamAddr.toLowerCase()) {
    findings.push(
      `${key}: SDK ${canonical} != upstream ${upstreamAddr} (SDK stale, upstream redeployed)`,
    );
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Upstream analyzers
// ---------------------------------------------------------------------------
function analyzeAirAccount(): UpstreamResult {
  const repo = UPSTREAM_REPOS.airaccount;
  const pinned = README_PINS["airaccount"] ?? null;
  const tag = gitLatestTag(repo);
  const anchors: AnchorResult[] = [];

  // version
  {
    const findings: string[] = [];
    let status: AnchorStatus = "skipped";
    if (pinned && tag) {
      status = normVersion(pinned) === normVersion(tag) ? "in-sync" : "drift";
      if (status === "drift") findings.push(`README pin \`${pinned}\` != upstream latest tag \`${tag}\``);
    }
    anchors.push({ anchor: "version", status, findings });
  }

  // ABIs
  anchors.push(
    analyzeAbis(repo, [
      "AAStarAirAccountV7.json",
      "AAStarAirAccountFactoryV7.json",
      "AAStarBLSAlgorithm.json",
      "AAStarBLSAggregator.json",
      "AAStarValidator.json",
      "SessionKeyValidator.json",
      "ForceExitModule.json",
      "AgentRegistry.json",
      "AirAccountExtension.json",
      "AirAccountDelegate.json",
      "CalldataParserRegistry.json",
    ]),
  );

  // addresses — the dedicated per-version deployment doc `docs/DEPLOYMENT-v<latest>.md`
  // ("Core addresses" table) is the authoritative current deploy. Prefer it over the
  // CHANGELOG "Deployed" table (which a fresh release may not republish under its own
  // heading, causing an OLDER table to be read — the v0.20.0 anchor bug). Falls back to
  // the CHANGELOG table, then the legacy beta.2 E2E doc, only if the deployment doc is absent.
  const latest = latestAirAccountRelease(repo);
  {
    const findings: string[] = [];
    let rows = airAccountDeploymentDocRows(repo, latest.version);
    if (rows.length === 0) rows = latest.rows;
    if (rows.length === 0) {
      const e2e = join(repo, "docs", "e2e", "E2E_TESTDATA_v0.18.0-beta.2.md");
      if (existsSync(e2e)) rows = parseAddressTableByLabel(e2e);
    }
    let status: AnchorStatus = rows.length ? "in-sync" : "skipped";
    let compared = 0;
    for (const { label, address } of rows) {
      const key = aaLabelToKey(label);
      if (!key) continue;
      compared++;
      if (compareAddress(key, address, findings)) status = "drift";
    }
    if (compared === 0) status = "skipped";
    anchors.push({ anchor: "addresses", status, findings });
  }

  // self-contradiction — does a SAME-VERSION upstream deployment doc disagree with
  // the latest CHANGELOG deploy table? Only compares docs of the latest release's
  // version (e.g. deployment-v0.19.md), so a superseded v0.18 doc no longer false-
  // flags once the pin moves on (that stale-doc issue is filed upstream, not our drift).
  {
    const findings: string[] = [];
    let status: AnchorStatus = "skipped";
    const minor = latest.version?.match(/^(\d+\.\d+)/)?.[1] ?? null;
    const dep = minor ? join(repo, "docs", `deployment-v${minor}.md`) : null;
    if (latest.rows.length && dep && existsSync(dep)) {
      status = "in-sync";
      const refMap = new Map<string, string>();
      for (const { label, address } of latest.rows) {
        const key = aaLabelToKey(label);
        if (key) refMap.set(key, address.toLowerCase());
      }
      for (const { label, address } of parseAddressTableByLabel(dep)) {
        const key = aaLabelToKey(label);
        if (!key) continue;
        const other = refMap.get(key);
        if (other && other !== address.toLowerCase()) {
          status = "drift";
          findings.push(
            `${key}: deployment-v${minor}.md ${address} != CHANGELOG-latest ${other} ` +
              `(two same-version upstream docs disagree; SDK tracks the CHANGELOG value)`,
          );
        }
      }
    }
    anchors.push({ anchor: "self-contradiction", status, findings });
  }

  return { name: "AirAccount (contracts)", key: "airaccount", repo, pinnedVersion: pinned, upstreamVersion: tag, anchors };
}

function analyzeSuperPaymaster(): UpstreamResult {
  const repo = UPSTREAM_REPOS.superpaymaster;
  const pinned = README_PINS["superpaymaster"] ?? null;
  const tag = gitLatestTag(repo);
  const anchors: AnchorResult[] = [];

  // version
  {
    const findings: string[] = [];
    let status: AnchorStatus = "skipped";
    if (pinned && tag) {
      status = normVersion(pinned) === normVersion(tag) ? "in-sync" : "drift";
      if (status === "drift") findings.push(`README pin \`${pinned}\` != upstream latest tag \`${tag}\``);
    }
    anchors.push({ anchor: "version", status, findings });
  }

  // ABIs
  anchors.push(
    analyzeAbis(repo, [
      "SuperPaymaster.json",
      "Registry.json",
      "PolicyRegistry.json",
      "X402Facilitator.json",
      "BLSAggregator.json",
      "DVTValidator.json",
      "GTokenStaking.json",
      "MySBT.json",
      "ReputationSystem.json",
      "xPNTsToken.json",
      "xPNTsFactory.json",
      "PaymasterFactory.json",
      "MicroPaymentChannel.json",
    ]),
  );

  // addresses — deployments/config.sepolia.json (camelCase keys mirror SDK keys 1:1).
  {
    const findings: string[] = [];
    let status: AnchorStatus = "skipped";
    const cfgPath = join(repo, "deployments", "config.sepolia.json");
    if (existsSync(cfgPath)) {
      status = "in-sync";
      const cfg = JSON.parse(readText(cfgPath)) as Record<string, unknown>;
      let compared = 0;
      for (const [key, value] of Object.entries(cfg)) {
        if (typeof value !== "string" || !ADDRESS_RE.test(value)) continue;
        if (!(key in canonicalSepolia)) continue; // e.g. registryImpl/spImpl not tracked canonically
        compared++;
        if (compareAddress(key, value, findings)) status = "drift";
      }
      if (compared === 0) status = "skipped";
    }
    anchors.push({ anchor: "addresses", status, findings });
  }

  // self-contradiction — best-effort: none cheaply available beyond version<->tag,
  // which the version anchor already covers. Reported as skipped/in-sync.
  anchors.push({ anchor: "self-contradiction", status: "in-sync", findings: [] });

  return { name: "SuperPaymaster", key: "superpaymaster", repo, pinnedVersion: pinned, upstreamVersion: tag, anchors };
}

function analyzeKms(): UpstreamResult {
  const repo = UPSTREAM_REPOS.kms;
  const pinned = README_PINS["kms"] ?? null;
  const specVersion = existsSync(OPENAPI) ? openApiVersion() : null;
  const tag = gitLatestTag(repo);
  const anchors: AnchorResult[] = [];

  // version — pin (e.g. "openapi 0.22.0") vs openapi.yaml info.version.
  {
    const findings: string[] = [];
    let status: AnchorStatus = "skipped";
    if (pinned && specVersion) {
      status = normVersion(pinned) === normVersion(specVersion) ? "in-sync" : "drift";
      if (status === "drift")
        findings.push(
          `README pin \`${pinned}\` != openapi.yaml info.version \`${specVersion}\`` +
            (tag ? ` (upstream tag \`${tag}\`)` : ""),
        );
    }
    anchors.push({ anchor: "version", status, findings });
  }

  // API — every openapi path referenced by a kms-* service?
  {
    const findings: string[] = [];
    let status: AnchorStatus = "skipped";
    if (existsSync(OPENAPI) && existsSync(KMS_SERVICES_DIR)) {
      status = "in-sync";
      // KMS path coverage is scoped to the kms-* services that hold the path strings.
      let kmsSrc = "";
      for (const f of readdirSync(KMS_SERVICES_DIR)) {
        if (f.startsWith("kms-") && f.endsWith(".ts")) kmsSrc += "\n" + readText(join(KMS_SERVICES_DIR, f));
      }
      // Fall back to the whole SDK corpus too (some paths referenced elsewhere).
      const corpus = kmsSrc + "\n" + sdkCorpus();
      for (const { method, path } of parseOpenApiPaths()) {
        const key = `${method} ${path}`;
        if (KMS_API_EXEMPT.has(key)) continue;
        const esc = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const referenced = new RegExp(`['"\`]${esc}['"\`]`).test(corpus);
        if (!referenced) {
          status = "drift";
          findings.push(`${key}: openapi path NOT referenced by any kms-* service (coverage gap)`);
        }
      }
    }
    anchors.push({ anchor: "api", status, findings });
  }

  // self-contradiction — openapi info.version vs latest git tag.
  {
    const findings: string[] = [];
    let status: AnchorStatus = "skipped";
    if (specVersion && tag) {
      status = normVersion(specVersion) === normVersion(tag) ? "in-sync" : "drift";
      if (status === "drift")
        findings.push(`openapi.yaml version \`${specVersion}\` != repo latest tag \`${tag}\``);
    }
    anchors.push({ anchor: "self-contradiction", status, findings });
  }

  return { name: "KMS (openapi.yaml)", key: "kms", repo, pinnedVersion: pinned, upstreamVersion: specVersion, anchors };
}

function analyzeDvt(): UpstreamResult {
  const repo = UPSTREAM_REPOS.dvt;
  const pinned = README_PINS["dvt"] ?? null;
  const tag = gitLatestTag(repo);
  const anchors: AnchorResult[] = [];

  // version
  {
    const findings: string[] = [];
    let status: AnchorStatus = "skipped";
    if (pinned && tag) {
      status = normVersion(pinned) === normVersion(tag) ? "in-sync" : "drift";
      if (status === "drift") findings.push(`README pin \`${pinned}\` != upstream latest tag \`${tag}\``);
    }
    anchors.push({ anchor: "version", status, findings });
  }

  // wire format — compare the BLS Domain Separation Tag (the load-bearing wire
  // constant) between the YAA node (bls.util.ts BLS_DST) and the SDK
  // (hashToField.ts BLS_POP_DST). A DST change silently breaks every co-sign.
  {
    const findings: string[] = [];
    let status: AnchorStatus = "skipped";
    const yaaUtil = join(repo, "src", "utils", "bls.util.ts");
    const sdkHtf = join(REPO, "packages", "core", "src", "crypto", "hashToField.ts");
    const extractDst = (file: string): string | null => {
      if (!existsSync(file)) return null;
      const m = readText(file).match(/BLS_(?:SIG|POP)?_?DST?\s*=\s*['"`]([^'"`]+)['"`]/) ??
        readText(file).match(/['"`](BLS_SIG_BLS12381G2_[^'"`]+)['"`]/);
      return m ? m[1] : null;
    };
    const yaaDst = extractDst(yaaUtil);
    const sdkDst = extractDst(sdkHtf);
    if (yaaDst && sdkDst) {
      status = yaaDst === sdkDst ? "in-sync" : "drift";
      if (status === "drift")
        findings.push(`BLS DST drift: YAA node \`${yaaDst}\` != SDK dvtWire \`${sdkDst}\``);
    } else {
      findings.push(
        `best-effort: could not extract BLS_DST from ${yaaDst ? "" : "YAA bls.util.ts "}${sdkDst ? "" : "SDK hashToField.ts"} (manual golden-vector check still required)`,
      );
    }
    // Reuse the "addresses"/"abis" slot label "api" is wrong; use a custom note via self-contradiction below.
    anchors.push({ anchor: "abis", status, findings }); // ABI slot repurposed: DVT wire-format anchor
  }

  // self-contradiction — package.json version vs latest git tag.
  {
    const findings: string[] = [];
    let status: AnchorStatus = "skipped";
    const pkgPath = join(repo, "package.json");
    if (existsSync(pkgPath) && tag) {
      const pkgVer = JSON.parse(readText(pkgPath)).version as string | undefined;
      if (pkgVer) {
        status = normVersion(pkgVer) === normVersion(tag) ? "in-sync" : "drift";
        if (status === "drift")
          findings.push(`package.json version \`${pkgVer}\` != latest tag \`${tag}\``);
      }
    }
    anchors.push({ anchor: "self-contradiction", status, findings });
  }

  return { name: "DVT (YetAnotherAA-Validator)", key: "dvt", repo, pinnedVersion: pinned, upstreamVersion: tag, anchors };
}

// ---------------------------------------------------------------------------
// Run analyzers (respecting --upstream filter)
// ---------------------------------------------------------------------------
const ALL: (() => UpstreamResult)[] = [
  analyzeAirAccount,
  analyzeSuperPaymaster,
  analyzeKms,
  analyzeDvt,
];

const results: UpstreamResult[] = ALL.map((fn) => fn()).filter(
  (r) => !UPSTREAM_FILTER || r.key === UPSTREAM_FILTER,
);

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const ICON: Record<AnchorStatus, string> = { "in-sync": "✅", drift: "⚠️", skipped: "·" };

// For DVT the "abis" slot is repurposed as the wire-format anchor; relabel in output.
function anchorLabel(r: UpstreamResult, a: AnchorResult): string {
  if (r.key === "dvt" && a.anchor === "abis") return "wire-format";
  return a.anchor;
}

function renderHuman(): string {
  const lines: string[] = [];
  lines.push("Upstream Sync Radar — AAStar SDK");
  lines.push(`Source of truth: README pins + addresses.ts + packages/core/src/abis/ vs local upstream repos`);
  lines.push("");
  for (const r of results) {
    const drift = hasDrift(r);
    lines.push(`${drift ? "⚠️ DRIFT" : "✅ IN-SYNC"}  ${r.name}`);
    lines.push(
      `  pin=${r.pinnedVersion ?? "?"}  upstream=${r.upstreamVersion ?? "?"}  (${r.repo})`,
    );
    for (const a of r.anchors) {
      lines.push(`  ${ICON[a.status]} ${anchorLabel(r, a)}: ${a.status}`);
      for (const f of a.findings) lines.push(`       - ${f}`);
    }
    lines.push("");
  }
  // Summary
  const drifted = results.filter(hasDrift);
  lines.push("Summary");
  lines.push(`  upstreams checked: ${results.length}`);
  lines.push(`  in-sync: ${results.length - drifted.length}   drift: ${drifted.length}`);
  if (drifted.length) {
    lines.push("  drifted upstreams:");
    for (const r of drifted) {
      const which = r.anchors.filter((a) => a.status === "drift").map((a) => anchorLabel(r, a));
      lines.push(`    - ${r.name} [${which.join(", ")}]`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Rehearse — run existing gates + print an upgrade worklist (no SDK mutation)
// ---------------------------------------------------------------------------
function runGate(label: string, cmd: string, args: string[]): { label: string; ok: boolean; tail: string } {
  try {
    const out = execFileSync(cmd, args, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { label, ok: true, tail: out.trim().split("\n").slice(-3).join("\n") };
  } catch (e: any) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim();
    return { label, ok: false, tail: out.split("\n").slice(-6).join("\n") };
  }
}

/** Map a drifted anchor to the concrete SDK files a sync PR would touch. */
function worklistFor(r: UpstreamResult): string[] {
  const items: string[] = [];
  for (const a of r.anchors) {
    if (a.status !== "drift") continue;
    const label = anchorLabel(r, a);
    switch (label) {
      case "version":
        items.push(
          `[version] bump pin \`${r.pinnedVersion}\` -> \`${r.upstreamVersion}\` in README.md (Integration table) ` +
            `and the addresses.ts header comment`,
        );
        break;
      case "abis":
        items.push(
          `[abis] re-vendor changed ABIs into packages/core/src/abis/ from ${r.repo} ` +
            `(abis/<C>.json or out/<C>.sol/<C>.json), then \`pnpm --filter @aastar/core build\` + \`pnpm run audit:abi\``,
        );
        break;
      case "addresses":
        items.push(
          `[addresses] update CANONICAL_ADDRESSES[${SEPOLIA}] in packages/core/src/addresses.ts ` +
            `to the upstream deployment record, then sync config.sepolia.json + \`pnpm run check:addresses\``,
        );
        break;
      case "api":
        items.push(
          `[api] add/adjust kms-*.ts service path strings in packages/airaccount/src/server/services/ ` +
            `to cover the new openapi.yaml endpoints, then re-run doc-coverage`,
        );
        break;
      case "wire-format":
        items.push(
          `[wire] reconcile the BLS DST / wire layout in packages/core/src/crypto/{dvtWire,hashToField}.ts ` +
            `against the YAA node, then re-run the golden-vector tests`,
        );
        break;
      case "self-contradiction":
        items.push(
          `[upstream-fix] the upstream contradicts itself — resolve in ${r.repo} BEFORE syncing; ` +
            `decide which value is authoritative, then re-run the radar`,
        );
        break;
    }
  }
  return items;
}

function renderRehearse(): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("──────────────────────────────────────────────────────────────");
  lines.push("REHEARSE — running existing gates (read-only; no SDK files modified)");
  lines.push("──────────────────────────────────────────────────────────────");
  const gates = [
    runGate("check:addresses", "pnpm", ["exec", "tsx", "scripts/check-address-consistency.ts"]),
    runGate("doc-coverage", "pnpm", ["exec", "tsx", "scripts/coverage/check-doc-coverage.ts"]),
    runGate("@aastar/core build", "pnpm", ["--filter", "@aastar/core", "build"]),
  ];
  for (const g of gates) {
    lines.push(`  ${g.ok ? "✅" : "❌"} ${g.label}`);
    for (const t of g.tail.split("\n")) if (t.trim()) lines.push(`       ${t}`);
  }
  lines.push("");
  lines.push("UPGRADE WORKLIST — what a sync PR would touch (dry-run)");
  const drifted = results.filter(hasDrift);
  if (!drifted.length) {
    lines.push("  (no drift detected — nothing to sync)");
  } else {
    for (const r of drifted) {
      lines.push(`  ${r.name}:`);
      for (const item of worklistFor(r)) lines.push(`    - ${item}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Output + exit
// ---------------------------------------------------------------------------
const anyDrift = results.some(hasDrift);

if (VERSIONS_OUT) {
  // Compact, human-verifiable version table: SDK pin vs the upstream's own latest.
  const rows = results.map((r) => {
    const vAnchor = r.anchors.find((a) => a.anchor === "version");
    const mark = vAnchor?.status === "in-sync" ? "✅" : vAnchor?.status === "drift" ? "⚠️ DRIFT" : "·";
    return { name: r.name, pin: r.pinnedVersion ?? "—", up: r.upstreamVersion ?? "—", mark };
  });
  const w = (sel: (x: (typeof rows)[number]) => string, h: string) =>
    Math.max(h.length, ...rows.map((x) => sel(x).length));
  const wN = w((x) => x.name, "Upstream");
  const wP = w((x) => x.pin, "SDK pin");
  const wU = w((x) => x.up, "Upstream latest");
  const pad = (s: string, n: number) => s + " ".repeat(n - s.length);
  console.log(`\n  ${pad("Upstream", wN)}  ${pad("SDK pin", wP)}  ${pad("Upstream latest", wU)}  Match`);
  console.log(`  ${"─".repeat(wN)}  ${"─".repeat(wP)}  ${"─".repeat(wU)}  ─────`);
  for (const x of rows) console.log(`  ${pad(x.name, wN)}  ${pad(x.pin, wP)}  ${pad(x.up, wU)}  ${x.mark}`);
  console.log(
    `\n  ${anyDrift ? "⚠️  DRIFT — SDK is NOT on all upstream latest; run `pnpm run upstream:check`" : "✅ all four upstreams match their latest"}\n`,
  );
  process.exit(anyDrift ? 1 : 0);
}

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        anyDrift,
        upstreams: results.map((r) => ({
          name: r.name,
          key: r.key,
          repo: r.repo,
          pinnedVersion: r.pinnedVersion,
          upstreamVersion: r.upstreamVersion,
          drift: hasDrift(r),
          anchors: r.anchors.map((a) => ({
            anchor: anchorLabel(r, a),
            status: a.status,
            findings: a.findings,
          })),
        })),
      },
      null,
      2,
    ),
  );
} else {
  console.log(renderHuman());
  if (REHEARSE) console.log(renderRehearse());
}

process.exit(anyDrift ? 1 : 0);
