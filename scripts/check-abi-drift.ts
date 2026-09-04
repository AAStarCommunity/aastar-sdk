#!/usr/bin/env tsx
/**
 * Upstream ABI value-drift check.
 *
 * `check:abi` (completeness) catches a MISSING contract. This catches the other half: a contract
 * that IS in the SDK but whose ABI has DRIFTED from the upstream — i.e. the upstream added/changed/
 * removed a function (and redeployed), but the SDK's copy is stale. Stale ABI → wrong selector /
 * arg layout → silent revert or bad decode (e.g. launch added `buyTokensFor`; SuperPaymaster upgrades).
 *
 * For every SDK ABI that has a matching upstream foundry artifact (`<C>.sol/<C>.json` in the repo's
 * `out/`), it compares the function/event/error SIGNATURE SETS (name + input types — what determines
 * the selector). Mismatch ⇒ drift. ABIs with no matching upstream artifact (EntryPoint, ERC20, other
 * standard/external) or whose upstream repo isn't checked out locally are skipped.
 *
 * Run: pnpm run check:abi-drift   (sibling repos must be present + freshly `forge build`-ed)
 */
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { keccak256 } from 'viem';

const SDK_ROOT = process.cwd();
const ABIS_DIR = path.join(SDK_ROOT, 'packages/core/src/abis');

// CC-115 B4. Contracts whose authoritative upstream is the DEPLOYED artifact, not the compiler's
// `out/`. BLSAggregator is the case that forced this: SuperPaymaster's `contracts/src` is 4.12.0,
// the deployed Sepolia contract is 4.11.0, and the contract is not upgradeable, so 4.12.0 is on no
// chain. 4.11.0 is a strict SUBSET of 4.12.0, which is what makes the mismatch dangerous rather
// than merely wrong: 71 of 72 functions behave identically, and the 72nd — guardianSlashCases —
// keeps its selector while changing its return arity, so it decodes wrongly instead of reverting.
// The redirect target is itself hash-pinned (deployedStack.sepolia.aggregator.abi) and verified
// against the upstream git blob by scripts/repcredit/deployed-stack.ts, so the chain of custody
// runs: upstream commit -> blob sha256 -> vendored artifact -> this diff -> abiSha256 pin.
const DEPLOYED_ABI_REDIRECT = new Set<string>(['BLSAggregator']);

/** Redirect-target custody failures. Non-empty => the run fails, exactly like a drift. */
const redirectFailures: string[] = [];

/**
 * The redirect is driven by the PIN, not by this file's constant list.
 *
 * That matters for more than tidiness: the synthetic-upstream harness in
 * `abi-drift-provenance.test.ts` builds a pin with no `deployedStack`, and a redirect that engaged
 * regardless turned BLSAggregator into a permanently-missing must-verify artifact there — 31 tests
 * red, none of them about anything real. A pin that does not declare a deployed artifact does not
 * get one. A pin that DOES declare one and cannot produce it is a hard failure, handled at the call
 * site, so the dangerous direction (silently falling back to the 4.12.0 out/ artifact) stays shut.
 */
function redirectTargetFor(name: string): string | null {
  if (!DEPLOYED_ABI_REDIRECT.has(name)) return null;
  const vendoredAt = (PIN as { deployedStack?: Record<string, { aggregator?: { abi?: { vendoredAt?: string } } }> })
    .deployedStack?.sepolia?.aggregator?.abi?.vendoredAt;
  return typeof vendoredAt === 'string' && vendoredAt.length > 0 ? vendoredAt : null;
}

/**
 * The custody chain for a redirected artifact: it must be byte-identical to the blob at the pinned
 * upstream revision named in `deployedStack`.
 *
 * Read from the git OBJECT (`git show <rev>:<path>`), never the sibling worktree — an unrelated
 * uncommitted file upstream would otherwise decide whether this passes, which is the same
 * attribution hole the solc-metadata path already closes for compiled artifacts.
 */
function verifyRedirectedBlob(name: string, vendoredPath: string): { ok: boolean; detail: string } {
  const stack = (PIN as { deployedStack?: Record<string, { aggregator?: { abi?: Record<string, string> } }> })
    .deployedStack?.sepolia?.aggregator?.abi;
  if (!stack?.repo || !stack.revision || !stack.path || !stack.sha256) {
    return { ok: false, detail: 'deployedStack.sepolia.aggregator.abi is missing repo/revision/path/sha256' };
  }
  const root = OUT_DIRS.map((d) => path.resolve(d, '../')).find((r) => path.basename(r) === stack.repo);
  if (!root) return { ok: false, detail: `no checkout of ${stack.repo} among the scanned upstreams` };
  const local = createHash('sha256').update(new Uint8Array(fs.readFileSync(vendoredPath))).digest('hex');
  if (local !== stack.sha256) {
    return { ok: false, detail: `${path.relative(SDK_ROOT, vendoredPath)} hashes ${local.slice(0, 16)} but the pin says ${stack.sha256.slice(0, 16)}` };
  }
  try {
    const blob = execFileSync('git', ['-C', root, 'show', `${stack.revision}:${stack.path}`], {
      maxBuffer: 64 * 1024 * 1024,
    });
    const blobHash = createHash('sha256').update(new Uint8Array(blob as unknown as ArrayBufferLike as never)).digest('hex');
    if (blobHash !== stack.sha256) {
      return { ok: false, detail: `${stack.repo}@${stack.revision.slice(0, 12)}:${stack.path} hashes ${blobHash.slice(0, 16)}, pin says ${stack.sha256.slice(0, 16)}` };
    }
    return { ok: true, detail: `byte-identical to ${stack.repo}@${stack.revision.slice(0, 12)}:${stack.path} (${stack.sha256.slice(0, 16)}…)` };
  } catch (error) {
    return { ok: false, detail: `cannot read ${stack.repo}@${stack.revision.slice(0, 12)}:${stack.path} — ${String(error).slice(0, 120)}` };
  }
}

// Upstream foundry `out/` dirs (sibling checkouts). First match for a contract name wins.
const OUT_DIRS = [
  '../SuperPaymaster/out',
  '../airaccount-contract/out',
  '../../mycelium/launch/contracts/out',
]
  .map((d) => path.resolve(SDK_ROOT, d))
  .filter((d) => fs.existsSync(d));

// SDK ABIs that are not single-contract artifacts (config blobs etc.) — never drift-checked.
const NON_CONTRACT = new Set(['abi.config']);

// Standard / external contracts whose SDK ABI comes from the official ERC-4337 / OpenZeppelin source,
// NOT from our upstream repos (which only keep local test/reference copies). Comparing against the
// upstream copy is apples-to-oranges, so exclude them from drift.
const STANDARD_EXTERNAL = new Set([
  'EntryPoint', 'SenderCreator', 'UserOperationLib',
  'SimpleAccount', 'SimpleAccountFactory', 'SimpleAccountV08', 'SimpleAccountFactoryV08',
  'Simple7702Account', 'LegacyAccount', 'ERC20',
]);

// Contracts whose SDK ABI intentionally differs from the bare upstream artifact (documented reason).
const KNOWN_DRIFT = new Map<string, string>([
  [
    'AAStarAirAccountV7',
    'SDK ABI intentionally merges the AirAccountExtension surface — those calls route through the ' +
      'V7 fallback→delegatecall, so consumers encode them against the account address.',
  ],
]);

// SDK ABI name collides with an UNRELATED upstream contract of the same name. The SDK tracks a
// different source than the OUT_DIRS scanned here, so diffing against the scanned artifact is a false
// positive. AAStarBLSAlgorithm: the SDK tracks the YetAnotherAA-Validator (DVT) contract that carries
// `registerWithProof(pubkey,popPoint,popSig)` (CC-17 / YAAA #165). airaccount-contract also has a
// same-named `src/validators/AAStarBLSAlgorithm.sol`, but v0.27.0 (#45 Part B) refactored it into a
// pure Safe-owned key aggregator (aggregateKeys/cacheAggregatedKey, no registerWithProof) — a distinct
// contract the SDK does NOT consume. YAAA isn't a scanned out/ dir, so skip rather than false-flag.
// See CC-27 (upstream rename decision) and scripts/abi-sync.ts (same skip).
const NAME_COLLISIONS = new Set(['AAStarBLSAlgorithm']);

function loadAbi(file: string): any[] {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(raw) ? raw : raw.abi || [];
}

/** name(intype1,intype2,…) for each entry of `kind` — the selector-determining signature. */
/**
 * Render a parameter type, EXPANDING tuples into their component types.
 *
 * Using the bare `type` field renders every struct as the literal string "tuple", so a struct that
 * gains, loses or reorders fields produces an IDENTICAL signature and this gate reports no drift.
 * That is not hypothetical: airaccount-contract #161 added tier1Limit/tier2Limit to InitConfig
 * (8 -> 10 fields) and `getAddress(address,uint256,tuple,bytes32,bytes32)` matched on both sides,
 * so the gate stayed green while `createAccount`/`getAddress` reverted on-chain against the new
 * factory. Expanding components is what makes a breaking struct change visible.
 */
function renderType(i: any): string {
  if (typeof i?.type === 'string' && i.type.startsWith('tuple') && Array.isArray(i.components)) {
    // Preserve any array suffix: tuple[] -> (a,b)[], tuple[2] -> (a,b)[2].
    const suffix = i.type.slice('tuple'.length);
    return `(${i.components.map(renderType).join(',')})${suffix}`;
  }
  return i?.type ?? '?';
}

function sigSet(abi: any[], kind: string): Set<string> {
  return new Set(
    abi
      .filter((e) => e.type === kind && e.name)
      .map((e) => `${e.name}(${(e.inputs || []).map(renderType).join(',')})`),
  );
}

function findUpstreamArtifact(name: string): string | null {
  for (const out of OUT_DIRS) {
    const dir = path.join(out, `${name}.sol`);
    const exact = path.join(dir, `${name}.json`);
    if (fs.existsSync(exact)) return exact;

    // FU-20. Foundry writes `<C>.<profile>.json` instead of `<C>.json` when the build ran under a
    // named profile, and `out/` keeps both shapes side by side. Measured: two checkouts of
    // SuperPaymaster at the SAME revision with a byte-identical root foundry.toml produced
    // `SuperPaymaster.json` in one and `SuperPaymaster.default.json` in the other, purely from how
    // the build was invoked. Only the second was invisible here.
    //
    // The old failure told the reader "the upstream needs `forge build`" — which had already been
    // run twice, including after `rm -rf out`. The advice was not merely unhelpful, it was wrong
    // about what was missing: not the build, the filename. So recognise the shape rather than
    // improve the wording; a gate that names the wrong cause sends people to fix the wrong thing.
    if (!fs.existsSync(dir)) continue;
    const profiled = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(`${name}.`) && f.endsWith('.json'))
      .sort();
    // Exactly one candidate is unambiguous. Several means the profiles disagree about what this
    // contract IS, and picking one silently would make the gate's answer depend on readdir order —
    // so say so and let the caller treat it as missing.
    if (profiled.length === 1) return path.join(dir, profiled[0]);
    if (profiled.length > 1) {
      profiledAmbiguity.set(name, profiled);
    }
  }
  return null;
}

