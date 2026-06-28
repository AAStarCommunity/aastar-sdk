/**
 * Doc-coverage checker for the AAStar SDK (Beta5).
 *
 * Computes, with no hand-waving, what fraction of the upstream API/ABI surface
 * the SDK actually wraps. Three sources are parsed:
 *
 *   1. KMS API      — AirAccount/kms/docs/api/openapi.yaml (every `paths:` method+path)
 *   2. SuperPaymaster ABI — authoritative JSON ABIs in packages/core/src/abis/
 *   3. AirAccount ABI     — authoritative JSON ABIs in packages/core/src/abis/
 *
 * COVERAGE DEFINITION (applied uniformly):
 *   - A contract function is COVERED if its exact name appears in an SDK source
 *     file (packages/* + slash src, excluding tests + the abis dir) as either:
 *       (a) `functionName: '<fn>'`            (viem readContract/writeContract/encode)
 *       (b) `encodeFunctionData(..., '<fn>')` (ethers-style encoder)
 *     These are the "direct" signals — a deliberate SDK wrapper.
 *   - A function matched ONLY by a bare method call `.<fn>(` is reported as
 *     "indirect (verify)" — counted as covered but flagged as ambiguous, because
 *     generic names (name/approve/transfer/owner) collide with plain JS.
 *   - Otherwise it is a GAP.
 *   - A KMS endpoint is COVERED if a kms-* service references its exact path
 *     string (e.g. "/CreateKey", "/kms/SignTypedData").
 *
 * Exemptions are maintained below with explicit reasons. Anything not exempt and
 * not covered is reported as a real gap.
 *
 * Run: pnpm tsx scripts/coverage/check-doc-coverage.ts [--threshold=100]
 * Exits non-zero if (covered+exempt)/total for any source is below threshold.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..");

// ---------------------------------------------------------------------------
// Source locations
// ---------------------------------------------------------------------------
const OPENAPI = "/Users/jason/Dev/aastar/AirAccount/kms/docs/api/openapi.yaml";
const ABI_DIR = join(REPO, "packages", "core", "src", "abis");

// ABI file sets per source (authoritative JSON ABIs).
const SUPERPAYMASTER_ABIS = [
  "SuperPaymaster.json",
  "Registry.json",
  "GTokenStaking.json",
  "DVTValidator.json",
  "BLSAggregator.json",
  "MicroPaymentChannel.json",
  "xPNTsToken.json",
  "GToken.json",
  "ReputationSystem.json",
];

const AIRACCOUNT_ABIS = [
  "AAStarAirAccountV7.json",
  "AAStarAirAccountFactoryV7.json",
  "SessionKeyValidator.json",
  "ForceExitModule.json",
  "AgentRegistry.json",
  "AirAccountExtension.json",
];

// ---------------------------------------------------------------------------
// Exemptions allowlist (function/endpoint name -> reason). Kept deliberately
// small and justified. Everything else must be a real SDK wrapper or a gap.
// ---------------------------------------------------------------------------
const KMS_EXEMPT: Record<string, string> = {
  "GET /": "HTML landing page, not a programmatic endpoint",
  "GET /test": "HTML test page, not a programmatic endpoint",
  // openapi 0.27.2 contact-binding additions (#124/#129) — called by the DVT node / Telegram bot,
  // NOT the SDK's owner-facing contact-binding client (begin/confirm/get/unbind, v0.27.0). See sdk#193.
  "POST /verify-confirm-assertion": "DVT node RP-verifies a passkey OOB-confirm assertion (#124)",
  "POST /contact/claim-binding": "Telegram bot claims a binding code (#129)",
  "GET /contact/{account}": "DVT node lists verified contacts, DVT-api-key gated (#129)",
};

// Contract-level exemptions. Names here are excluded from BOTH SP and AA totals.
const ABI_EXEMPT: Record<string, string> = {
  // UUPS / proxy boilerplate — infra, never hand-wrapped.
  proxiableUUID: "UUPS proxy boilerplate (admin/infra-gated)",
  "UPGRADE_INTERFACE_VERSION": "UUPS proxy boilerplate (admin/infra-gated)",
  upgradeToAndCall: "UUPS upgrade entrypoint (admin-gated, governance only)",
  // ERC-165 / receiver hooks — invoked by the EVM/ERC standards, not the SDK.
  supportsInterface: "ERC-165 introspection, invoked by tooling not wrapped",
  onERC721Received: "ERC-721 receiver hook, called by token contracts",
  onERC1155Received: "ERC-1155 receiver hook, called by token contracts",
  onERC1155BatchReceived: "ERC-1155 receiver hook, called by token contracts",
  // Version constants — build metadata, not an integration call.
  ACCOUNT_VERSION: "Version string constant (AAStarAirAccountV7), not callable integration surface",
  FACTORY_VERSION: "Version string constant (AAStarAirAccountFactoryV7), not callable integration surface",
  // ForceExitModule L2-routing internals — system-contract addresses and chain-type
  // enums hard-wired for the module's cross-domain force-exit path; not SDK-facing.
  ARB_SYS: "Arbitrum ArbSys precompile address constant (ForceExitModule L2 routing internal)",
  L2_TO_L1_MESSAGE_PASSER_OP: "OP Stack L2ToL1MessagePasser predeploy address constant (ForceExitModule L2 routing internal)",
  L2_TYPE_ARBITRUM: "L2-type enum constant (ForceExitModule L2 routing internal)",
  L2_TYPE_OPTIMISM: "L2-type enum constant (ForceExitModule L2 routing internal)",
  OP_DEFAULT_GAS_LIMIT: "OP withdrawal default gas-limit constant (ForceExitModule L2 routing internal)",
};

// ---------------------------------------------------------------------------
// 1. Parse KMS openapi.yaml -> [{method, path}]
// ---------------------------------------------------------------------------
function parseOpenApi(): { method: string; path: string }[] {
  const text = readFileSync(OPENAPI, "utf8");
  const lines = text.split("\n");
  const out: { method: string; path: string }[] = [];
  let inPaths = false;
  let curPath = "";
  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (!inPaths) continue;
    // a top-level key (no indent) ends the paths block
    if (/^\S/.test(line) && !/^\s/.test(line)) break;
    const pathMatch = line.match(/^  (\/\S*):\s*$/);
    if (pathMatch) {
      curPath = pathMatch[1];
      continue;
    }
    const methodMatch = line.match(/^    (get|post|put|delete|patch):\s*$/);
    if (methodMatch && curPath) {
      out.push({ method: methodMatch[1].toUpperCase(), path: curPath });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2/3. Parse ABI JSON files -> unique external/public function names
// (ABIs only contain external/public functions by definition.)
// ---------------------------------------------------------------------------
function abiFunctions(file: string): string[] {
  const raw = JSON.parse(readFileSync(join(ABI_DIR, file), "utf8"));
  const abi = Array.isArray(raw) ? raw : raw.abi;
  const names = new Set<string>();
  for (const item of abi) {
    if (item.type === "function" && item.name) names.add(item.name);
  }
  return [...names];
}

function collectAbiNames(files: string[]): Map<string, string[]> {
  // name -> list of contracts (files) declaring it
  const map = new Map<string, string[]>();
  for (const f of files) {
    for (const name of abiFunctions(f)) {
      const arr = map.get(name) ?? [];
      arr.push(f.replace(".json", ""));
      map.set(name, arr);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// SDK source corpus (excludes tests + the abis dir)
// ---------------------------------------------------------------------------
function walk(dir: string, acc: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (
        entry === "node_modules" ||
        entry === "dist" ||
        entry === "__tests__" ||
        entry === "abis" ||
        entry === ".git"
      )
        continue;
      walk(full, acc);
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

function loadSdkCorpus(): string {
  const files: string[] = [];
  const pkgs = join(REPO, "packages");
  for (const pkg of readdirSync(pkgs)) {
    const src = join(pkgs, pkg, "src");
    try {
      if (statSync(src).isDirectory()) walk(src, files);
    } catch {
      /* no src dir */
    }
  }
  return files.map((f) => readFileSync(f, "utf8")).join("\n \n");
}

