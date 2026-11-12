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
    readVitestConfig,
    resolveRepoFile,
    verdict,
    type SpawnTimeoutReport,
} from './check-spawn-timeouts.js';

function check(files: Record<string, string>, entries?: string[]): SpawnTimeoutReport {
    const map = new Map(Object.entries(files));
    return checkSources(map, entries ?? [Object.keys(files)[0]!]);
}

/** A second, already-correct spawning file. A miss then still returns a passing verdict. */
const okFile = `
import { describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
describe('ok', { timeout: 30_000 }, () => {
  it('t', () => { execFileSync('true'); });
});
`;

function withControl(src: string, extra: Record<string, string> = {}): SpawnTimeoutReport {
    return check({ 't.test.ts': src, 'ok.test.ts': okFile, ...extra }, ['t.test.ts', 'ok.test.ts']);
}

const DESCRIBE_MISSED = 'top-level describe has no explicit timeout ({ timeout } before any later spread or computed key, or a numeric third argument)';

describe('a spawning file that states every timeout is silent', () => {
    const src = `
import { afterAll, beforeAll, describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
const SPAWN_VERDICT_TIMEOUT_MS = 30_000;
const folded = 30 * 1000;
describe('options', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
  describe('nested needs nothing of its own', () => {
    it('spawns', () => { execFileSync('true'); });
  });
  beforeAll(() => { execFileSync('true'); }, folded);
  afterAll(() => {}, SPAWN_VERDICT_TIMEOUT_MS);
});
describe('third argument', () => {
  it('spawns', () => { execFileSync('true'); });
}, 30_000);
describe('spread then timeout', { ...{}, timeout: 30_000 }, () => {
  it('spawns', () => { execFileSync('true'); });
});
`;
    it('options object, numeric third argument, a folded const, and hook timeouts all satisfy the rule', () => {
        const report = check({ 't.test.ts': src });
        expect(report.violations).toEqual([]);
        expect(report.checked).toBe(1);
        expect(verdict(report).ok).toBe(true);
    });

    it('a file that never imports a spawn package is not judged', () => {
        const pure = `import { describe, it } from 'vitest';\ndescribe('d', () => { it('t', () => {}); });\n`;
        const report = check({ 't.test.ts': pure });
        expect(report.violations).toEqual([]);
        expect(report.checked).toBe(0);
    });
});