/** Contracts whose out/ dir holds several `<C>.<profile>.json` and no unambiguous `<C>.json`. */
const profiledAmbiguity = new Map<string, string[]>();

// Upstream SOURCE trees (sibling checkouts), used to decide whether an SDK ABI is EXPECTED to have
// an upstream artifact. Sources are the right oracle here because `forge clean` removes `out/` but
// never `src/`: "the contract exists upstream but its artifact is missing" is exactly the state that
// used to turn into a silent skip.
const SRC_DIRS: { label: string; dir: string }[] = [
  { label: 'SuperPaymaster', dir: '../SuperPaymaster/contracts/src' },
  { label: 'airaccount-contract', dir: '../airaccount-contract/src' },
  { label: 'launch', dir: '../launch/contracts/src' },
  { label: 'launch', dir: '../../mycelium/launch/contracts/src' },
]
  .map((e) => ({ ...e, dir: path.resolve(SDK_ROOT, e.dir) }))
  .filter((e) => fs.existsSync(e.dir));


// ---------------------------------------------------------------------------------------------
// UPSTREAM PROVENANCE (CC-50 round-4 MEDIUM-1)
//
// "checked 30 ABIs, here are their sha256s" still cannot say WHICH upstream revision produced
// them. A gate that reports green off a colleague's uncommitted edits is the next layer of the
// same vacuous-PASS problem strict mode was added to remove — measured for real: this script
// printed all four MUST_VERIFY ✅ while the SuperPaymaster worktree had 23 uncommitted changes,
// including Registry.sol and BLSAggregator.sol themselves.
//
// The chain this now establishes, end to end:
//
//   SDK ABI  ==(signature sets)==>  upstream artifact
//   artifact ==(solc metadata keccak256 of every source file)==>  on-disk source
//   source   ==(git status clean)==>  the committed revision
//   revision ==(scripts/upstream-abi-pin.json)==>  the revision that was reviewed
//
// Break any link and strict/release mode fails. The solc metadata hash is what makes the middle
// link cryptographic rather than a timestamp heuristic: a stale artifact (built before the last
// source edit) and a "too new" artifact (built from sources that were since reverted) both show
// up as a keccak mismatch, in either direction.
// ---------------------------------------------------------------------------------------------

type RepoProvenance = {
  label: string;
  root: string;
  revision: string | null;
  dirtyPaths: string[];
  /** Why this checkout cannot be used as a pinned reference, or null when it can. */
  unusable: string | null;
};

const PIN_FILE = path.join(SDK_ROOT, 'scripts/upstream-abi-pin.json');

type Pin = {
  repos?: Record<string, { revision: string; why?: string }>;
  contracts?: Record<string, {
    abiSha256: string;
    /** which pinned upstream repo owns this contract's canonical source (must-verify only) */
    repo?: string;
    /** the canonical, repo-relative source file that declares this contract (must-verify only) */
    sourcePath?: string;
    why?: string;
  }>;
};

function loadPin(): Pin {
  if (!fs.existsSync(PIN_FILE)) return {};
  return JSON.parse(fs.readFileSync(PIN_FILE, 'utf8')) as Pin;
}

const PIN = loadPin();

/**
 * The REVIEWED source file for a must-verify contract: `contracts[<name>].{repo,sourcePath}`.
 *
 * CC-50 round-8 MEDIUM. Round-7 made the artifact's own `compilationTarget` the only accepted
 * answer to "which file declares this contract", and forced its single entry's VALUE to be the
 * contract name — but nothing ever checked the KEY. An independent reviewer measured
 * `{ "contracts/src/Unrelated.sol": "Registry" }` exiting 0 under `--strict` with the
 * unconditional PASS while `contracts/src/Registry.sol` appeared nowhere in the output and zero of
 * its bytes were hashed. A stale artifact left behind by a rename/move produces exactly that shape
 * on its own: the old path is still on disk, still hashes correctly, and now holds something else.
 *
 * So the release basis is a path this repo REVIEWED and committed, not something derived from the
 * artifact. Deliberately NOT a basename match, NOT `sourceName`, and NOT a `contract <Name>` regex
 * over the file: the first two are the guesses round-7 removed, and a regex reads bytes the artifact
 * itself chose and can be satisfied by a comment or a string literal — useful as a sanity check,
 * never as the thing a release stands on. A byte-exact comparison against a human-reviewed pin has
 * no such failure mode, and it makes moving a contract a REVIEWABLE diff in this repo.
 *
 * A missing or malformed pin is a hard failure for a must-verify contract, not a skip: "we have no
 * reviewed answer" must never read as "the artifact's answer is fine".
 */
type PinnedSource = { repo: string; sourcePath: string };

function pinnedSourceFor(name: string): { pin: PinnedSource | null; problem: string | null; label: string } {
  const bad = (problem: string, label: string) => ({ pin: null, problem, label });
  const entry = PIN.contracts?.[name];
  if (!entry) {
    return bad(
      `scripts/upstream-abi-pin.json declares no entry for ${name}, so no reviewed source path exists ` +
        `for a must-verify contract`,
      'NO PINNED SOURCE PATH',
    );
  }
  const { repo, sourcePath } = entry;
  if (typeof sourcePath !== 'string' || !sourcePath.length || typeof repo !== 'string' || !repo.length) {
    return bad(
      `scripts/upstream-abi-pin.json declares no contracts.${name}.repo + contracts.${name}.sourcePath — ` +
        `a must-verify contract must pin the canonical source file that declares it`,
      'NO PINNED SOURCE PATH',
    );
  }
  // The pin is compared byte-exact against the artifact's declaration and then resolved under the
  // upstream repo root, so it must be an unambiguous repo-relative POSIX path. `..` would let a pin
  // point outside the very repo whose clean, pinned revision is the evidence.
  const segments = sourcePath.split('/');
  const shape =
    sourcePath.includes('\\')
      ? 'contains a backslash (POSIX, repo-relative paths only)'
      : /^[A-Za-z]:/.test(sourcePath) || sourcePath.startsWith('/')
        ? 'is absolute — a pinned source must be relative to the upstream repo root'
        : segments.some((s) => s === '' || s === '.' || s === '..')
          ? 'contains an empty, "." or ".." segment — it must not be able to escape the repo it is pinned to'
          : path.posix.normalize(sourcePath) !== sourcePath
            ? 'is not a normalised path'
            : !sourcePath.endsWith('.sol')
              ? 'does not name a .sol file'
              : null;
  if (shape) {
    return bad(`the pinned contracts.${name}.sourcePath "${sourcePath}" ${shape}`, 'PINNED SOURCE PATH INVALID');
  }
  if (!PIN.repos?.[repo]?.revision) {
    return bad(
      `contracts.${name}.repo is "${repo}", which declares no repos["${repo}"].revision — a pinned source ` +
        `path is only evidence when the repo it lives in is itself pinned to a reviewed revision`,
      'PINNED SOURCE PATH INVALID',
    );
  }
  return { pin: { repo, sourcePath }, problem: null, label: '' };
}

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

const repoCache = new Map<string, RepoProvenance>();

/** git repo that owns `somePath`, with its revision and working-tree state. */
function repoProvenanceFor(somePath: string): RepoProvenance | null {
  let root: string;
  try {
    root = git(path.dirname(somePath), ['rev-parse', '--show-toplevel']).trim();
  } catch {
    return null;
  }
  const cached = repoCache.get(root);
  if (cached) return cached;
  const label = path.basename(root);
  let provenance: RepoProvenance;
  try {
    const revision = git(root, ['rev-parse', 'HEAD']).trim();
    const dirtyPaths = git(root, ['status', '--porcelain'])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    provenance = { label, root, revision, dirtyPaths, unusable: null };
    const declared = PIN.repos?.[label]?.revision;
    if (declared && !revision.startsWith(declared)) {
      provenance.unusable = `pinned at ${declared} (scripts/upstream-abi-pin.json) but the checkout is at ${revision}`;
    } else if (dirtyPaths.length) {
      provenance.unusable =
        `${dirtyPaths.length} uncommitted change(s) — the artifacts in out/ cannot be attributed to ` +
        `revision ${revision.slice(0, 8)}`;
    }
  } catch (error) {
    provenance = { label, root, revision: null, dirtyPaths: [], unusable: `not a usable git checkout: ${String(error)}` };
  }
  repoCache.set(root, provenance);
  return provenance;
}

// ---------------------------------------------------------------------------------------------
// BYTE ATTRIBUTION TO THE PINNED REVISION (CC-50 round-9 MEDIUM)
//
// Round-8 nailed down WHICH path a must-verify artifact must have been compiled from (a reviewed
// constant in `scripts/upstream-abi-pin.json`). It never established that the BYTES at that path
// are bytes the pinned revision actually contains. The whole in-repo test was
// `path.resolve(root, rel).startsWith(root + sep)` — a string prefix — and `readFileSync` then
// followed whatever the path pointed at. An independent reviewer measured `--strict` exit 0, an
// unconditional PASS and `Attributed to committed upstream revision(s): SuperPaymaster@…` on an
// upstream that had committed `contracts/src/core/Registry.sol` as a SYMLINK to a file outside the
// repo: solc hashed the target's bytes, the gate re-hashed the same target's bytes, and the
// revision named in the green sentence contained only the link.
//
// So attribution is now proved, not inferred, and every link is a separate falsifiable check:
//
//   1. WHAT THE WORKING-TREE PATH IS — `lstat` (never `stat`: following the link is the bypass).
//      A symlink, directory, fifo or device is rejected outright, whatever it points at.
//   2. WHERE IT REALLY IS — `realpath` of the file must be under `realpath` of the repo root, so a
//      path that leaves the tree through any intermediate directory link is caught too.
//   3. WHAT THE PINNED TREE SAYS THAT PATH IS — `git ls-tree -r <pinnedRevision>` must have the
//      path as a REGULAR blob (mode 100644/100755). Mode 120000 (symlink) and 160000 (submodule
//      gitlink) are rejected: `git show <rev>:<path>` prints a symlink's target text quite happily,
//      so the mode has to be read explicitly rather than inferred from the content.
//   4. THE BYTES THEMSELVES — `git cat-file blob <oid>` (what `git show <rev>:<path>` yields) must
//      be byte-identical to the working-tree file this run read.
//
// Only then is the artifact's `metadata.sources[path].keccak256` compared, and it is compared
// against the PINNED blob's bytes — the ones the run just proved the revision contains — rather
// than against whatever the working tree happened to hand over. Any failure keeps the entry out of
// `verified`, so strict fails closed and the PASS may not claim attribution.
// ---------------------------------------------------------------------------------------------

