#!/usr/bin/env tsx
/**
 * Generate / verify the RepCredit experiment ABI fixtures (CC-50 B1).
 *
 * WHY THIS EXISTS
 * ---------------
 * The first cut of the RepCredit orchestrator hand-wrote a 3-entry subset of
 * MockAgentIdentityRegistry and dropped it into `packages/core/src/abis/`. That did two bad
 * things at once: it published an experiment mock on the `@aastar/core` public surface, and it
 * turned `check:abi-drift` red because a hand-written subset can never equal the upstream
 * artifact. The answer to "should these be generated rather than hand-vendored?" is yes — this
 * script is that generator.
 *
 * These fixtures are EXPERIMENT-SCOPED. They stay under `scripts/` so they are outside every
 * published package, and they are pinned by content hash so an upstream mock change cannot drift
 * in silently the way a hand-written subset did.
 *
 * Usage:
 *   pnpm run repcredit:abi:sync    # regenerate fixtures + provenance from the sibling out/ dirs
 *   pnpm run repcredit:abi:check   # verify fixtures match their recorded hash, and — when the
 *                                  # upstream checkout is present — still match the artifact
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ABIS_DIR = join(HERE, 'abis');
const SOURCES_FILE = join(ABIS_DIR, 'sources.json');
const PROVENANCE_FILE = join(ABIS_DIR, 'provenance.json');
const SDK_ROOT = resolve(HERE, '../..');

type FixtureSource = {
  name: string;
  repo: string;
  repoDir: string;
  sourcePath: string;
  artifactPath: string;
  note: string;
};

export type FixtureProvenance = {
  name: string;
  repo: string;
  sourcePath: string;
  artifactPath: string;
  /** Commit of the upstream checkout the fixture was generated from. */
  generatedFromCommit: string;
  /** Whether `generatedFromCommit` is an ancestor of that repo's origin/main. */
  upstreamMerged: boolean;
  entryCount: number;
  /** sha256 over the canonical JSON of the `abi` array — the pin that makes drift loud. */
  abiSha256: string;
  note: string;
};

/** Canonical serialization used for hashing: exactly what we write to disk. */
export function serializeAbi(abi: unknown[]): string {
  return `${JSON.stringify({ abi }, null, 2)}\n`;
}

export function hashAbi(abi: unknown[]): string {
  return createHash('sha256').update(serializeAbi(abi)).digest('hex');
}

function readSources(): FixtureSource[] {
  return (JSON.parse(readFileSync(SOURCES_FILE, 'utf8')) as { fixtures: FixtureSource[] }).fixtures;
}

function readProvenance(): FixtureProvenance[] {
  return (JSON.parse(readFileSync(PROVENANCE_FILE, 'utf8')) as { fixtures: FixtureProvenance[] }).fixtures;
}

function fixtureFile(name: string): string {
  return join(ABIS_DIR, `${name}.json`);
}

function loadFixtureAbi(name: string): unknown[] {
  const raw = JSON.parse(readFileSync(fixtureFile(name), 'utf8'));
  return Array.isArray(raw) ? raw : raw.abi;
}

function loadUpstreamAbi(source: FixtureSource): unknown[] | null {
  const artifact = resolve(SDK_ROOT, source.repoDir, source.artifactPath);
  if (!existsSync(artifact)) return null;
  const raw = JSON.parse(readFileSync(artifact, 'utf8'));
  return Array.isArray(raw) ? raw : raw.abi;
}

function git(cwd: string, args: string[]): string | null {
  // Minimal env on purpose: this must not inherit REPCREDIT_PRIVATE_KEY or an API-keyed RPC URL.
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
  });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

/** name(intype,...) for every named entry — the selector-determining signature set. */
export function signatureSet(abi: any[]): Set<string> {
  const render = (i: any): string => {
    if (typeof i?.type === 'string' && i.type.startsWith('tuple') && Array.isArray(i.components)) {
      return `(${i.components.map(render).join(',')})${i.type.slice('tuple'.length)}`;
    }
    return i?.type ?? '?';
  };
  return new Set(
    abi.filter((e) => e?.name).map((e) => `${e.type} ${e.name}(${(e.inputs || []).map(render).join(',')})`),
  );
}