describe('spawning files', () => {
    it('an untimed top-level describe is a violation, however the spawn is written', () => {
        const forms = [
            `import { execFileSync } from 'node:child_process';\ndescribe('d', () => { it('t', () => { execFileSync('true'); }); });`,
            `import * as cp from 'node:child_process';\ndescribe('d', () => { it('t', () => { cp['execFileSync']('true'); }); });`,
            `import * as cp from 'node:child_process';\nconst runner = { run: () => cp.execFileSync('true') };\ndescribe('d', () => { it('t', () => { runner.run(); }); });`,
            `import * as cp from 'node:child_process';\nfunction run(exec = cp.execFileSync) { exec('true'); }\ndescribe('d', () => { it('t', () => { run(); }); });`,
            `import cp = require('node:child_process');\ndescribe('d', () => { it('t', () => { cp.execFileSync('true'); }); });`,
            `import { execa } from 'execa';\ndescribe('d', () => { it('t', async () => { await execa('echo', ['hi']); }); });`,
            `const cp = require('node:child_process');\ndescribe('d', () => { it('t', () => { cp.execFileSync('true'); }); });`,
            `async function load() { return import('execa'); }\ndescribe('d', () => { it('t', () => { load(); }); });`,
            `import type { ChildProcess } from 'node:child_process';\ndescribe('d', () => { it('t', () => {}); });`,
        ];
        for (const body of forms) {
            const report = withControl(body + '\n');
            expect(report.violations.map(v => v.message), body).toEqual([DESCRIBE_MISSED]);
            expect(report.checked, body).toBe(2);
            expect(verdict(report).ok, body).toBe(false);
        }
    });

    it('each of the four hooks needs its own timeout argument', () => {
        const hooks = ['beforeAll', 'beforeEach', 'afterAll', 'afterEach'] as const;
        const body = hooks.map(h => `  ${h}(() => {});`).join('\n');
        const src = `
import { ${hooks.join(', ')}, describe, it } from 'vitest';
import { spawn } from 'node:child_process';
describe('d', { timeout: 30_000 }, () => {
${body}
  it('pure', () => { spawn('anvil', []); });
});
`;
        const report = withControl(src);
        expect(report.violations.map(v => v.message)).toEqual(hooks.map(h => `${h} has no explicit timeout argument`));

        const named = `
import { execFileSync } from 'node:child_process';
import * as v from 'vitest';
v.describe('d', { timeout: 30_000 }, () => {
  v.beforeAll(() => { execFileSync('true'); });
});
`;
        expect(withControl(named).violations.map(v => v.message)).toEqual([
            'beforeAll has no explicit timeout argument',
        ]);
    });

    it('a transitive relative import of child_process makes the test file spawning', () => {
        const helper = `import { execFileSync } from 'node:child_process';\nexport const run = () => execFileSync('true');\n`;
        const src = `import { describe, it } from 'vitest';\nimport { run } from './h.js';\ndescribe('d', () => { it('t', () => { run(); }); });\n`;
        const report = withControl(src, { 'h.ts': helper });
        expect(report.violations.map(v => `${v.file}: ${v.message}`)).toEqual([`t.test.ts: ${DESCRIBE_MISSED}`]);
        expect(report.checked).toBe(2);
        expect(verdict(report).ok).toBe(false);
    });

    it('an unresolvable relative import makes the test file spawning', () => {
        const src = `import { describe, it } from 'vitest';\nimport { missing } from './no-such-module.js';\ndescribe('d', () => { it('t', () => { missing(); }); });\n`;
        const report = withControl(src);
        expect(report.violations.map(v => v.message)).toEqual([DESCRIBE_MISSED]);
        expect(verdict(report).ok).toBe(false);
    });

    it('a namespace describe and describe.skip are still top-level describes', () => {
        const ns = `
import { execFileSync } from 'node:child_process';
import * as v from 'vitest';
v.describe('d', () => { v.it('t', () => { execFileSync('true'); }); });
`;
        expect(withControl(ns).violations.map(v => v.message)).toEqual([DESCRIBE_MISSED]);

        const skipped = `
import { execFileSync } from 'node:child_process';
import { describe, it } from 'vitest';
describe.skip('d', () => { it('t', () => { execFileSync('true'); }); });
`;
        expect(withControl(skipped).violations.map(v => v.message)).toEqual([DESCRIBE_MISSED]);

        const covered = `
import { execFileSync } from 'node:child_process';
import * as v from 'vitest';
v.describe('d', { timeout: 30_000 }, () => { v.it('t', () => { execFileSync('true'); }); });
`;
        expect(check({ 't.test.ts': covered }).violations).toEqual([]);
    });

    it('a top-level it is a violation even when it passes a timeout', () => {
        const src = `
import { it } from 'vitest';
import { execFileSync } from 'node:child_process';
it('spawn', () => execFileSync('true'), 30_000);
`;
        const report = withControl(src);
        expect(report.violations.map(v => v.message)).toEqual(['top-level it/test is not inside a describe']);
        expect(verdict(report).ok).toBe(false);
    });

    it('a computed key or a spread after timeout erases it', () => {
        const computed = `
import { describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
describe('d', { timeout: 30000, ['timeout']: undefined }, () => {
  it('t', () => { execFileSync('true'); });
});
`;
        const spread = `
import { describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
const extra = {};
describe('d', { timeout: 30000, ...extra }, () => {
  it('t', () => { execFileSync('true'); });
});
`;
        const duplicate = `
import { describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
describe('d', { timeout: 30000, timeout: undefined }, () => {
  it('t', () => { execFileSync('true'); });
});
`;
        for (const src of [computed, spread, duplicate]) {
            const report = withControl(src);
            expect(report.violations.map(v => v.message), src).toEqual([DESCRIBE_MISSED]);
            expect(report.checked, src).toBe(2);
            expect(verdict(report).ok, src).toBe(false);
        }
    });

    it('an aliased vitest import is still a describe, a hook, and a top-level test', () => {
        const src = `
import { describe as d, beforeAll as setup, it as caseOf } from 'vitest';
import { execFileSync } from 'node:child_process';
d('s', () => {
  setup(() => { execFileSync('true'); });
  caseOf('c', () => { execFileSync('true'); });
});
caseOf('top', () => { execFileSync('true'); });
`;
        expect(withControl(src).violations.map(v => v.message)).toEqual([
            DESCRIBE_MISSED,
            'beforeAll has no explicit timeout argument',
            'top-level it/test is not inside a describe',
        ]);

        const skipped = `
import { describe as d, it as caseOf } from 'vitest';
import { execFileSync } from 'node:child_process';
d.skip('s', () => { caseOf('c', () => { execFileSync('true'); }); });
`;
        expect(withControl(skipped).violations.map(v => v.message)).toEqual([DESCRIBE_MISSED]);
    });

    it('a tagged-template describe.each and it.each are registrations', () => {
        const tagged = `
import { describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
describe.each\`a
\${1}\`('suite', () => { it('t', () => { execFileSync('true'); }); });
`;
        expect(withControl(tagged).violations.map(v => v.message)).toEqual([DESCRIBE_MISSED]);

        const top = `
import { it } from 'vitest';
import { execFileSync } from 'node:child_process';
it.each\`row\`('t', () => { execFileSync('true'); });
`;
        expect(withControl(top).violations.map(v => v.message)).toEqual([
            'top-level it/test is not inside a describe',
        ]);

        const called = `
import { execFileSync } from 'node:child_process';
describe.each([1])('suite', () => { it('t', () => { execFileSync('true'); }); });
`;
        expect(withControl(called).violations.map(v => v.message)).toEqual([DESCRIBE_MISSED]);

        const timed = `
import { describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
describe.each\`a\`('suite', { timeout: 30_000 }, () => {
  it('t', () => { execFileSync('true'); });
});
`;
        expect(check({ 't.test.ts': timed }).violations).toEqual([]);
    });

    it('a numeric suite title is not a timeout', () => {
        const src = `
import { describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
describe(123, () => { it('case', () => { execFileSync('true'); }); });
`;
        const report = withControl(src);
        expect(report.violations.map(v => v.message)).toEqual([DESCRIBE_MISSED]);
        expect(report.checked).toBe(2);
        expect(verdict(report).ok).toBe(false);
    });

    it('an inner const shadows the module timeout the hook actually receives', () => {
        const shadowed = `
import { beforeAll, describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
const timeout = 30000;
describe('d', { timeout: 30_000 }, () => {
  const timeout = undefined;
  beforeAll(() => { execFileSync('true'); }, timeout);
  it('t', () => {});
});
`;
        expect(withControl(shadowed).violations.map(v => v.message)).toEqual([
            'beforeAll has no explicit timeout argument',
        ]);

        const blockConst = `
import { describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
{
  const timeout = 30000;
  describe('d', { timeout }, () => { it('t', () => { execFileSync('true'); }); });
}
`;
        expect(check({ 't.test.ts': blockConst }).violations).toEqual([]);
    });

    it('a method named test is not a vitest registration', () => {
        const src = `
import { describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
const pattern = /foo/;
pattern.test('foo');
function test() { return 1; }
test('not vitest', () => {});
describe('untimed', () => { it('t', () => { execFileSync('true'); }); });
`;
        expect(withControl(src).violations.map(v => v.message)).toEqual([DESCRIBE_MISSED]);

        const off = `
import { execFileSync } from 'node:child_process';
describe('d', () => { it('t', () => { execFileSync('true'); }); });
`;
        const map = new Map([['t.test.ts', off]]);
        expect(checkSources(map, ['t.test.ts'], false).violations).toEqual([]);
        expect(checkSources(map, ['t.test.ts'], true).violations.map(v => v.message)).toEqual([DESCRIBE_MISSED]);
    });

    it('a directory specifier resolves to index.ts, not the directory', () => {
        const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
        const resolved = resolveRepoFile(repoRoot, 'scripts/t.test.ts', '../packages/core/src');
        expect(resolved).toBe('packages/core/src/index.ts');
    });

    it('a stored describe.skipIf result is the suite, not an untimed registration', () => {
        const spawn = `import { execFileSync } from 'node:child_process';`;
        const timed = (init: string, call = 'suite') => `
import { describe, it } from 'vitest';
${spawn}
const hasAnvil = false;
${init}
${call}('integration', { timeout: 30000 }, () => {
  it('t', () => { execFileSync('true'); });
});
`;
        const forms = [
            `const suite = describe.skipIf(!hasAnvil);`,
            `const suite = describe.runIf(hasAnvil);`,
            `const suite = describe.skip;`,
            `const suite = describe.only;`,
            `const suite = describe.each([1]);`,
            `const suite = describe.each\`row\`;`,
        ];
        for (const init of forms) {
            expect(check({ 't.test.ts': timed(init) }).violations, init).toEqual([]);
        }

        const untimed = `
import { describe, it } from 'vitest';
${spawn}
const suite = describe.skipIf(!hasAnvil);
suite('integration', () => { it('t', () => { execFileSync('true'); }); });
`;
        expect(withControl(untimed).violations.map(v => v.message)).toEqual([DESCRIBE_MISSED]);
    });

    it('a plain property after timeout does not erase it', () => {
        const src = `
import { describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
describe('suite', { timeout: 30000, retry: 1 }, () => {
  it('t', () => { execFileSync('true'); });
});
describe('untimed', () => { it('t', () => { execFileSync('true'); }); });
`;
        expect(withControl(src).violations.map(v => v.message)).toEqual([DESCRIBE_MISSED]);
    });

    it('a let binding or a reassigned const is not an explicit timeout', () => {
        const forms = [
            `let timeout = 30000;\ndescribe('d', { timeout }, () => { it('t', () => {}); });`,
            `var timeout = 30000;\ndescribe('d', { timeout }, () => { it('t', () => {}); });`,
            `const timeout = 30000;\ntimeout = undefined;\ndescribe('d', { timeout }, () => { it('t', () => {}); });`,
            `const timeout = 30000;\n({ timeout } = {});\ndescribe('d', { timeout }, () => { it('t', () => {}); });`,
            `let base = 30000;\nconst timeout = base;\ndescribe('d', { timeout }, () => { it('t', () => {}); });`,
        ];
        for (const body of forms) {
            const src = `import { describe, it } from 'vitest';\nimport { execFileSync } from 'node:child_process';\n${body}\n`;
            expect(withControl(src).violations.map(v => v.message), body).toEqual([DESCRIBE_MISSED]);
        }

        const hook = `
import { beforeAll, describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
const timeout = 30000;
timeout++;
describe('d', { timeout: 30_000 }, () => {
  beforeAll(() => { execFileSync('true'); }, timeout);
  it('pure', () => {});
});
`;
        expect(withControl(hook).violations.map(v => v.message)).toEqual([
            'beforeAll has no explicit timeout argument',
        ]);
    });

    it('a non-literal import or require makes the file spawning', () => {
        const forms = [
            `async function load(name: string) { return import(name); }\ndescribe('d', () => { it('t', () => { load('fs'); }); });`,
            `function load(name: string) { return require(name); }\ndescribe('d', () => { it('t', () => { load('fs'); }); });`,
        ];
        for (const body of forms) {
            const src = `import { describe, it } from 'vitest';\n${body}\n`;
            const report = withControl(src);
            expect(report.violations.map(v => v.message), body).toEqual([DESCRIBE_MISSED]);
            expect(verdict(report).ok, body).toBe(false);
        }
    });
});