/** One `git ls-tree` record: the file mode, the object type, and the object id. */
type TreeEntry = { mode: string; type: string; oid: string };

const treeCache = new Map<string, Map<string, TreeEntry> | null>();

/** The full recursive tree of `revision`: repo-relative path -> entry. null when the rev is absent. */
function pinnedTree(root: string, revision: string): Map<string, TreeEntry> | null {
  const key = `${root}@${revision}`;
  const cached = treeCache.get(key);
  if (cached !== undefined) return cached;
  let raw: string;
  try {
    // -z: NUL-separated, unquoted paths. Without it git quotes anything non-ASCII and the map keys
    // would silently stop matching the artifact's source paths.
    raw = git(root, ['ls-tree', '-r', '-z', revision]);
  } catch {
    treeCache.set(key, null);
    return null;
  }
  const tree = new Map<string, TreeEntry>();
  for (const record of raw.split('\0')) {
    if (!record) continue;
    const tab = record.indexOf('\t');
    if (tab < 0) continue;
    const [mode, type, oid] = record.slice(0, tab).split(/\s+/);
    tree.set(record.slice(tab + 1), { mode, type, oid });
  }
  treeCache.set(key, tree);
  return tree;
}

const blobCache = new Map<string, Uint8Array | null>();

/**
 * The bytes of one git object — exactly what `git show <revision>:<path>` writes.
 *
 * `Uint8Array`, not `Buffer`: this file is inside the repcredit tsc project now, and under the
 * repo's `lib: ESNext` a Node `Buffer` and a `Uint8Array` are not mutually assignable
 * (CC-50 round-9 LOW). Everything downstream — viem's `keccak256`, the byte comparison — wants the
 * plain array anyway.
 */
function pinnedBlob(root: string, oid: string): Uint8Array | null {
  const key = `${root}@${oid}`;
  const cached = blobCache.get(key);
  if (cached !== undefined) return cached;
  let bytes: Uint8Array | null;
  try {
    bytes = new Uint8Array(execFileSync('git', ['-C', root, 'cat-file', 'blob', oid], { maxBuffer: 64 * 1024 * 1024 }));
  } catch {
    bytes = null;
  }
  blobCache.set(key, bytes);
  return bytes;
}

/** Byte-for-byte equality. Written out rather than `Buffer.equals` for the same typing reason. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

const realRootCache = new Map<string, string>();

function canonicalRoot(root: string): string {
  const cached = realRootCache.get(root);
  if (cached !== undefined) return cached;
  let real: string;
  try {
    real = fs.realpathSync.native(root);
  } catch {
    real = root;
  }
  realRootCache.set(root, real);
  return real;
}

/** Where a pinned path was found: which repo, at which revision, and through which gitlink(s). */
type Located = { root: string; revision: string; entry: TreeEntry; via: string | null };

/** How many nested submodule hops a source path may take before this run gives up. */
const MAX_SUBMODULE_DEPTH = 3;

/**
 * Find `relative` in `revision`'s tree, following PINNED submodule gitlinks when it is not a direct
 * entry.
 *
 * Foundry dependencies live in submodules (`contracts/lib/chainlink-brownie-contracts/...`), and
 * `ls-tree -r` does not recurse into them — it records the gitlink and stops. Refusing those bytes
 * outright would be wrong in the other direction: the superproject's pinned revision DOES fix them,
 * via the exact commit id recorded in the gitlink, so the chain stays cryptographic end to end:
 *
 *     superproject@<pinned rev>  ->  gitlink oid  ->  blob in the submodule  ->  bytes
 *
 * What is still refused is a gitlink AT the source path itself: a submodule pointer is not a file
 * solc can compile, and `git show <rev>:<path>` on one prints a pointer, not source.
 */
function locatePinnedEntry(
  root: string,
  revision: string,
  relative: string,
  depth = 0,
): Located | { label: string; why: string } {
  const short = revision.slice(0, 12);
  const tree = pinnedTree(root, revision);
  if (!tree) {
    return {
      label: 'PINNED REVISION UNAVAILABLE',
      why:
        `revision ${short} is not present in ${path.basename(root)}, so nothing can be attributed to it` +
        `${depth ? ' (reached through a submodule gitlink — the submodule checkout is missing or stale)' : ''}`,
    };
  }
  const direct = tree.get(relative);
  if (direct) return { root, revision, entry: direct, via: null };

  const segments = relative.split('/');
  for (let i = segments.length - 1; i > 0; i -= 1) {
    const prefix = segments.slice(0, i).join('/');
    // `ls-tree -r` lists blobs and gitlinks only, so a hit on a directory prefix can ONLY be a
    // submodule. Anything else means this path simply is not in the tree.
    const gitlink = tree.get(prefix);
    if (!gitlink) continue;
    if (gitlink.type !== 'commit' && gitlink.mode !== '160000') break;
    if (depth >= MAX_SUBMODULE_DEPTH) {
      return {
        label: 'SOURCE ABSENT FROM PINNED REVISION',
        why: `${relative} is nested more than ${MAX_SUBMODULE_DEPTH} submodules deep; refusing to keep descending`,
      };
    }
    const nested = locatePinnedEntry(
      path.join(root, prefix),
      gitlink.oid,
      segments.slice(i).join('/'),
      depth + 1,
    );
    if ('label' in nested) return nested;
    const hop = `${prefix}@${gitlink.oid.slice(0, 12)}`;
    return { ...nested, via: nested.via ? `${hop} -> ${nested.via}` : hop };
  }
  return { label: 'SOURCE ABSENT FROM PINNED REVISION', why: `${relative} does not exist in ${short}` };
}

/** Bytes this run proved belong to the pinned revision, or the reason it could not prove that. */
type Attribution = { bytes: Uint8Array } | { label: string; why: string };

function attributeToPinnedRevision(repoRoot: string, relative: string, revision: string | null): Attribution {
  const file = path.resolve(repoRoot, relative);
  // 1. WHAT THE PATH IS. `lstat`, never `stat`: `stat` answers for the link TARGET, which is the
  //    question this check exists to refuse.
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(file);
  } catch {
    return { label: 'WORKTREE SOURCE MISSING', why: `${relative} is not on disk in this checkout` };
  }
  if (stat.isSymbolicLink()) {
    let target = '<unreadable>';
    try {
      target = fs.readlinkSync(file);
    } catch {
      /* the link is there; where it points is a detail of the message, not of the verdict */
    }
    return {
      label: 'WORKTREE SOURCE NOT A REGULAR FILE',
      why:
        `${relative} is a symbolic link -> ${target}. Its bytes belong to whatever it points at, so a ` +
        `revision that contains the LINK does not contain them — however perfectly they hash`,
    };
  }
  if (!stat.isFile()) {
    return { label: 'WORKTREE SOURCE NOT A REGULAR FILE', why: `${relative} is not a regular file` };
  }
  // 2. WHERE IT REALLY IS. A prefix test over the unresolved path cannot see a link anywhere in the
  //    chain; `realpath` collapses every one of them (and normalises macOS /tmp -> /private/tmp).
  let real: string;
  try {
    real = fs.realpathSync.native(file);
  } catch {
    return { label: 'WORKTREE SOURCE MISSING', why: `${relative} could not be resolved on disk` };
  }
  const root = canonicalRoot(repoRoot);
  if (real !== root && !real.startsWith(root + path.sep)) {
    return {
      label: 'WORKTREE SOURCE ESCAPES THE REPO',
      why: `${relative} resolves to ${real}, which is outside ${root} — this repo's revision cannot attest to it`,
    };
  }
  // 3. WHAT THE PINNED TREE SAYS THAT PATH IS.
  if (!revision) {
    return {
      label: 'NO PINNED REVISION',
      why:
        `${relative} cannot be attributed: scripts/upstream-abi-pin.json declares no revision for the repo ` +
        `this artifact came from`,
    };
  }
  const short = revision.slice(0, 12);
  const located = locatePinnedEntry(repoRoot, revision, relative);
  if ('label' in located) return located;
  const { entry } = located;
  const through = located.via ? ` (through pinned submodule ${located.via})` : '';
  if (entry.type !== 'blob' || (entry.mode !== '100644' && entry.mode !== '100755')) {
    const kind =
      entry.mode === '120000'
        ? 'a SYMLINK'
        : entry.mode === '160000' || entry.type === 'commit'
          ? 'a SUBMODULE gitlink'
          : `${entry.type} with mode ${entry.mode}`;
    return {
      label: 'PINNED TREE ENTRY NOT A REGULAR BLOB',
      why:
        `${relative} is ${kind} in ${short}${through}, not a regular file blob — \`git show ${short}:${relative}\` ` +
        `would print its target/pointer, not the source the artifact was compiled from`,
    };
  }
  // 4. THE BYTES THEMSELVES.
  const pinned = pinnedBlob(located.root, entry.oid);
  if (!pinned) {
    return {
      label: 'PINNED BLOB UNREADABLE',
      why: `git could not read blob ${entry.oid.slice(0, 12)} for ${relative} at ${short}${through}`,
    };
  }
  let onDisk: Uint8Array;
  try {
    onDisk = new Uint8Array(fs.readFileSync(file));
  } catch {
    return { label: 'WORKTREE SOURCE MISSING', why: `${relative} could not be read` };
  }
  if (!bytesEqual(onDisk, pinned)) {
    return {
      label: 'WORKTREE BYTES NOT IN PINNED REVISION',
      why:
        `${relative} on disk (${onDisk.length} byte(s)) differs from blob ${entry.oid.slice(0, 12)} at ${short}` +
        `${through} (${pinned.length} byte(s)) — whatever the artifact hashes, it is not what ${short} contains`,
    };
  }
  return { bytes: pinned };
}

/** A `metadata.sources[path].keccak256` this run can actually compare against on-disk bytes. */
const SOLC_SOURCE_HASH = /^0x[0-9a-f]{64}$/i;