function syncOne(source: FixtureSource): FixtureProvenance {
  const abi = loadUpstreamAbi(source);
  if (!abi) {
    throw new Error(
      `${source.name}: upstream artifact missing at ${source.repoDir}/${source.artifactPath} — ` +
        `check out ${source.repo} as a sibling and run \`forge build\` before \`repcredit:abi:sync\`.`,
    );
  }
  const repoRoot = resolve(SDK_ROOT, source.repoDir);
  const commit = git(repoRoot, ['rev-parse', 'HEAD']) ?? 'unknown';
  const sourceCommit = git(repoRoot, ['log', '-1', '--format=%H', '--', source.sourcePath]) || commit;
  const merged = git(repoRoot, ['merge-base', '--is-ancestor', sourceCommit, 'origin/main']) !== null;

  writeFileSync(fixtureFile(source.name), serializeAbi(abi));
  return {
    name: source.name,
    repo: source.repo,
    sourcePath: source.sourcePath,
    artifactPath: source.artifactPath,
    generatedFromCommit: sourceCommit,
    upstreamMerged: merged,
    entryCount: abi.length,
    abiSha256: hashAbi(abi),
    note: source.note,
  };
}

/**
 * Verify every fixture. Two independent checks, because they fail differently:
 *  1. fixture content vs its recorded sha256 — catches an edited/truncated fixture even with no
 *     upstream checkout (this is the hand-written-subset failure mode, and it is always enforced);
 *  2. fixture vs the upstream artifact, when that checkout exists — catches a silent upstream
 *     mock change (this is the one the previous vendoring had no defence against).
 * Returns the list of problems; empty means clean.
 */
export function verifyFixtures(): string[] {
  const sources = readSources();
  const provenance = readProvenance();
  const problems: string[] = [];

  for (const source of sources) {
    const pin = provenance.find((p) => p.name === source.name);
    if (!pin) {
      problems.push(`${source.name}: no provenance entry — run \`pnpm run repcredit:abi:sync\`.`);
      continue;
    }
    if (!existsSync(fixtureFile(source.name))) {
      problems.push(`${source.name}: fixture file missing — run \`pnpm run repcredit:abi:sync\`.`);
      continue;
    }
    const abi = loadFixtureAbi(source.name);
    const actual = hashAbi(abi);
    if (actual !== pin.abiSha256) {
      problems.push(
        `${source.name}: fixture sha256 ${actual} != recorded ${pin.abiSha256} — the fixture was edited by hand.`,
      );
    }
    if (abi.length !== pin.entryCount) {
      problems.push(`${source.name}: ${abi.length} ABI entries, provenance records ${pin.entryCount}.`);
    }

    const upstream = loadUpstreamAbi(source);
    if (!upstream) continue; // upstream not checked out — hash pin above still applies.
    const fixtureSigs = signatureSet(abi as any[]);
    const upstreamSigs = signatureSet(upstream as any[]);
    const missing = [...upstreamSigs].filter((s) => !fixtureSigs.has(s));
    const extra = [...fixtureSigs].filter((s) => !upstreamSigs.has(s));
    if (missing.length || extra.length) {
      problems.push(
        `${source.name}: drifted from ${source.repo}/${source.artifactPath}` +
          (missing.length ? `\n    missing in fixture: ${missing.join(', ')}` : '') +
          (extra.length ? `\n    not in upstream:    ${extra.join(', ')}` : ''),
      );
    }
  }
  return problems;
}

function main(): void {
  const check = process.argv.includes('--check');
  if (check) {
    const problems = verifyFixtures();
    console.log('=== RepCredit experiment ABI fixtures (scripts/repcredit/abis) ===');
    for (const pin of readProvenance()) {
      const flag = pin.upstreamMerged ? 'merged upstream' : 'UNMERGED experiment branch';
      console.log(`  ${pin.name}: ${pin.entryCount} entries, ${pin.abiSha256.slice(0, 16)}… (${flag})`);
    }
    if (problems.length) {
      console.error('\nFAIL: experiment ABI fixture provenance broken:');
      for (const p of problems) console.error(`  ❌ ${p}`);
      process.exit(1);
    }
    console.log('\nPASS: every fixture matches its recorded hash (and its upstream artifact where checked out).');
    console.log('NOTE: these are experiment-only mocks. They are NOT part of the @aastar/core public ABI surface.');
    return;
  }

  const fixtures = readSources().map(syncOne);
  writeFileSync(
    PROVENANCE_FILE,
    `${JSON.stringify(
      {
        $comment:
          'GENERATED by scripts/repcredit/sync-fixture-abis.ts — do not hand-edit. ' +
          'upstreamMerged=false means the fixture was generated from an unmerged upstream branch and ' +
          'must NOT be presented as an official interface.',
        fixtures,
      },
      null,
      2,
    )}\n`,
  );
  for (const f of fixtures) {
    console.log(`synced ${f.name}: ${f.entryCount} entries from ${f.repo}@${f.generatedFromCommit.slice(0, 8)}` +
      `${f.upstreamMerged ? '' : ' (UNMERGED branch)'}`);
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