describe('vitest config', () => {
    const base = `
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
});
`;

    it('readVitestConfig rejects a spread, a computed key, and a non-literal include entry', () => {
        const spread = base.replace(
            'exclude: [\'**/node_modules/**\'],',
            'exclude: [\'**/node_modules/**\'],\n    ...external,',
        );
        expect(() => readVitestConfig(spread)).toThrow(/spread/);

        const computed = base.replace(
            'include: [\'**/*.test.ts\'],',
            '[\'include\']: [\'**/*.test.ts\'],',
        );
        expect(() => readVitestConfig(computed)).toThrow(/computed key/);

        const element = base.replace('include: [\'**/*.test.ts\']', 'include: [\'**/*.test.ts\', extra]');
        expect(() => readVitestConfig(element)).toThrow(/string literals/);

        expect(readVitestConfig(base).include).toEqual(['**/*.test.ts']);
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

    it('the tree is clean', () => {
        const report = checkRepo(repoRoot);
        expect(report.violations).toEqual([]);
        // Pin the count. A detector that stops seeing spawning files drops it toward 0 and the
        // verdict above would still be green if this were only toBeGreaterThan(0) on a bug
        // that also stopped emitting violations. 18 is the spawning set under the file-level rule.
        expect(report.checked).toBe(18);
        expect(verdict(report).ok).toBe(true);
    });
});
