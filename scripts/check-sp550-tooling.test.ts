import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gitBlobId, offlineProblems, upstreamProblems, VENDORED_DIR, type Git } from './check-sp550-tooling.js';
import { SP550_TOOLING_FILES, SP550_TOOLING_PIN } from '../packages/core/src/sp550Tooling.js';

const SPAWN_VERDICT_TIMEOUT_MS = 60_000;
const DIR = path.resolve('packages/core/src/sp550-tooling');

/** A temp copy of the vendored directory, altered by `edit`. */
const withCopy = (edit: (d: string) => void) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sp550-tooling-'));
    for (const f of fs.readdirSync(DIR)) fs.copyFileSync(path.join(DIR, f), path.join(d, f));
    edit(d);
    try { return offlineProblems(d).problems; } finally { fs.rmSync(d, { recursive: true, force: true }); }
};

describe('check:sp550-tooling offline: the vendored bytes are the pinned blobs', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('the vendored directory passes, and it is the one core imports from', () => {
        expect(VENDORED_DIR).toBe(DIR);
        expect(offlineProblems(DIR).problems).toEqual([]);
    });
    it('the structural check is wired in: its problems are the CLI\'s problems (Codex B1 r1 L1)', () => {
        expect(offlineProblems(DIR, () => ['structural X']).problems).toEqual(['structural X']);
    });
    it('a symlink to identical bytes, a directory where a file should be, or a symlinked directory fails (Codex B1 r1 M1)', () => {
        const outside = path.join(os.tmpdir(), `sp550-real-${process.pid}-${Date.now()}.json`);
        try {
            expect(withCopy((d) => { const f = path.join(d, 'readback-providers.json'); fs.renameSync(f, outside); fs.symlinkSync(outside, f); })).toEqual(expect.arrayContaining([expect.stringMatching(/readback-providers\.json is not a regular file/)]));
        } finally { fs.rmSync(outside, { force: true }); }
        expect(withCopy((d) => { const f = path.join(d, 'external-deps.10.json'); fs.rmSync(f); fs.mkdirSync(f); })).toEqual(expect.arrayContaining([expect.stringMatching(/external-deps\.10\.json is not a regular file/)]));
        const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sp550-tooling-link-'));
        try { const l = path.join(d, 'link'); fs.symlinkSync(DIR, l); expect(offlineProblems(l).problems).toEqual([expect.stringMatching(/is not a real directory/)]); } finally { fs.rmSync(d, { recursive: true, force: true }); }
    });
    it('gitBlobId is git hash-object', () => {
        expect(gitBlobId(Buffer.from('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
    });
    it.each<[string, (d: string) => void, RegExp]>([
        ['one byte changed in the policy', (d) => { const f = path.join(d, 'readback-policy.json'); const b = fs.readFileSync(f); b[b.length - 2] ^= 1; fs.writeFileSync(f, b); }, /readback-policy\.json: blob .* is not the pinned/],
        ['a trailing newline added to the providers', (d) => fs.appendFileSync(path.join(d, 'readback-providers.json'), '\n'), /readback-providers\.json: blob/],
        ['a file not in the manifest', (d) => fs.writeFileSync(path.join(d, 'extra.json'), '{}'), /extra\.json is in .* but not in SP550_TOOLING_FILES/],
        ['a missing file', (d) => fs.rmSync(path.join(d, 'external-deps.10.json')), /external-deps\.10\.json is missing/],
        ['an edited spec', (d) => fs.appendFileSync(path.join(d, 'deploylive-readback-runtime-pins.md'), 'x'), /the spec's sha256 .* is not the pinned/],
        ['one chain\'s runtime pins differing from the others', (d) => fs.appendFileSync(path.join(d, 'runtime-pins.31337.json'), ' '), /the three runtime-pins files are not byte-identical/],
        ['one chain\'s creation pins differing from the others', (d) => fs.appendFileSync(path.join(d, 'creation-pins.10.json'), ' '), /the three creation-pins files are not byte-identical/],
        ['creation pins that no longer hash to what runtime-pins records', (d) => fs.appendFileSync(path.join(d, 'creation-pins.10.json'), ' '), /runtime-pins\.10 records creationPinsSha256 .* but creation-pins\.10\.json hashes to/],
    ])('%s fails', (_l, edit, why) => {
        expect(withCopy(edit)).toEqual(expect.arrayContaining([expect.stringMatching(why)]));
    });
});

describe('check:sp550-tooling upstream: two pins about the same contracts', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const { contractsTag, contractsCommit, toolingCommit } = SP550_TOOLING_PIN;
    /** A git that answers like the real upstream, with `over` overriding (undefined → the call fails). */
    const fakeGit = (over: Record<string, string | undefined> = {}): Git => (args) => {
        const q = args.join(' ');
        if (q in over) { const v = over[q]; if (v === undefined) throw new Error('fatal'); return v; }
        if (q === `rev-parse ${contractsTag}^{commit}`) return contractsCommit;
        if (q === `rev-parse ${toolingCommit}^{commit}`) return toolingCommit;
        if (q === `rev-parse ${contractsCommit}:contracts/src` || q === `rev-parse ${toolingCommit}:contracts/src`) return 'a'.repeat(40);
        if (q === `rev-parse ${contractsCommit}:foundry.toml` || q === `rev-parse ${toolingCommit}:foundry.toml`) return 'b'.repeat(40);
        for (const v of Object.values(SP550_TOOLING_FILES)) if (q === `rev-parse ${toolingCommit}:${v.upstream}`) return v.gitBlob;
        throw new Error(`unexpected git ${q}`);
    };
    it('an upstream that matches passes', () => {
        expect(upstreamProblems(fakeGit()).problems).toEqual([]);
    });
    it.each<[string, Record<string, string | undefined>, RegExp]>([
        ['a moved tag', { [`rev-parse ${contractsTag}^{commit}`]: 'c'.repeat(40) }, /tag v5\.5\.0-rc\.8 resolves to c+, not/],
        ['a missing tag', { [`rev-parse ${contractsTag}^{commit}`]: undefined }, /resolves to nothing/],
        ['the tooling commit not fetched', { [`rev-parse ${toolingCommit}^{commit}`]: undefined }, /is not in the upstream checkout/],
        ['contracts/src changed between the pins', { [`rev-parse ${toolingCommit}:contracts/src`]: 'd'.repeat(40) }, /contracts\/src differs between the contracts tag/],
        ['foundry.toml changed between the pins', { [`rev-parse ${toolingCommit}:foundry.toml`]: 'e'.repeat(40) }, /foundry\.toml differs/],
        ['an upstream blob that is not the pinned one', { [`rev-parse ${toolingCommit}:deployments/readback-policy.json`]: 'f'.repeat(40) }, /deployments\/readback-policy\.json at the tooling commit is blob f+, not the pinned/],
    ])('%s fails', (_l, over, why) => {
        expect(upstreamProblems(fakeGit(over)).problems).toEqual(expect.arrayContaining([expect.stringMatching(why)]));
    });
});

describe('check:sp550-tooling CLI', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const run = (args: string[], env: Record<string, string> = {}) =>
        spawnSync('pnpm', ['exec', 'tsx', 'scripts/check-sp550-tooling.ts', ...args], { encoding: 'utf8', timeout: SPAWN_VERDICT_TIMEOUT_MS, env: { ...process.env, ...env } });
    it('an SP550_TOOLING_DIR in the environment does not redirect the CLI (Codex B1 r1 M2)', () => {
        const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sp550-tooling-empty-'));
        try { const r = run([], { SP_REPO: '/nonexistent-sp-repo', SP550_TOOLING_DIR: d }); expect(r.status, r.stderr).toBe(0); } finally { fs.rmSync(d, { recursive: true, force: true }); }
    });
    it('passes offline and says it skipped upstream', () => {
        const r = run([], { SP_REPO: '/nonexistent-sp-repo' });
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toMatch(/check:sp550-tooling PASS — offline: \d+ check\(s\); upstream: SKIP/);
    });
    it('--strict without an upstream checkout fails; so does REQUIRE_UPSTREAM=1', () => {
        expect(run(['--strict'], { SP_REPO: '/nonexistent-sp-repo' }).status).toBe(1);
        expect(run([], { SP_REPO: '/nonexistent-sp-repo', REQUIRE_UPSTREAM: '1' }).status).toBe(1);
    });
    it('any argument but a bare --strict is refused (exit 2), never read as "not strict"', () => {
        for (const a of [['--strict=false'], ['--Strict'], ['--strict', '--strict'], ['x']]) expect(run(a, { SP_REPO: '/nonexistent-sp-repo' }).status, a.join(' ')).toBe(2);
    });
});
