import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { PAPER_PATH_ENTRIES, canonicalEntry } from './paperPathAbi.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f: string) => JSON.parse(readFileSync(path.join(here, f), 'utf8'));
const abiOf = (j: any) => (Array.isArray(j) ? j : j.abi);
const fixture = read('fixtures/paper-path-abi.json');

describe('paper-path ABI entries in the vendored files equal SuperPaymaster at the recorded commit', () => {
    it('the fixture names a full SP commit and covers every listed file and entry', () => {
        expect(fixture.spCommit).toMatch(/^[0-9a-f]{40}$/);
        for (const [file, { entries }] of Object.entries(PAPER_PATH_ENTRIES)) {
            expect(fixture.files[file]?.upstreamBlobSha256).toMatch(/^[0-9a-f]{64}$/);
            expect(fixture.files[file].entries).toHaveLength(entries.length);
        }
    });

    for (const [file, { entries }] of Object.entries(PAPER_PATH_ENTRIES)) {
        it(`${file}: same signature and selector for each of ${entries.length} entries`, () => {
            const sdk = abiOf(read(file));
            entries.forEach((want, i) => {
                expect(canonicalEntry(sdk, want), `${want.type} ${want.name}`).toEqual(fixture.files[file].entries[i]);
            });
        });
    }

    it('the comparison sees a change: an output type or an indexed flag differs', () => {
        const sdk = abiOf(read('xPNTsTokenV2.full.json'));
        const debts = structuredClone(sdk.find((e: any) => e.type === 'function' && e.name === 'debts'));
        debts.outputs[0].type = 'uint128';
        expect(canonicalEntry([debts], { type: 'function', name: 'debts' })).not.toEqual(canonicalEntry(sdk, { type: 'function', name: 'debts' }));
        const repaid = structuredClone(sdk.find((e: any) => e.type === 'event' && e.name === 'DebtRepaid'));
        repaid.inputs[0].indexed = !repaid.inputs[0].indexed;
        expect(canonicalEntry([repaid], { type: 'event', name: 'DebtRepaid' })).not.toEqual(canonicalEntry(sdk, { type: 'event', name: 'DebtRepaid' }));
    });
});