/** What `verifyArtifactSources` established, per source entry, for one artifact. */
type SourceVerification = {
  /** in-repo entries that were on disk and hash-compared (matched + mismatched) */
  sourceCount: number;
  /** in-repo entries whose on-disk bytes hash to exactly the keccak256 the artifact records */
  verified: string[];
  mismatched: string[];
  /** named by the artifact, in-repo, but not on disk */
  unresolved: string[];
  /** the artifact records no usable keccak256 for these, so they can never be compared */
  unverifiable: string[];
  /** resolves outside the repo root — real bytes exist somewhere, but not in the repo we attribute to */
  external: string[];
  /**
   * On disk and in-repo by path, but this run could NOT prove its bytes belong to the pinned
   * revision: a symlink, a path that leaves the tree through `realpath`, a tree entry that is not a
   * regular blob, or working-tree bytes that differ from the pinned blob (CC-50 round-9 MEDIUM).
   */
  unattributed: { file: string; label: string; why: string }[];
  dirty: string[];
  /** the source declaring THIS contract, per the artifact's own compilationTarget/sourceName */
  mainSource: string | null;
  /** null once `mainSource` is in `verified`; otherwise why the contract's own source was not verified */
  mainSourceProblem: string | null;
  /** how `mainSourceProblem` is reported: the artifact never claimed the contract, or the chain broke */
  mainSourceGapLabel: string;
};

/**
 * The source file that declares THIS contract, taken from the artifact's own metadata.
 *
 * solc writes `settings.compilationTarget = { "<path>": "<ContractName>" }` — its own answer to
 * "which file declares this contract". For a MUST-VERIFY contract that declaration is the ONLY
 * accepted answer (`declaredOnly`): it must be an object with EXACTLY ONE entry, and that entry's
 * value must be this contract's name. Not "at least one entry that claims it" — an artifact that
 * declares extra compilation targets is not the single-contract artifact this gate attributes, and
 * picking the matching entry out of several is the same guess in a smaller disguise
 * ([from:docs] round-7 boundary correction). Measured against all 915 sibling artifacts on disk:
 * every one has exactly one entry, so this rejects nothing solc actually emits.
 *
 * Round-6 kept three guesses behind it — a single-key target naming a DIFFERENT contract,
 * `sourceName`, and an unambiguous `<Name>.sol` basename — and an independent reviewer measured
 * all of them exiting 0 under `--strict` with the unconditional PASS while ZERO bytes of the
 * contract's own source were hashed (CC-50 round-7 MEDIUM-1). An artifact that declares a
 * compilation target and does not claim this contract has said it is not the artifact for it;
 * guessing past that is the bypass, not a convenience. Missing / malformed / unclaimed / claimed
 * more than once all fail closed here.
 *
 * The guesses survive for contracts OUTSIDE `MUST_VERIFY` (non-foundry artifact shapes still get a
 * best-effort main source in the report), where they cannot reach the release gate: only
 * must-verify contracts are fed to `provenanceGaps`.
 *
 * This function settles WHETHER the artifact declares exactly one target and whether that target
 * claims this contract. WHICH file it may name is not its business: that is compared against the
 * reviewed pin in `verifyArtifactSources` (CC-50 round-8, `pinnedSourceFor`).
 */
function mainSourceOf(
  artifact: any,
  metadata: any,
  name: string,
  sources: Record<string, any>,
  declaredOnly: boolean,
): { source: string | null; declarationProblem: string | null; declarationLabel: string } {
  const target = metadata?.settings?.compilationTarget;
  const isTargetObject = Boolean(target) && typeof target === 'object' && !Array.isArray(target);
  const entries = isTargetObject ? Object.entries<any>(target) : [];
  if (entries.length === 1 && entries[0][1] === name) {
    return { source: entries[0][0], declarationProblem: null, declarationLabel: '' };
  }

  if (declaredOnly) {
    const render = (): string => entries.map(([rel, contract]) => `${rel} => ${String(contract)}`).join(', ');
    if (entries.length > 1) {
      // Extra targets are a hard failure even when one of them claims this contract: choosing the
      // matching entry out of several is a guess, and a multi-target artifact is not the
      // single-contract artifact this attribution is about.
      const claims = entries.filter(([, contract]) => contract === name).length;
      return {
        source: null,
        declarationProblem:
          `metadata.settings.compilationTarget declares ${entries.length} targets (${render()}) — ` +
          `${claims} of them claim ${name}; a must-verify artifact must declare EXACTLY ONE compilation ` +
          `target and it must be ${name}`,
        declarationLabel: 'MAIN SOURCE AMBIGUOUS',
      };
    }
    const why = !isTargetObject
      ? target === undefined || target === null
        ? 'the artifact declares no metadata.settings.compilationTarget'
        : `metadata.settings.compilationTarget is ${Array.isArray(target) ? 'an array' : typeof target}, ` +
          'not the { "<path>": "<ContractName>" } object solc writes'
      : !entries.length
        ? 'metadata.settings.compilationTarget is empty'
        : `metadata.settings.compilationTarget declares 1 target (${render()}) and it is NOT ${name}`;
    return {
      source: null,
      // No sourceName / basename fallback: a must-verify artifact that will not name its own
      // compilation target is a gap, and guessing one hides it behind a green tick.
      declarationProblem: `${why} — a must-verify artifact must declare exactly one compilation target for ${name}`,
      declarationLabel: 'MAIN SOURCE UNDECLARED',
    };
  }

  const fallback = (): string | null => {
    if (isTargetObject && Object.keys(target).length === 1) return Object.keys(target)[0];
    if (typeof artifact?.sourceName === 'string' && artifact.sourceName) return artifact.sourceName;
    const byBasename = Object.keys(sources).filter((rel) => path.basename(rel) === `${name}.sol`);
    return byBasename.length === 1 ? byBasename[0] : null;
  };
  return { source: fallback(), declarationProblem: null, declarationLabel: '' };
}

/**
 * Verify a foundry artifact against the sources it records.
 *
 * `metadata.sources[path].keccak256` is solc's own hash of each input file, so recomputing it over
 * the working tree proves the artifact was compiled from EXACTLY these bytes. Nothing here trusts
 * an mtime.
 *
 * COUNTING IS NOT COVERAGE (CC-50 round-6 MEDIUM). The previous shape incremented one counter per
 * in-repo entry and only compared the ones that happened to carry a `keccak256` string, so an entry
 * of `{ "urls": [...] }` or `{ "keccak256": null }` — and any source resolving outside the repo —
 * silently became "1 source(s) ✅" while ZERO bytes of that file were ever hashed. Every entry now
 * lands in exactly one bucket, and only `verified` means "compared and matched".
 */
function verifyArtifactSources(
  artifactPath: string,
  repoRoot: string,
  dirtyPaths: string[],
  name: string,
  /** must-verify contracts get NO main-source guessing — see `mainSourceOf` */
  declaredOnly: boolean,
  /** the upstream repo label this artifact is attributed to, matched against the pinned `repo` */
  repoLabel: string | null,
  /**
   * The revision `scripts/upstream-abi-pin.json` pins this repo to. Every must-verify source must
   * be proved to be a regular blob in THIS revision whose bytes equal the working-tree file
   * (CC-50 round-9). Null when the repo declares no pin — itself a gap.
   */
  pinnedRevision: string | null,
): SourceVerification {
  // `git status --porcelain` lines are "XY <path>" (and "R  old -> new"); we only need the paths.
  const dirtySet = new Set(
    dirtyPaths.map((line) => line.replace(/^\S+\s+/, '').split(' -> ').pop()!.replace(/^"|"$/g, '')),
  );
  const empty = (over: Partial<SourceVerification>): SourceVerification => ({
    sourceCount: 0,
    verified: [],
    mismatched: [],
    unresolved: [],
    unverifiable: [],
    external: [],
    unattributed: [],
    dirty: [],
    mainSource: null,
    mainSourceProblem: null,
    mainSourceGapLabel: 'MAIN SOURCE NOT VERIFIED',
    ...over,
  });
  let artifact: any;
  try {
    artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  } catch {
    return empty({
      unresolved: ['<artifact is not readable JSON>'],
      mainSourceProblem: 'the artifact is not readable JSON, so it names no source for this contract',
    });
  }
  const metadata = artifact?.metadata;
  const sources = metadata?.sources;
  if (!sources || typeof sources !== 'object') {
    return empty({
      unresolved: ['<artifact carries no solc metadata.sources>'],
      mainSourceProblem: 'the artifact carries no solc metadata.sources, so it records no source for this contract',
    });
  }

  const dirty: string[] = [];
  const verified: string[] = [];
  const mismatched: string[] = [];
  const unresolved: string[] = [];
  const unverifiable: string[] = [];
  const external: string[] = [];
  const unattributed: { file: string; label: string; why: string }[] = [];
  for (const [relative, entry] of Object.entries<any>(sources)) {
    // No usable hash => nothing to compare against, wherever the file lives. This must be decided
    // BEFORE the in-repo test: an entry with no `keccak256` used to be counted and then skipped.
    const declared = typeof entry?.keccak256 === 'string' ? entry.keccak256.trim() : '';
    if (!SOLC_SOURCE_HASH.test(declared)) {
      unverifiable.push(relative);
      continue;
    }
    const file = path.resolve(repoRoot, relative);
    // Sources outside the repo (remappings into node_modules/lib) belong to a different tree, so
    // this repo's revision cannot attest to them. Recorded, never counted as verification.
    if (!file.startsWith(repoRoot + path.sep)) {
      external.push(relative);
      continue;
    }
    if (!fs.existsSync(file)) {
      unresolved.push(relative);
      continue;
    }
    if (dirtySet.has(relative)) dirty.push(relative);
    // CC-50 round-9. For a must-verify artifact the bytes that get hashed must be bytes this run
    // PROVED the pinned revision contains — see `attributeToPinnedRevision`. Everything else keeps
    // reading the working tree: those contracts do not gate the release and paying four `git`
    // invocations per source across the whole ABI inventory buys nothing they are allowed to claim.
    let bytes: Uint8Array;
    if (declaredOnly) {
      const attributed = attributeToPinnedRevision(repoRoot, relative, pinnedRevision);
      if ('label' in attributed) {
        // A path that is simply absent stays in the pre-existing bucket: "not on disk" and "on disk
        // but not attributable" are different findings and must not be collapsed.
        if (attributed.label === 'WORKTREE SOURCE MISSING') unresolved.push(relative);
        else unattributed.push({ file: relative, label: attributed.label, why: attributed.why });
        continue;
      }
      bytes = attributed.bytes;
    } else {
      bytes = new Uint8Array(fs.readFileSync(file));
    }
    const actual = keccak256(bytes);
    if (actual.toLowerCase() !== declared.toLowerCase()) mismatched.push(relative);
    else verified.push(relative);
  }

  // Coverage, not counting: the artifact must prove ITS OWN contract source was verified. A green
  // built purely out of unrelated in-repo sources (a vendored/remapped `<Name>.sol` next to a
  // correctly-hashed sibling) is exactly the "1 source(s) ✅ on a file never compared" bypass.
  const declared = mainSourceOf(artifact, metadata, name, sources, declaredOnly);
  const mainSource = declared.source;
  let mainSourceProblem: string | null = null;
  let mainSourceGapLabel = 'MAIN SOURCE NOT VERIFIED';
  const verifiedSet = new Set(verified);
  // The reviewed answer comes first: with no usable pin there is nothing to compare the artifact's
  // declaration against, and a well-formed artifact must not paper over a gate that lost its
  // reviewed input (CC-50 round-8).
  const pinned = declaredOnly ? pinnedSourceFor(name) : null;
  if (pinned?.problem) {
    mainSourceProblem = pinned.problem;
    mainSourceGapLabel = pinned.label;
  } else if (declared.declarationProblem) {
    // The artifact never claimed this contract. Reported as its own gap kind so a reader can tell
    // "the chain broke" from "the artifact refuses to say which file this contract came from".
    mainSourceProblem = declared.declarationProblem;
    mainSourceGapLabel = declared.declarationLabel;
  } else if (!mainSource) {
    mainSourceProblem =
      `the artifact does not name its own contract source (no metadata.settings.compilationTarget ` +
      `entry for ${name}, no sourceName, no unambiguous ${name}.sol)`;
  } else if (pinned?.pin && mainSource !== pinned.pin.sourcePath) {
    // RIGHT NAME, WRONG PATH (CC-50 round-8 MEDIUM). The declaration is well-formed — exactly one
    // target, and its value IS this contract — so every round-7 check is satisfied while the file
    // it points at is not the reviewed source of this contract. That artifact's green says nothing
    // about the contract being released, however perfectly the file it names hashes.
    mainSourceProblem =
      `the artifact declares ${mainSource} => ${name}, but scripts/upstream-abi-pin.json pins ${name} to ` +
      `${pinned.pin.sourcePath} (${pinned.pin.repo}) — a must-verify artifact's ONE compilation target must ` +
      `be BYTE-EXACT the reviewed path; the right contract name on a different file is not evidence about ` +
      `${name}. If the contract really moved, review the move and update the pin in the same commit`;
    mainSourceGapLabel = 'MAIN SOURCE PATH NOT PINNED';
  } else if (pinned?.pin && repoLabel !== pinned.pin.repo) {
    // The path only means something inside the repo it was reviewed in: `contracts/src/core/
    // Registry.sol` exists, or could be made to exist, in more than one checkout.
    mainSourceProblem =
      `${mainSource} is pinned to the ${pinned.pin.repo} checkout, but this artifact is attributed to ` +
      `${repoLabel ?? 'no repo'} — a pinned source path is evidence only inside its own pinned repo`;
    mainSourceGapLabel = 'MAIN SOURCE REPO MISMATCH';
  } else if (!verifiedSet.has(mainSource)) {
    const why = mismatched.includes(mainSource)
      ? 'its on-disk bytes do NOT hash to the keccak256 the artifact records'
      : unresolved.includes(mainSource)
        ? 'it is not on disk in this checkout'
        : unverifiable.includes(mainSource)
          ? 'the artifact records no usable keccak256 for it'
          : external.includes(mainSource)
            ? 'it resolves OUTSIDE the repo this artifact is attributed to'
            : unattributed.find((e) => e.file === mainSource)
              ? `its bytes were NOT attributed to the pinned revision (${
                  unattributed.find((e) => e.file === mainSource)!.label
                })`
              : 'the artifact does not record it under metadata.sources at all';
    mainSourceProblem = `${mainSource} — ${why}`;
  }

  return {
    sourceCount: verified.length + mismatched.length,
    verified,
    mismatched,
    unresolved,
    unverifiable,
    external,
    unattributed,
    dirty,
    mainSource,
    mainSourceProblem,
    mainSourceGapLabel,
  };
}

