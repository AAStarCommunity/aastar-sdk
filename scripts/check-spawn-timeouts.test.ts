/**
 * The spawn-timeout gate, against fixture sources. The repo run at the bottom is the same function
 * the CLI calls, so a detector that matches nothing cannot go green on an empty violation list.
 */
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    checkRepo,
    checkSources,
    listScriptTestFiles,
    verdict,
    type SpawnTimeoutReport,
} from './check-spawn-timeouts.js';

function check(files: Record<string, string>, entry = 't.test.ts'): SpawnTimeoutReport {
    return checkSources(new Map(Object.entries(files)), [entry]);
}

function lineText(src: string, line: number): string {
    return src.split('\n')[line - 1] ?? '';
}

describe('a file that states every timeout explicitly is silent', () => {
    const src = `
import { afterAll, beforeAll, describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';

const SPAWN_VERDICT_TIMEOUT_MS = 30_000;

describe('options', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
  it('spawns', () => { execFileSync('git', ['status']); });
});

describe('numeric third', () => {
  it('spawns', () => { execFileSync('git', ['status']); });
}, 30_000);

describe('no spawn here', () => {
  it('pure', () => {});
});

describe('hook only', () => {
  beforeAll(() => { execFileSync('git', ['status']); }, 10_000);
  afterAll(() => {});
  it('pure', () => {});
});
`;
    it('options object, numeric third argument, and a hook timeout all satisfy the rule', () => {
        const report = check({ 't.test.ts': src });
        expect(report.violations, report.violations.map(v => `${v.line}: ${v.message}`).join('\n')).toEqual([]);
        expect(report.checked).toBe(1);
        expect(verdict(report).ok).toBe(true);
    });
});

describe('a top-level describe that contains a spawning test must carry the timeout', () => {
    const src = `
import { describe, it } from 'vitest';
import { execFileSync } from 'child_process';

describe('outer', () => {
  describe('inner', { timeout: 30_000 }, () => {
    it('spawns', () => { execFileSync('git', ['status']); });
  });
});

describe('stated', { timeout: 30_000 }, () => {
  it('spawns too', () => { execFileSync('git', ['status']); });
});
`;
    it('reports the outer describe and not the one that already states a timeout', () => {
        const report = check({ 't.test.ts': src });
        expect(report.violations).toHaveLength(1);
        const v = report.violations[0]!;
        expect(lineText(src, v.line)).toContain("describe('outer'");
        expect(v.message).toContain('top-level describe');
        expect(verdict(report).ok).toBe(false);
    });

    it('an aliased child_process import and execa are spawn APIs too', () => {
        const aliased = `
import { describe, it } from 'vitest';
import { execFileSync as run } from 'node:child_process';
describe('d', () => { it('t', () => { run('git', ['status']); }); });
`;
        const viaExeca = `
import { describe, it } from 'vitest';
import { execa } from 'execa';
describe('d', () => { it('t', async () => { await execa('echo', ['hi']); }); });
`;
        const viaNamespace = `
import { describe, it } from 'vitest';
import * as cp from 'node:child_process';
describe('d', () => { it('t', () => { cp.fork('child.js'); }); });
`;
        for (const src of [aliased, viaExeca, viaNamespace]) {
            const report = check({ 't.test.ts': src });
            expect(report.violations, src).toHaveLength(1);
            expect(report.violations[0]!.message).toContain('top-level describe');
        }
    });
});

