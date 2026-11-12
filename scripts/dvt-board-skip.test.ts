/**
 * FU-83: a machine without the board must SKIP, not throw.
 * dvt-kms-onboard-e2e.ts already prints `⏭️  SKIP` and returns (exit 0).
 * dvt3-register.ts used to throw `missing required env SDK_DIR` (exit 1).
 *
 * No summarizer under tests/regression or scripts counts runner exit codes, so both
 * stay on exit 0. A reader that only checks `exit == 0` cannot tell SKIP from PASS;
 * it has to parse the SKIP line. Exit 78 is non-zero, so that reader would count it
 * as a failure.
 *
 * The child env is an allowlist. These tests do not read the repo .env* and do not open an RPC.
 * dvt3 skips before its own dotenv; the present-env path dies on a missing RPC_URL
 * before any client is constructed. The KMS runner loads `.env.sepolia` from its cwd,
 * so those cases use a temp directory and the pnpm-installed tsx binary. `pnpm exec`
 * would reset cwd to this repo and open the real env file.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
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

/**
 * KMS dotenv path is `cwd/.env.sepolia`. Keep cwd off the repo.
 * `--tsconfig` is required: tsx only applies `@aastar/*` paths from a config it
 * can see, and from a temp cwd it would not walk up to this repo.
 */
function runKms(env: NodeJS.ProcessEnv, cwd: string) {
  return spawnSync(join(ROOT, 'node_modules', '.bin', 'tsx'), [
    '--tsconfig', join(ROOT, 'tsconfig.json'),
    join(ROOT, KMS),
  ], {
    cwd,
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

describe('board-side onchain-evidence runners', { timeout: 120_000 }, () => {
  it('dvt3-register SKIPs with exit 0 when board-side env is absent', () => {
    const child = runRunner(DVT3, bareEnv());
    const out = `${child.stdout ?? ''}${child.stderr ?? ''}`;
    expect(child.status, out.slice(0, 400)).toBe(0);
    expect(out).toContain('⏭️  SKIP dvt3-register:');
    expect(out).toContain('SDK_DIR');
    expect(out).not.toContain('missing required env');
    expect(out).not.toContain('DVT3-REGISTER FAIL');
  }, 120_000);

  it('dvt3-register loads DVT3_* from SDK_DIR/.env.sepolia before the remaining SKIP gate', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dvt3-dotenv-'));
    // Fixture only. Not a repo env file, and not a real key.
    writeFileSync(join(dir, '.env.sepolia'), [
      `DVT3_KEYSTORE_JSON=${join(dir, 'missing-keystore.json')}`,
      'DVT3_SECRET=fixture-not-a-password',
      'DVT3_OPERATOR_PK=0x11',
      '',
    ].join('\n'));
    const child = runRunner(DVT3, bareEnv({ SDK_DIR: dir }));
    const out = `${child.stdout ?? ''}${child.stderr ?? ''}`;
    expect(child.status, out.slice(0, 500)).toBe(1);
    expect(out).toContain('missing required env RPC_URL');
    expect(out).not.toContain('⏭️  SKIP');
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

  it('dvt-kms-onboard-e2e SKIPs with exit 0 when KMS_POP_URL is absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kms-skip-'));
    const child = runKms(bareEnv(), dir);
    const out = `${child.stdout ?? ''}${child.stderr ?? ''}`;
    expect(child.status, out.slice(0, 500)).toBe(0);
    expect(out).toContain('⏭️  SKIP dvt-kms-onboard-e2e:');
    expect(out).toContain('KMS_POP_URL');
  }, 120_000);

  it('dvt-kms-onboard-e2e loads KMS_POP_URL from cwd .env.sepolia before the SKIP gate', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kms-dotenv-'));
    // Fixture only. Not the repo env file, and not a board endpoint that is contacted:
    // the script throws on the missing node id before it builds a client.
    writeFileSync(join(dir, '.env.sepolia'), 'KMS_POP_URL=http://127.0.0.1:9\n');
    const child = runKms(bareEnv(), dir);
    const out = `${child.stdout ?? ''}${child.stderr ?? ''}`;
    expect(child.status, out.slice(0, 500)).toBe(1);
    expect(out).toContain('set KMS_NODE_ID');
    expect(out).not.toContain('⏭️  SKIP');
  }, 120_000);
});