/**
 * ABIs that MUST be verified against a real upstream artifact in strict mode.
 *
 * These are the contracts the RepCredit evidence run encodes calldata against and whose upstream
 * interface is actively changing, so "we did not check it" must never read as "it matches".
 * A name here fails strict mode when it is skipped for ANY reason — repo absent, `out/` cleaned,
 * artifact missing, name collision — instead of quietly dropping into the skipped bucket
 * (CC-50, [from:docs] second round).
 */
const MUST_VERIFY = new Map<string, string>([
  ['Registry', 'RepCredit credit-policy / credit-limit surface (SP)'],
  ['BLSAggregator', 'slash + reputation quorum surface (SP)'],
  ['DVTValidator', 'executeWithProof path used by the evidence runner (SP)'],
  ['SuperPaymaster', 'paymaster surface exercised by the gasless lifecycle (SP)'],
]);

/**
 * STRICT MODE (`--strict`, `STRICT_ABI_DRIFT=1`, or the legacy `REQUIRE_UPSTREAM=1`).
 *
 * Without it this gate had exactly one hard-failure mode for missing inputs: NO upstream `out/`
 * directory at all. Everything finer-grained — an `out/` that exists but was `forge clean`ed, a
 * single contract whose artifact was never built — fell into `skipped` and the script still
 * printed PASS. That is how a run went from "checked 30" to "checked 12" while staying green
 * (CC-50). Strict mode fails PER EXPECTED CONTRACT instead:
 *
 *   - an SDK ABI whose contract is declared in an upstream `src/` tree but has no artifact  → FAIL
 *   - anything in MUST_VERIFY that was not actually compared                                → FAIL
 *
 * Both lists (checked / skipped-with-reason) are printed either way, so a green run states what
 * it verified rather than leaving the reader to assume.
 */
const STRICT =
  process.argv.includes('--strict') ||
  process.env.STRICT_ABI_DRIFT === '1' ||
  process.env.REQUIRE_UPSTREAM === '1';

/**
 * `REPCREDIT_UPSTREAM_ARTIFACTS=absent` and `--strict` are MUTUALLY EXCLUSIVE (CC-50 round-10 LOW).
 *
 * That variable is how an environment DECLARES it has no sibling upstream checkouts, so that the
 * REAL must-verify pin test in `scripts/repcredit/abi-drift-provenance.test.ts` becomes a visible
 * SKIP instead of a failure. Strict mode asserts the exact opposite: that every must-verify ABI was
 * compared against a real artifact from a clean, pinned upstream checkout.
 *
 * An independent reviewer measured that setting it could not actually produce a false green here —
 * strict already fails on the missing `out/` dirs — but that made the exclusion a property of the
 * current control flow, enforced for release only by a line of prose in docs/RELEASE-CHECKLIST.md.
 * Making the combination an immediate, named failure turns it into an impossible state instead of a
 * reminder, and keeps holding if the code below is ever reorganised.
 */
if (STRICT && process.env.REPCREDIT_UPSTREAM_ARTIFACTS === 'absent') {
  console.error('FAIL: --strict was requested with REPCREDIT_UPSTREAM_ARTIFACTS=absent.');
  console.error('      Those two assert opposite things: the variable DECLARES that this environment');
  console.error('      has no sibling upstream checkouts, while strict mode requires every must-verify');
  console.error('      ABI to be compared against an artifact from a clean, pinned one.');
  console.error('      A release run (docs/RELEASE-CHECKLIST.md) must not set it. Drop the variable, or');
  console.error('      drop --strict and accept that this run verifies nothing against upstream.');
  process.exit(1);
}

/** contract name -> upstream repo label, from the upstream SOURCE trees. */
function upstreamSourceIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const { label, dir } of SRC_DIRS) {
    const walk = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          if (/(^|\/)(test|mock|mocks|node_modules)$/i.test(p) || /test/i.test(e.name)) continue;
          walk(p);
          continue;
        }
        if (!e.name.endsWith('.sol')) continue;
        const text = fs.readFileSync(p, 'utf8');
        for (const m of text.matchAll(/^\s*contract\s+([A-Za-z0-9_]+)/gm)) {
          if (!index.has(m[1])) index.set(m[1], label);
        }
      }
    };
    walk(dir);
  }
  return index;
}

if (OUT_DIRS.length === 0) {
  if (STRICT) {
    console.error('FAIL: strict mode is on but no upstream out/ dir is present — nothing to check against.');
    console.error('      Check out the upstream repos as siblings and `forge build` them, or drop --strict.');
    process.exit(1);
  }
  console.log('⚠️  no upstream out/ dirs found locally — skipping ABI value-drift check.');
  console.log('    NOTE: this is a SKIP, not a verification. Run with --strict to make it fail instead.');
  process.exit(0);
}

const SOURCE_INDEX = upstreamSourceIndex();

type Skipped = { name: string; reason: string; expected: boolean };

let drift = 0;
const checkedNames: string[] = [];
/**
 * What each verified contract was actually compared against (CC-50 round-3 LOW): the upstream
 * artifact path plus the sha256 of its normalised ABI. "checked 30" only means something if the
 * run can say WHICH artifacts those were — a PASS that cannot name its inputs is the same class of
 * claim as the vacuous PASS strict mode exists to prevent.
 */
const checkedProvenance: {
  name: string;
  artifact: string;
  abiSha256: string;
  /** Upstream git revision + working-tree state the artifact is attributed to. */
  repo: RepoProvenance | null;
  /** solc-metadata source verification: does the artifact match the sources on disk? */
  sources: SourceVerification;
}[] = [];
const skippedEntries: Skipped[] = [];
/** How many individual source paths a per-contract list prints before collapsing into a count. */
const SOURCE_LIST_CAP = 5;
/** Drift measured against an artifact whose sources are uncommitted upstream — reported, not failed (lenient). */
const unattributableDrift: { name: string; problems: string[]; dirtySources: string[] }[] = [];
/** Never drift-checked BY DESIGN (standard/external, or not a contract) — listed so the inventory adds up. */
const excludedEntries: { name: string; reason: string }[] = [];
console.log('=== Upstream ABI value-drift (vs ' + OUT_DIRS.length + ' upstream out/ dir(s)) ===');
console.log(`mode: ${STRICT ? 'STRICT (missing expected artifacts fail)' : 'lenient (missing artifacts are skipped)'}\n`);