describe('a hook whose body spawns needs its own timeout argument', () => {
    const hooks = ['beforeAll', 'beforeEach', 'afterAll', 'afterEach'] as const;

    it('each of the four hooks is reported when the timeout argument is missing', () => {
        const body = hooks.map(h => `  ${h}(() => { spawn('anvil', []); });`).join('\n');
        const src = `
import { ${hooks.join(', ')}, describe, it } from 'vitest';
import { spawn } from 'node:child_process';
describe('d', { timeout: 30_000 }, () => {
${body}
  it('pure', () => {});
});
`;
        const report = check({ 't.test.ts': src });
        expect(report.violations.map(v => v.message)).toEqual(hooks.map(h => `${h} spawns but has no explicit timeout argument`));
        // The cases do not spawn, and the describe already has a timeout. The hook is the miss.
        expect(report.violations.every(v => !v.message.includes('describe'))).toBe(true);
    });

    it('a numeric timeout argument silences the hook', () => {
        const src = `
import { beforeAll, describe, it } from 'vitest';
import { spawn } from 'node:child_process';
describe('d', () => {
  beforeAll(() => { spawn('anvil', []); }, 40_000);
  it('pure', () => {});
});
`;
        expect(check({ 't.test.ts': src }).violations).toEqual([]);
    });
});

describe('a helper that wraps a spawn counts as a spawn', () => {
    const helper = `
import { execFileSync } from 'node:child_process';
export function gitShow(): string {
  return execFileSync('git', ['status'], { encoding: 'utf8' });
}
`;
    const local = `
import { describe, it } from 'vitest';
import { spawnSync } from 'node:child_process';
function run(): void { spawnSync('bash', ['-c', 'true']); }
describe('d', () => { it('t', () => { run(); }); });
`;

    it('an imported helper and a local wrapper both make the describe a spawning suite', () => {
        const imported = `
import { describe, it } from 'vitest';
import { gitShow } from './h.js';
describe('d', () => { it('t', () => { gitShow(); }); });
`;
        const badImport = check({ 't.test.ts': imported, 'h.ts': helper });
        expect(badImport.violations).toHaveLength(1);
        expect(badImport.helpers.map(h => h.name)).toContain('gitShow');

        const stated = imported.replace("describe('d', () =>", "describe('d', { timeout: 30_000 }, () =>");
        expect(check({ 't.test.ts': stated, 'h.ts': helper }).violations).toEqual([]);

        const badLocal = check({ 't.test.ts': local });
        expect(badLocal.violations).toHaveLength(1);
        expect(badLocal.helpers.map(h => h.name)).toContain('run');
    });
});

describe('zero spawning files is not a pass', () => {
    it('a suite that never spawns checks nothing, and that fails closed', () => {
        const report = check({
            't.test.ts': `import { describe, it } from 'vitest';\ndescribe('d', () => { it('t', () => {}); });\n`,
        });
        expect(report.checked).toBe(0);
        const out = verdict(report);
        expect(out.ok).toBe(false);
        // This sentence is pushed only inside the checked === 0 arm. The "checked 0" line above
        // it is unconditional, so asserting that line does not pin the arm.
        expect(out.lines.join('\n')).toContain(
            'the spawn-timeout gate saw no spawning test file — a detector that matches nothing is not a pass',
        );
    });
});

describe('the scripts CI actually runs', () => {
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

    it('includes repcredit (repcredit:test) and the rest of scripts, not the packages', () => {
        const listed = listScriptTestFiles(repoRoot);
        expect(listed.globals).toBe(true);
        expect(listed.files).toContain('scripts/repcredit/experiment-auth.test.ts');
        expect(listed.files).toContain('scripts/check-abi-completeness.test.ts');
        expect(listed.files.some(f => f.startsWith('packages/'))).toBe(false);
        expect(listed.files.some(f => f.includes('/node_modules/'))).toBe(false);
    });

    it('the tree is clean, and the cross-file git helper is actually seen', () => {
        const report = checkRepo(repoRoot);
        expect(report.violations).toEqual([]);
        // Pin the count. A detector that stops seeing spawn calls drops it toward 0 and the
        // verdict above would still be green if this were only `toBeGreaterThan(0)` on a bug
        // that also stopped emitting violations. 14 is the spawning set on this tree.
        expect(report.checked).toBe(14);
        expect(report.helpers.map(h => `${h.file}#${h.name}`)).toEqual(expect.arrayContaining([
            'scripts/repcredit/deployed-stack.ts#readBlobAtRevision',
            'scripts/repcredit/deployed-stack.ts#checkDeployedAbiPin',
        ]));
        expect(verdict(report).ok).toBe(true);
    });
});
