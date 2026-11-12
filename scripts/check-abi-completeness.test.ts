/**
 * check-abi-completeness: a source dir that exists but is empty, or does not contain the contracts
 * an upstream must have, has not been inspected — the gate must FAIL there, not print 100%.
 * Before the sentinel check it printed "concrete contracts: 0 | in SDK: 0 (100%)" and PASS
 * (DSR review of #420, L1).
 *
 * The script resolves upstreams as ../<repo> from its working directory and reads the SDK ABIs
 * from <cwd>/packages/core/src/abis, so each case builds a throwaway sibling layout and runs the
 * real script from inside it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/check-abi-completeness.ts');
// Same launcher choice as kms-endpoint-audit.test.ts (FU-48): the local tsx binary, npx fallback.
const TSX_BIN = join(process.cwd(), 'node_modules', '.bin', 'tsx');
const [LAUNCHER, LAUNCH_ARGS] = existsSync(TSX_BIN) ? [TSX_BIN, []] : ['npx', ['tsx']];

const SP_SENTINELS = ['SuperPaymaster', 'Registry', 'GTokenStaking'];
const AA_SENTINELS = ['AAStarAirAccountV7', 'AAStarAirAccountFactoryV7'];

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** Build <root>/sdk + sibling upstreams; `null` contracts = the src dir exists but is empty. */
function layout(spContracts: string[] | null, aaContracts: string[] = AA_SENTINELS): string {
  const root = mkdtempSync(join(tmpdir(), 'abi-completeness-'));
  roots.push(root);
  const abis = join(root, 'sdk/packages/core/src/abis');
  mkdirSync(abis, { recursive: true });
  for (const c of [...SP_SENTINELS, ...AA_SENTINELS]) writeFileSync(join(abis, `${c}.json`), '[]');
  const src = (dir: string, contracts: string[] | null) => {
    mkdirSync(join(root, dir), { recursive: true });
    if (contracts) writeFileSync(join(root, dir, 'All.sol'), contracts.map((c) => `contract ${c} {}`).join('\n') + '\n');
  };
  src('SuperPaymaster/contracts/src', spContracts);
  src('airaccount-contract/src', aaContracts);
  return join(root, 'sdk');
}

function run(cwd: string): { code: number; out: string } {
  try {
    const out = execFileSync(LAUNCHER, [...LAUNCH_ARGS, SCRIPT], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

// Each case spawns tsx. execFileSync blocks the event loop vitest's timer runs on (measured on
// vitest 4.0.17), so this bounds the verdict, not a hung child. 30s is the spawn-verdict budget
// the other spawn suites use: the only CI/local ratio on record is 7.4x, which put a cold tsx
// start at 93% of the 5s default.
const SPAWN_VERDICT_TIMEOUT_MS = 30_000;

describe('check-abi-completeness sentinels', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
  it('positive control: every sentinel present and shipped → exit 0', () => {
    const r = run(layout(SP_SENTINELS));
    expect(r.out).toMatch(/PASS/);
    expect(r.code).toBe(0);
  });

  it('an EMPTY upstream source dir → exit 1 (was: 0 contracts, 100%, PASS)', () => {
    const r = run(layout(null));
    expect(r.out).toMatch(/SuperPaymaster .*scanned 0 concrete contract/);
    expect(r.out).not.toMatch(/^PASS/m);
    expect(r.code).toBe(1);
  });

  it('a source dir MISSING a sentinel contract → exit 1, naming it', () => {
    const r = run(layout(['Registry', 'GTokenStaking']));
    expect(r.out).toMatch(/required sentinel\(s\) not found: SuperPaymaster\b/);
    expect(r.code).toBe(1);
  });
});