for (const file of fs.readdirSync(ABIS_DIR).filter((f) => f.endsWith('.json'))) {
  const name = file.replace(/\.json$/, '');
  if (NON_CONTRACT.has(name)) {
    excludedEntries.push({ name, reason: 'not a single-contract artifact' });
    continue;
  }
  if (STANDARD_EXTERNAL.has(name)) {
    excludedEntries.push({ name, reason: 'standard/external contract — SDK ABI comes from the official source, not our upstreams' });
    continue;
  }
  if (NAME_COLLISIONS.has(name)) {
    console.log(`ℹ️  ${name}: skipped — name collides with an unrelated upstream contract; SDK tracks a different source (see CC-27).`);
    skippedEntries.push({ name, reason: 'name collision with an unrelated upstream contract (CC-27)', expected: false });
    continue;
  }
  if (KNOWN_DRIFT.has(name)) {
    console.log(`ℹ️  ${name}: known intentional drift — ${KNOWN_DRIFT.get(name)}`);
    skippedEntries.push({ name, reason: `documented intentional drift: ${KNOWN_DRIFT.get(name)}`, expected: false });
    continue;
  }
  // CC-115 B4: a contract whose SDK ABI must track the DEPLOYED artifact rather than upstream
  // `out/`. This is a REDIRECT, not a skip — the contract stays in `checked`, is still diffed, and
  // still needs a matching abiSha256 pin. Skipping it instead (via KNOWN_DRIFT) would have removed
  // the SDK's single most consequential ABI from the gate entirely, which is the failure mode this
  // repo already documented: an exemption that reads like coverage.
  const redirected = redirectTargetFor(name);
  const up = redirected ? path.join(SDK_ROOT, redirected) : findUpstreamArtifact(name);
  if (redirected && (up === null || !fs.existsSync(up))) {
    skippedEntries.push({ name, reason: `deployed-ABI redirect target missing: ${redirected}`, expected: true });
    continue;
  }
  if (!up) {
    const repo = SOURCE_INDEX.get(name);
    skippedEntries.push({
      name,
      reason: repo
        ? profiledAmbiguity.has(name)
          ? `NO UNAMBIGUOUS ARTIFACT: ${repo}/out has ${profiledAmbiguity.get(name)!.join(', ')} but no ` +
            `${name}.json. Several build profiles wrote this contract and they may not agree; ` +
            'rebuild with the default profile, or pick one deliberately — do NOT let readdir order decide.'
          : `NO ARTIFACT, but ${repo}/src declares this contract — the upstream needs \`forge build\` ` +
            '(if out/ DOES contain <C>.<profile>.json, the build ran under a named profile; that shape is ' +
            'now recognised, so this message means the artifact is genuinely absent)'
        : 'no upstream artifact and no upstream source declares it (external/standard contract)',
      // Expected == the upstream repo IS checked out and declares the contract, so an artifact
      // should exist. That is the state a clean/failed build produces, and the one that used to
      // pass vacuously.
      expected: Boolean(repo),
    });
    continue;
  }
  checkedNames.push(name);
  const sdk = loadAbi(path.join(ABIS_DIR, file));
  const ups = loadAbi(up);
  // A redirected artifact lives in THIS repo and carries no solc metadata, so the compile-time
  // custody chain (artifact -> metadata.sources -> pinned upstream blobs) does not apply to it. It
  // has a different, equally checkable chain: the file must be byte-identical to a blob at a pinned
  // upstream revision. Running the solc-metadata verifier over it would report five "gaps" that are
  // properties of the artifact KIND, not evidence of drift — and a permanent ⚠️ teaches readers to
  // ignore the column. So attribute it the right way instead of excusing it.
  const repo = redirected ? null : repoProvenanceFor(up);
  if (redirected) {
    const blobOk = verifyRedirectedBlob(name, up);
    if (!blobOk.ok) redirectFailures.push(`${name}: ${blobOk.detail}`);
    console.log(`ℹ️  ${name}: ABI redirected to the DEPLOYED artifact — ${blobOk.detail}`);
  }
  const provenance = {
    name,
    artifact: up,
    // Hash the ABI itself, not the artifact file: bytecode/metadata churn on every rebuild and
    // would make the digest useless for answering "did the interface change?".
    abiSha256: createHash('sha256').update(JSON.stringify(ups)).digest('hex'),
    repo,
    sources: repo
      ? verifyArtifactSources(
          up,
          repo.root,
          repo.dirtyPaths,
          name,
          MUST_VERIFY.has(name),
          repo.label,
          PIN.repos?.[repo.label]?.revision ?? null,
        )
      : {
          sourceCount: 0,
          verified: [],
          mismatched: [],
          unresolved: ['<no git repo>'],
          unverifiable: [],
          external: [],
          unattributed: [],
          dirty: [],
          mainSource: null,
          mainSourceProblem: 'the artifact resolves to no git checkout, so no source could be attributed',
          mainSourceGapLabel: 'MAIN SOURCE NOT VERIFIED',
        },
  };
  checkedProvenance.push(provenance);
  const problems: string[] = [];
  for (const kind of ['function', 'event', 'error']) {
    const a = sigSet(sdk, kind);
    const b = sigSet(ups, kind);
    const missingInSdk = [...b].filter((s) => !a.has(s)); // upstream has it, SDK's copy doesn't (stale)
    const goneUpstream = [...a].filter((s) => !b.has(s)); // SDK has it, upstream removed/renamed it
    if (missingInSdk.length) problems.push(`${kind} added upstream, missing in SDK: ${missingInSdk.join(', ')}`);
    if (goneUpstream.length) problems.push(`${kind} in SDK but gone upstream: ${goneUpstream.join(', ')}`);
  }
  if (problems.length) {
    // A diff against an artifact built from UNCOMMITTED upstream sources is not evidence that the
    // SDK's copy is stale — it is the same "cannot attribute this artifact" problem one layer up,
    // and the sibling repo's owner is mid-round more often than not. Report it, do not fail the
    // lenient run on it; strict mode still fails, both here and on the dirty-checkout gate below.
    const unattributable = provenance.sources.dirty;
    if (unattributable.length) {
      unattributableDrift.push({ name, problems, dirtySources: unattributable });
      console.log(`⚠️  ${name}: differs from an UNATTRIBUTABLE artifact (built from uncommitted upstream sources)`);
      for (const p of problems) console.log(`   ${p}`);
      console.log(`   uncommitted: ${unattributable.join(', ')}`);
    } else {
      drift++;
      console.log(`❌ ${name}`);
      for (const p of problems) console.log(`   ${p}`);
    }
  }
}

// ---- Inventory. Printed on every run, pass or fail: a bare "PASS" cannot tell you WHAT was
// verified, and that ambiguity is precisely what made a 12-contract run look like a 30-contract one.
const checkedSet = new Set(checkedNames);

// ---- Upstream revisions FIRST: a reader must be able to answer "green against what?" before
// reading a single sha256. Same discipline as the YAAA pin in the RepCredit suite.
const usedRepos = [...new Map(
  checkedProvenance.filter((e) => e.repo).map((e) => [e.repo!.root, e.repo!]),
).values()].sort((a, b) => a.label.localeCompare(b.label));
console.log(`\n--- upstream revisions (${usedRepos.length}) ---`);
if (!usedRepos.length) console.log('  (none — no artifact resolved to a git checkout)');
for (const repo of usedRepos) {
  const declared = PIN.repos?.[repo.label]?.revision;
  const state = repo.dirtyPaths.length ? `DIRTY: ${repo.dirtyPaths.length} change(s)` : 'clean';
  console.log(
    `  ${repo.label} @ ${repo.revision ?? 'unknown'} (${state})` +
      `${declared ? `  pinned=${declared.slice(0, 12)}` : '  [NO PIN DECLARED]'}`,
  );
  if (repo.unusable) console.log(`     ⚠️  ${repo.unusable}`);
}

console.log(`\n--- checked (${checkedNames.length}) — contract, abi sha256, artifact⇄source, upstream artifact ---`);
if (!checkedProvenance.length) console.log('(none)');
for (const entry of [...checkedProvenance].sort((a, b) => a.name.localeCompare(b.name))) {
  const src = entry.sources;
  // Say what was COMPARED, never how many entries were seen: `N source(s)` used to include
  // entries that carried no comparable hash at all (CC-50 round-6 MEDIUM).
  const uncovered =
    src.unresolved.length + src.unverifiable.length + src.external.length + src.unattributed.length;
  // A green tick on the same row whose next line reads "MAIN SOURCE UNDECLARED" is a report at war
  // with itself — the same shape round-7 MEDIUM-2 removed from the PASS sentence (CC-50 round-8
  // LOW-2). Strict already exits 1 on these, but the row must not read as verified either.
  const parts = [`${src.verified.length} source(s) verified`];
  if (uncovered) parts.push(`${uncovered} not covered`);
  if (src.mainSourceProblem) parts.push('main source NOT attributed');
  const binding = src.mismatched.length
    ? `❌ ${src.mismatched.length}/${src.sourceCount} source(s) DIFFER from the artifact`
    : uncovered || src.mainSourceProblem
      ? `⚠️  ${parts.join(', ')}`
      : `✅ ${parts.join(', ')}`;
  console.log(`  ${entry.name}  ${entry.abiSha256.slice(0, 16)}  ${binding}  ${entry.artifact}`);
  for (const file of src.mismatched) console.log(`       ✗ ${file}`);
  for (const file of src.unresolved) console.log(`       ? ${file} (named by the artifact, not on disk)`);
  for (const file of src.unverifiable) console.log(`       ? ${file} (no usable keccak256 in the artifact)`);
  for (const file of src.external) console.log(`       ? ${file} (resolves outside this repo)`);
  for (const entry of src.unattributed.slice(0, SOURCE_LIST_CAP)) {
    console.log(`       ? ${entry.file} (${entry.label})`);
  }
  if (src.unattributed.length > SOURCE_LIST_CAP) {
    console.log(`       ? … and ${src.unattributed.length - SOURCE_LIST_CAP} further unattributed source(s)`);
  }
  if (src.mainSourceProblem) console.log(`       ⚠️  ${src.mainSourceGapLabel}: ${src.mainSourceProblem}`);
}
console.log(`--- skipped (${skippedEntries.length}) ---`);
for (const entry of skippedEntries.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${entry.expected ? '⚠️ ' : '  '}${entry.name}: ${entry.reason}`);
}

console.log(`--- excluded by design (${excludedEntries.length}) ---`);
console.log(excludedEntries.length ? excludedEntries.map((e) => e.name).sort().join(', ') : '(none)');

const expectedMissing = skippedEntries.filter((e) => e.expected);
const mustVerifyMissing = [...MUST_VERIFY.entries()].filter(([name]) => !checkedSet.has(name));

/**
 * Every must-verify contract's provenance gaps, computed BEFORE the `--- must-verify ---` section
 * so that section can report them (CC-50 round-9 LOW-1). It used to tick a contract green for
 * having been COMPARED while the `MUST-VERIFY PROVENANCE INCOMPLETE` block a few lines below listed
 * that same contract — a reader got a green tick and its own contradiction on one screen. Same
 * shape round-8 LOW-2 removed from the `checked` table; this section was simply missed.
 */
const mustVerifyGapsByName = new Map(
  checkedProvenance
    .filter((e) => MUST_VERIFY.has(e.name))
    .map((e) => [e.name, provenanceGaps(e)] as const),
);

console.log('\n--- must-verify ---');
for (const [name, why] of MUST_VERIFY) {
  const gaps = mustVerifyGapsByName.get(name);
  if (!checkedSet.has(name)) {
    console.log(`  ❌ ${name} — NOT COMPARED — ${why}`);
  } else if (gaps?.length) {
    console.log(`  ⚠️  ${name} — compared, provenance INCOMPLETE (${gaps.length} gap(s), listed below) — ${why}`);
  } else {
    console.log(`  ✅ ${name} — ${why}`);
  }
}

console.log(
  `\nchecked ${checkedNames.length} ABI(s) against upstream out/; skipped ${skippedEntries.length} ` +
    `(${expectedMissing.length} of them EXPECTED an artifact); excluded by design ${excludedEntries.length}.`,
);

let failed = false;
if (drift > 0) {
  console.error(
    `\nDRIFT: ${drift} contract ABI(s) differ from upstream. Re-build the upstream (forge build) and ` +
      `re-copy its <C>.sol/<C>.json into packages/core/src/abis/.`,
  );
  failed = true;
}
// ---- Provenance gates. All of these are the SAME failure in different clothing: an ABI the run
// cannot attribute to a reviewed, committed upstream revision. Gated on strict/release because a
// developer mid-edit in a sibling repo must still be able to run the lenient check; the release
// checklist and CI use --strict.
const artifactSourceMismatch = checkedProvenance.filter((e) => e.sources.mismatched.length);
if (artifactSourceMismatch.length) {
  const message =
    `ARTIFACT ⇄ SOURCE MISMATCH: ${artifactSourceMismatch.length} artifact(s) were NOT built from the ` +
    `sources now on disk (solc metadata keccak256 disagrees) — the artifact is stale or the sources moved:`;
  if (STRICT) console.error(`\n${message}`);
  else console.log(`\n⚠️  ${message}`);
  for (const entry of artifactSourceMismatch) {
    const line = `  - ${entry.name}: ${entry.sources.mismatched.join(', ')}`;
    if (STRICT) console.error(line);
    else console.log(line);
  }
  if (STRICT) {
    console.error('  Re-run `forge build` in the upstream checkout so the artifact matches its source.');
    failed = true;
  }
}

const unpinnedOrDirty = usedRepos.filter((repo) => repo.unusable);
if (unpinnedOrDirty.length) {
  const message =
    `UPSTREAM NOT PINNED/CLEAN: ${unpinnedOrDirty.length} upstream checkout(s) cannot back a release-grade ABI claim:`;
  if (STRICT) console.error(`\n${message}`);
  else console.log(`\n⚠️  ${message}`);
  for (const repo of unpinnedOrDirty) {
    const line = `  - ${repo.label} @ ${repo.revision ?? 'unknown'}: ${repo.unusable}`;
    if (STRICT) console.error(line);
    else console.log(line);
  }
  if (STRICT) {
    console.error('  Commit (or stash) the upstream changes and update scripts/upstream-abi-pin.json to the reviewed revision.');
    failed = true;
  }
}

if (unattributableDrift.length) {
  const message =
    `UNATTRIBUTABLE DRIFT: ${unattributableDrift.length} contract(s) differ from an upstream artifact ` +
    `built from UNCOMMITTED sources — the diff describes someone's work in progress, not the SDK:`;
  if (STRICT) console.error(`\n${message}`);
  else console.log(`\n⚠️  ${message}`);
  for (const entry of unattributableDrift) {
    const line = `  - ${entry.name} (uncommitted: ${entry.dirtySources.join(', ')})`;
    if (STRICT) console.error(line);
    else console.log(line);
  }
  if (STRICT) failed = true;
  else console.log('    Not failing the lenient run. `--strict` (release) requires a clean upstream checkout.');
}

