/**
 * FU-83: a machine without the board must SKIP, not throw.
 * dvt-kms-onboard-e2e.ts already prints `⏭️  SKIP` and returns (exit 0).
 * dvt3-register.ts used to throw `missing required env SDK_DIR` (exit 1).
 *
 * No summarizer under tests/regression or scripts counts runner exit codes, so both
 * stay on exit 0. A future tally has to read the SKIP line; exit 0 alone is PASS.
 *
 * The child env is an allowlist. These tests do not read .env* and do not open an RPC:
 * the skip path exits before dotenv, and the present-env path dies on a missing RPC_URL
 * before any client is constructed.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DVT3 = 'tests/regression/onchain-evidence/dvt3-register.ts';
const KMS = 'tests/regression/onchain-evidence/dvt-kms-onboard-e2e.ts';

function runRunner(script: string, env: NodeJS.ProcessEnv) {
  return spawnSync('pnpm', ['exec', 'tsx', script], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: 90_000,
  });
}

/** PATH/HOME only, plus whatever the caller sets. Never inherit RPC URLs or key material. */
function bareEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    ...extra,
  };
}

describe('board-side onchain-evidence runners', () => {
  it('dvt3-register SKIPs with exit 0 when board-side env is absent', () => {
    const child = runRunner(DVT3, bareEnv());
    const out = `${child.stdout ?? ''}${child.stderr ?? ''}`;
    expect(child.status, out.slice(0, 400)).toBe(0);
    expect(out).toContain('⏭️  SKIP dvt3-register:');
    expect(out).toContain('SDK_DIR');
    expect(out).not.toContain('missing required env');
    expect(out).not.toContain('DVT3-REGISTER FAIL');
  }, 120_000);

  it('dvt3-register still exits 1 when board-side env is present but RPC_URL is not', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dvt3-skip-'));
    const child = runRunner(DVT3, bareEnv({
      SDK_DIR: dir,
      DVT3_KEYSTORE_JSON: join(dir, 'missing-keystore.json'),
      DVT3_SECRET: 'not-a-real-passphrase',
      DVT3_OPERATOR_PK: '0x11',
    }));
    const out = `${child.stdout ?? ''}${child.stderr ?? ''}`;
    expect(child.status, out.slice(0, 500)).toBe(1);
    expect(out).toContain('missing required env RPC_URL');
    expect(out).not.toContain('⏭️  SKIP');
  }, 120_000);

  it('dvt-kms-onboard-e2e keeps the same SKIP exit 0 (source, no .env read)', () => {
    const src = readFileSync(new URL(`../${KMS}`, import.meta.url), 'utf8');
    expect(src).toContain('⏭️  SKIP dvt-kms-onboard-e2e:');
    expect(src).toMatch(/if \(!KMS_POP_URL\) \{[\s\S]*?\n\s*return;\n\s*\}/);
    expect(src).not.toContain('process.exit(78)');
    const dvt3 = readFileSync(new URL(`../${DVT3}`, import.meta.url), 'utf8');
    expect(dvt3).toContain('process.exit(0)');
    expect(dvt3).not.toContain('process.exit(78)');
  });
});