const SDK = loadSdkCorpus();

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Verdict = "direct" | "indirect" | "gap";

function classifyFn(name: string): Verdict {
  const n = esc(name);
  // (a) functionName: 'fn'  /  (b) encodeFunctionData(..., 'fn')
  const direct =
    new RegExp(`functionName:\\s*['"\`]${n}['"\`]`).test(SDK) ||
    new RegExp(`encodeFunctionData\\([^)]*['"\`]${n}['"\`]`).test(SDK);
  if (direct) return "direct";
  // (c) bare method call .fn(  -> ambiguous, flagged
  if (new RegExp(`\\.${n}\\(`).test(SDK)) return "indirect";
  return "gap";
}

function classifyKms(method: string, path: string): Verdict {
  // KMS coverage = the exact path string literal referenced in SDK services.
  const p = esc(path);
  if (new RegExp(`['"\`]${p}['"\`]`).test(SDK)) return "direct";
  return "gap";
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
interface SourceResult {
  name: string;
  total: number; // non-exempt items
  direct: number;
  indirect: number;
  gaps: { name: string; note?: string }[];
  exempt: { name: string; reason: string }[];
  indirectList: { name: string; note?: string }[];
}

const threshold = (() => {
  const arg = process.argv.find((a) => a.startsWith("--threshold="));
  return arg ? Number(arg.split("=")[1]) : 100;
})();

function pct(n: number, d: number): string {
  if (d === 0) return "100.0";
  return ((n / d) * 100).toFixed(1);
}

function analyzeKms(): SourceResult {
  const endpoints = parseOpenApi();
  const res: SourceResult = {
    name: "KMS API (openapi.yaml)",
    total: 0,
    direct: 0,
    indirect: 0,
    gaps: [],
    exempt: [],
    indirectList: [],
  };
  for (const { method, path } of endpoints) {
    const key = `${method} ${path}`;
    if (KMS_EXEMPT[key]) {
      res.exempt.push({ name: key, reason: KMS_EXEMPT[key] });
      continue;
    }
    res.total++;
    const v = classifyKms(method, path);
    if (v === "direct") res.direct++;
    else res.gaps.push({ name: key });
  }
  return res;
}

function analyzeAbi(name: string, files: string[]): SourceResult {
  const map = collectAbiNames(files);
  const res: SourceResult = {
    name,
    total: 0,
    direct: 0,
    indirect: 0,
    gaps: [],
    exempt: [],
    indirectList: [],
  };
  for (const fn of [...map.keys()].sort()) {
    const contracts = map.get(fn)!.join(",");
    if (ABI_EXEMPT[fn]) {
      res.exempt.push({ name: `${fn} (${contracts})`, reason: ABI_EXEMPT[fn] });
      continue;
    }
    res.total++;
    const v = classifyFn(fn);
    if (v === "direct") res.direct++;
    else if (v === "indirect") {
      res.indirect++;
      res.indirectList.push({ name: `${fn} (${contracts})` });
    } else {
      res.gaps.push({ name: `${fn} (${contracts})` });
    }
  }
  return res;
}

function renderSource(r: SourceResult, lines: string[]): void {
  const covered = r.direct + r.indirect;
  lines.push(`### ${r.name}`);
  lines.push("");
  lines.push(`- Total (non-exempt): **${r.total}**`);
  lines.push(`- Covered: **${covered}** (${pct(covered, r.total)}%) — direct: ${r.direct}, indirect/verify: ${r.indirect}`);
  lines.push(`- Gaps: **${r.gaps.length}**`);
  lines.push(`- Exempt: ${r.exempt.length}`);
  lines.push("");
  if (r.gaps.length) {
    lines.push(`**Gaps (${r.gaps.length}) — no SDK wrapper found:**`);
    lines.push("");
    for (const g of r.gaps) lines.push(`- \`${g.name}\`${g.note ? ` — ${g.note}` : ""}`);
    lines.push("");
  }
  if (r.indirectList.length) {
    lines.push(`**Indirect / verify (${r.indirectList.length}) — only a bare \`.fn(\` reference, ambiguous:**`);
    lines.push("");
    for (const g of r.indirectList) lines.push(`- \`${g.name}\``);
    lines.push("");
  }
  if (r.exempt.length) {
    lines.push(`**Exempt (${r.exempt.length}):**`);
    lines.push("");
    for (const e of r.exempt) lines.push(`- \`${e.name}\` — ${e.reason}`);
    lines.push("");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const kms = analyzeKms();
const sp = analyzeAbi("SuperPaymaster ABI", SUPERPAYMASTER_ABIS);
const aa = analyzeAbi("AirAccount ABI", AIRACCOUNT_ABIS);

const sources = [kms, sp, aa];
const lines: string[] = [];
lines.push("# AAStar SDK — Doc Coverage Report");
lines.push("");
lines.push(`> Generated by \`scripts/coverage/check-doc-coverage.ts\` on ${new Date().toISOString().slice(0, 10)}.`);
lines.push("> Coverage = SDK source references an upstream API/ABI function by name.");
lines.push("");

// Summary table
lines.push("## Summary");
lines.push("");
lines.push("| Source | Total | Covered | Coverage % | Gaps | Exempt |");
lines.push("|---|---|---|---|---|---|");
let gTotal = 0,
  gCovered = 0,
  gGaps = 0;
for (const r of sources) {
  const covered = r.direct + r.indirect;
  gTotal += r.total;
  gCovered += covered;
  gGaps += r.gaps.length;
  lines.push(`| ${r.name} | ${r.total} | ${covered} | ${pct(covered, r.total)}% | ${r.gaps.length} | ${r.exempt.length} |`);
}
lines.push(`| **OVERALL** | **${gTotal}** | **${gCovered}** | **${pct(gCovered, gTotal)}%** | **${gGaps}** | — |`);
lines.push("");

lines.push("## Coverage definition");
lines.push("");
lines.push("- **direct**: SDK contains `functionName: '<fn>'` or `encodeFunctionData(..., '<fn>')` (a deliberate wrapper).");
lines.push("- **indirect/verify**: only a bare `.<fn>(` method-call reference — counted as covered but ambiguous (generic JS names collide); should be confirmed manually.");
lines.push("- **gap**: no SDK reference to the name at all.");
lines.push("- **KMS**: an endpoint is covered when a kms-* service references its exact path string. `GET /` and `GET /test` (HTML pages) are exempt.");
lines.push("");

lines.push("## Per-source detail");
lines.push("");
for (const r of sources) renderSource(r, lines);

const report = lines.join("\n");

// Write report
const reportPath = join(REPO, "docs", "coverage-report.md");
mkdirSync(join(REPO, "docs"), { recursive: true });
writeFileSync(reportPath, report + "\n");

// Console output
console.log(report);

// Threshold gate: (covered+exempt are removed from total already) -> coverage% per source
let failed = false;
for (const r of sources) {
  const covered = r.direct + r.indirect;
  const p = r.total === 0 ? 100 : (covered / r.total) * 100;
  if (p < threshold) {
    console.error(`\n[FAIL] ${r.name}: ${p.toFixed(1)}% < threshold ${threshold}%`);
    failed = true;
  }
}
console.error(`\nReport written to ${reportPath}`);
process.exit(failed ? 1 : 0);