// Self-consistency of the SDK's OWN committed copy against its OWN committed pin. Deliberately
// NOT gated on strict: it needs no upstream checkout at all, and "the vendored ABI is still the
// one that was reviewed" must hold on every run, including one where the sibling repos are absent.
/** Did every pinned contract's vendored ABI match its pinned sha256? Required by the final PASS. */
let vendoredPinHolds = true;
{
  const pinnedContracts = Object.entries(PIN.contracts ?? {});
  const contractPinMismatch = pinnedContracts.flatMap(([name, expected]) => {
    const file = path.join(ABIS_DIR, `${name}.json`);
    if (!fs.existsSync(file)) return [`${name}: pinned, but packages/core/src/abis/${name}.json is missing`];
    const actual = createHash('sha256').update(JSON.stringify(loadAbi(file))).digest('hex');
    return actual === expected.abiSha256
      ? []
      : [`${name}: vendored ABI sha256 ${actual.slice(0, 16)} != pinned ${expected.abiSha256.slice(0, 16)}`];
  });
  if (contractPinMismatch.length) {
    vendoredPinHolds = false;
    console.error(`\nVENDORED ABI PIN MISMATCH: ${contractPinMismatch.length} contract(s):`);
    for (const line of contractPinMismatch) console.error(`  - ${line}`);
    console.error('  Update scripts/upstream-abi-pin.json in the same commit that re-syncs the ABI.');
    failed = true;
  } else if (pinnedContracts.length) {
    console.log(`\n✅ vendored ABI pin: ${pinnedContracts.length} contract(s) match scripts/upstream-abi-pin.json.`);
  }
}

// ---------------------------------------------------------------------------------------------
// MUST-VERIFY PROVENANCE, END TO END (CC-50 round-5 MEDIUM-1)
//
// The gates above each catch ONE broken link. Two ways of having NO link at all still exited 0
// under --strict, and both printed the unqualified PASS:
//
//   1. an artifact carrying no `metadata.sources` (or sources that do not resolve on disk):
//      `verifyArtifactSources` reported them as `unresolved`, which was PRINTED and never set
//      `failed`, so strict mode passed having hashed ZERO source bytes;
//   2. an `out/` that belongs to no git checkout at all — a tarball, a `git archive`, a CI
//      artifact download. `repoProvenanceFor` returns null for those, and the NO UPSTREAM PIN
//      filter dropped exactly those entries (`e.repo && …`), so strict mode passed and printed
//      "--- upstream revisions (0) ---" with all four must-verify contracts ticked.
//
// Both are the same class as the vacuous PASS this gate exists to remove: dirty and stale were
// already red, and MISSING — no provenance whatsoever — was the one state left green. So a
// must-verify contract must now satisfy the WHOLE chain, and every missing link is named:
//
//   repo  ->  declared pin  ->  clean revision matching that pin  ->  artifact
//         ->  a non-empty, fully resolved set of source hashes that the artifact matches
//         ->  the artifact's OWN contract source among them
//         ->  the vendored ABI sha256 this repo committed
//
// Anything less and strict/release fails, and the final PASS line is not allowed to claim the
// artifacts hash-match their sources.
//
// ROUND-6 (CC-50): the source-hash link was a COUNT, not COVERAGE. `sourceCount` was incremented
// for every in-repo entry and the comparison was then made conditional, so two shapes reached
// `--strict` exit 0 with the unqualified PASS while ZERO bytes of the must-verify contract were
// hashed: (a) an entry carrying no comparable `keccak256` (`{ "urls": [...] }`, `null`) counted as
// one verified source; (b) the contract's own source resolving OUTSIDE the repo — silently skipped
// as "the dependency's problem" — while an unrelated in-repo source supplied the count. So every
// entry now lands in exactly one bucket (verified / mismatched / unresolved / unverifiable /
// external) and only `verified` counts, and a must-verify artifact must additionally prove that
// the source solc names as ITS OWN (metadata.settings.compilationTarget, sourceName) is in that
// verified set. Verifying *a* source and verifying *this contract* are different claims.
//
// ROUND-8 (CC-50): round-7 forced the declaration's VALUE (the contract name) and never looked at
// its KEY. `{ "contracts/src/Unrelated.sol": "Registry" }` — exactly one entry, value correct, that
// file in-repo and hashing perfectly — exited 0 under `--strict` with the unconditional PASS while
// `contracts/src/Registry.sol` was not hashed and did not appear in the output at all. A rename or
// move leaves precisely that artifact behind. So the KEY is now compared byte-exact against a path
// this repo reviewed and committed (`contracts[<name>].sourcePath`, in `contracts[<name>].repo`),
// and a missing or malformed pin fails just as hard — see `pinnedSourceFor`. The chain's last link
// is a reviewed constant, not something the artifact gets to choose.
// ---------------------------------------------------------------------------------------------
function provenanceGaps(entry: (typeof checkedProvenance)[number]): string[] {
  const gaps: string[] = [];
  // A redirected artifact is attributed by BLOB IDENTITY at a pinned upstream revision, not by
  // solc metadata — it has none to carry. Its chain is checked in verifyRedirectedBlob() and any
  // break lands in `redirectFailures`, which fails the run on its own. Reporting the five
  // metadata-shaped "gaps" here as well would make a permanently-⚠️ column that readers learn to
  // skip, which is how a real gap gets missed later.
  if (redirectTargetFor(entry.name)) {
    return redirectFailures.filter((f) => f.startsWith(`${entry.name}:`));
  }
  const repo = entry.repo;
  if (!repo) {
    gaps.push(
      'NO UPSTREAM PROVENANCE: the artifact resolves to no git checkout (tarball / git archive / ' +
        'downloaded CI artifact), so it cannot be attributed to any revision',
    );
  } else {
    if (!repo.revision) gaps.push(`NO UPSTREAM REVISION: ${repo.label} is not a usable git checkout`);
    if (repo.unusable) gaps.push(`UNUSABLE CHECKOUT: ${repo.unusable}`);
    if (!PIN.repos?.[repo.label]?.revision) {
      gaps.push(`NO UPSTREAM PIN: ${repo.label} declares no revision in scripts/upstream-abi-pin.json`);
    }
  }
  const src = entry.sources;
  if (src.unresolved.length) {
    gaps.push(`SOURCE HASHES INCOMPLETE: ${src.unresolved.length} named but not on disk — ${src.unresolved.join(', ')}`);
  }
  // Counting an entry the run could never compare is how a green was printed over zero verified
  // bytes: `{ "urls": [...] }` and `{ "keccak256": null }` both incremented the old counter and
  // then skipped the comparison (CC-50 round-6 MEDIUM (a)).
  if (src.unverifiable.length) {
    gaps.push(
      `SOURCE HASHES INCOMPLETE: ${src.unverifiable.length} entry/entries carry no usable keccak256 ` +
        `(missing, null, or not a 32-byte hex hash), so they can never be compared — ${src.unverifiable.join(', ')}`,
    );
  }
  // A source outside the repo is not "the dependency's problem" for a MUST-VERIFY contract: this
  // repo's pinned revision cannot attest to bytes it does not contain.
  if (src.external.length) {
    gaps.push(
      `SOURCE HASHES INCOMPLETE: ${src.external.length} source(s) resolve OUTSIDE the repo this ` +
        `artifact is attributed to, so its revision cannot attest to them — ${src.external.join(', ')}`,
    );
  }
  if (!src.verified.length) {
    gaps.push(
      'NO SOURCE HASHES: the artifact records no in-repo source this run could hash and match, so ' +
        '"the artifact matches the sources it records" was never established',
    );
  }
  // COVERAGE, not count (CC-50 round-6 MEDIUM (b)): verifying some unrelated in-repo source says
  // nothing about THIS contract. Its own declared source must be in the verified set.
  if (src.mainSourceProblem) {
    gaps.push(`${src.mainSourceGapLabel}: ${src.mainSourceProblem}`);
  }
  // CC-50 round-9 MEDIUM. "In a directory under the repo root" was a string prefix; it never
  // established that the pinned REVISION contains these bytes. A committed symlink to a file
  // outside the repo satisfied every earlier link in the chain — solc hashed the target, the gate
  // re-hashed the target, and the revision named in the green sentence held only the link.
  if (src.unattributed.length) {
    for (const entry of src.unattributed.slice(0, SOURCE_LIST_CAP)) {
      gaps.push(`SOURCE NOT ATTRIBUTED TO PINNED REVISION: ${entry.label} — ${entry.why}`);
    }
    if (src.unattributed.length > SOURCE_LIST_CAP) {
      gaps.push(
        `SOURCE NOT ATTRIBUTED TO PINNED REVISION: … and ${src.unattributed.length - SOURCE_LIST_CAP} ` +
          `further source(s) — ${src.unattributed.slice(SOURCE_LIST_CAP).map((e) => e.file).join(', ')}`,
      );
    }
  }
  if (src.mismatched.length) gaps.push(`ARTIFACT ⇄ SOURCE MISMATCH: ${src.mismatched.join(', ')}`);
  if (!PIN.contracts?.[entry.name]?.abiSha256) {
    gaps.push(`NO VENDORED ABI PIN: scripts/upstream-abi-pin.json declares no abiSha256 for ${entry.name}`);
  }
  return gaps;
}

/**
 * Checked contracts OUTSIDE the must-verify set whose artifact⇄source binding is NOT established.
 *
 * These do not gate the release — `provenanceGaps` is only applied to `MUST_VERIFY` — but the final
 * PASS used to claim "every artifact hash-matches the sources it records" in the same run whose own
 * `checked` table printed `⚠️  0 source(s) verified, 1 not covered` a few lines above (CC-50 round-7
 * MEDIUM-2). A green that contradicts its own report is worse than a narrower green: the sentence is
 * now scoped to the must-verify set and every remaining artifact with a gap is named as an explicit
 * out-of-release-scope caveat.
 */
const nonMustSourceCaveats = checkedProvenance
  .filter((entry) => !MUST_VERIFY.has(entry.name))
  .filter((entry) => {
    const src = entry.sources;
    const uncovered =
      src.unresolved.length + src.unverifiable.length + src.external.length + src.unattributed.length;
    return Boolean(uncovered || src.mismatched.length || src.mainSourceProblem);
  })
  .map((entry) => entry.name)
  .sort();

const mustVerifyGaps = [...mustVerifyGapsByName]
  .map(([name, gaps]) => ({ name, gaps }))
  .filter((e) => e.gaps.length > 0);

if (mustVerifyGaps.length) {
  const message =
    `MUST-VERIFY PROVENANCE INCOMPLETE: ${mustVerifyGaps.length} contract(s) cannot be attributed end to ` +
    `end (repo -> committed pinned revision -> artifact -> every source hash -> vendored ABI):`;
  const emit = STRICT ? console.error : console.log;
  emit(STRICT ? `\n${message}` : `\n⚠️  ${message}`);
  for (const entry of mustVerifyGaps) {
    emit(`  - ${entry.name}`);
    for (const gap of entry.gaps) emit(`      ${gap}`);
  }
  if (STRICT) {
    console.error(
      '  A must-verify ABI that was not attributed is a FAILURE, not a caveat. Build the artifact from a ' +
        'clean, committed upstream checkout that scripts/upstream-abi-pin.json names.',
    );
    failed = true;
  } else {
    console.log('    Not failing the lenient run. `--strict` (release) requires the full chain.');
  }
}

/**
 * May the final PASS claim the artifacts were verified against their sources?
 *
 * Only when EVERY must-verify contract has the entire chain intact. Anything else and the run
 * says what it actually established.
 */
const mustVerifyFullyAttributed =
  mustVerifyGaps.length === 0 && mustVerifyMissing.length === 0 && vendoredPinHolds;

if (STRICT && expectedMissing.length) {
  console.error(`\nMISSING ARTIFACTS: ${expectedMissing.length} contract(s) are declared in an upstream src/ tree but have no out/ artifact:`);
  for (const entry of expectedMissing) console.error(`  - ${entry.name}: ${entry.reason}`);
  console.error('  Run `forge build` in the upstream checkout. In strict mode an unverified ABI is a failure, not a skip.');
  failed = true;
}
// Deliberately NOT gated on strict mode. There is no acceptable state in which these four went
// unverified, and `check:abi-drift` (without the suffix) is the command people actually type and
// the one the CI rationale note names — leaving it green with all four unverified reproduced the
// exact false signal strict mode was added to remove.
if (mustVerifyMissing.length) {
  console.error(`\nMUST-VERIFY NOT VERIFIED: ${mustVerifyMissing.length} contract(s) that must always be compared were not:`);
  for (const [name, why] of mustVerifyMissing) console.error(`  - ${name} (${why})`);
  failed = true;
}
// Like the must-verify block above, deliberately not gated on --strict: a redirected ABI whose
// custody chain is broken is an ABI nobody has attributed to anything.
if (redirectFailures.length) {
  console.error(`\nDEPLOYED-ABI REDIRECT BROKEN: ${redirectFailures.length} contract(s):`);
  for (const line of redirectFailures) console.error(`  - ${line}`);
  console.error('  The vendored copy must be byte-identical to the blob at the pinned upstream revision.');
  failed = true;
}
if (failed) process.exit(1);

/**
 * Name every checked artifact OUTSIDE the enforced set whose binding was not established.
 *
 * Printed by EVERY path that ends in a PASS (CC-50 round-8 LOW-3): the caveat used to hang off the
 * two branches under `else`, so the `expectedMissing` lenient PASS — a run that already knows it
 * verified less than it looks — was the one green that stayed silent about it.
 */
function printNonMustCaveat(): void {
  if (!nonMustSourceCaveats.length) return;
  console.log(
    `      NOT RELEASE-SCOPE CAVEAT: ${nonMustSourceCaveats.length} further checked artifact(s) are outside the ` +
      'must-verify set and their artifact⇄source binding is NOT established — they were compared by ABI only: ' +
      `${nonMustSourceCaveats.join(', ')}.`,
  );
}

if (expectedMissing.length) {
  // Reachable in lenient mode only — strict already failed on it above.
  console.log(
    `\n⚠️  PASS, but ${expectedMissing.length} expected artifact(s) were missing and therefore NOT verified ` +
      `(see the skipped list). Re-run with --strict to make that a failure.`,
  );
  if (!mustVerifyFullyAttributed) {
    console.log(
      `      ...and ${mustVerifyGaps.length} must-verify contract(s) have INCOMPLETE PROVENANCE, so nothing ` +
        'here establishes that their artifacts match the sources they record.',
    );
  }
  printNonMustCaveat();
  console.log('      LENIENT MODE: none of the above is enforced. `--strict` (the release gate) fails on all of it.');
} else {
  const pinned = usedRepos
    .filter((repo) => PIN.repos?.[repo.label]?.revision)
    .map((repo) => `${repo.label}@${repo.revision!.slice(0, 8)}`)
    .join(', ');
  // Say exactly what held. A blanket "everything matches" after downgrading a diff to a warning is
  // the same overstatement as a PASS that will not name its `checked N`.
  const caveats: string[] = [];
  if (unattributableDrift.length) {
    caveats.push(`${unattributableDrift.length} contract(s) differed from an UNATTRIBUTABLE artifact (see above)`);
  }
  if (artifactSourceMismatch.length) {
    caveats.push(`${artifactSourceMismatch.length} artifact(s) did not hash-match their sources`);
  }
  // The claim "every artifact hash-matches the sources it records" is only true when the source
  // hashes were actually computed. With no provenance at all (no metadata.sources, unresolved
  // sources, or an out/ outside any git checkout) that sentence asserts a verification this run
  // never performed — the same overstatement in a different place.
  if (mustVerifyGaps.length) {
    caveats.push(
      `${mustVerifyGaps.length} must-verify contract(s) have INCOMPLETE PROVENANCE, so their artifact⇄source ` +
        'binding is not established (see above)',
    );
  } else if (!mustVerifyFullyAttributed) {
    caveats.push('must-verify provenance was not fully established (see above)');
  }
  console.log(
    caveats.length
      ? `\nPASS (with caveats): ${checkedNames.length - unattributableDrift.length}/${checkedNames.length} ` +
        `checked SDK ABI(s) match an upstream artifact; ${caveats.join('; ')}.`
      : '\nPASS: every checked SDK ABI matches its upstream out/ artifact, every expected artifact was present, ' +
        `and all ${MUST_VERIFY.size} must-verify artifacts hash-match every source they record.`,
  );
  // Never let the green sentence contradict the `checked` table above it: source coverage is only
  // ENFORCED for the must-verify set, so every other artifact with a gap is named right here rather
  // than folded into a blanket "every artifact" (CC-50 round-7 MEDIUM-2).
  printNonMustCaveat();
  // The attribution sentence is a claim about BYTES, so it may only appear when every must-verify
  // source was proved to be a regular blob in the pinned revision (CC-50 round-9 MEDIUM). Strict
  // already exits 1 before reaching here on any gap; this makes that a property of the sentence
  // rather than of the control flow above it.
  console.log(
    STRICT && mustVerifyFullyAttributed
      ? `      Attributed to committed upstream revision(s): ${pinned || '(none pinned)'}.`
      : STRICT
        ? '      NOT attributed: the must-verify provenance chain did not hold (see above).'
        : `      Upstream revision(s) seen: ${
          usedRepos.map((r) => `${r.label}@${(r.revision ?? 'unknown').slice(0, 8)}${r.dirtyPaths.length ? '(DIRTY)' : ''}`).join(', ') || '(none)'
        }.`,
  );
  // LENIENT SEMANTICS, stated rather than implied (CC-50 round-4 LOW-3): this mode reports the
  // provenance gates instead of enforcing them, so its exit code says "no drift I can attribute",
  // never "release-grade". `--strict` is the only mode whose green means the full chain held.
  if (!STRICT) {
    console.log(
      caveats.length
        ? '      LENIENT MODE: the caveats above are NOT enforced here. `--strict` (the release gate) fails on them.'
        : '      LENIENT MODE: no caveat was raised, but only `--strict` enforces the pin/clean-checkout chain.',
    );
  }
}
