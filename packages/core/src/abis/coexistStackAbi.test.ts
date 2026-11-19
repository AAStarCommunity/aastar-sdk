import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { canonicalEntry } from './paperPathAbi.js';
import { COEXIST_STACK_ENTRIES, coexistEntriesFor, scannedGetters } from './coexistStackAbi.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f: string) => JSON.parse(readFileSync(path.join(here, f), 'utf8'));
const abiOf = (j: any) => (Array.isArray(j) ? j : j.abi);
const fixture = read('fixtures/coexist-stack-abi.json');

describe('rc.8 coexisting stack: the entries the live cells and the gate use outside the seven 5.5.0 files equal the compiled rc.8 artifacts', () => {
    it('the fixture was recorded at the pinned commit (v5.5.0-rc.8) and covers every listed file', () => {
        expect(fixture.spCommit).toBe('5a150f6ad43a6c6a57ccccea427c1dba0d797d06');
        expect(Object.keys(fixture.files).sort()).toEqual(Object.keys(COEXIST_STACK_ENTRIES).sort());
    });

    for (const file of Object.keys(COEXIST_STACK_ENTRIES)) {
        it(`${file}: every entry (explicit calls + scanned address getters) has the compiled signature and selector`, () => {
            const sdk = abiOf(read(file));
            const want = coexistEntriesFor(file, sdk);
            // The fixture lists exactly what the SDK file asks for today: a new getter must be re-pinned, not skipped.
            expect(fixture.files[file].entries.map((e: any) => `${e.type}:${e.name}`)).toEqual(want.map((w) => `${w.type}:${w.name}`));
            // The scan reads every address getter the deployed (compiled) contract has, no fewer.
            if (COEXIST_STACK_ENTRIES[file].scanned) expect(scannedGetters(sdk).map((w) => w.name).sort(), `${file} scan coverage`).toEqual(fixture.files[file].compiledScanned);
            for (const e of fixture.files[file].entries) {
                expect(e.compiled, `${file} ${e.name} absent from the rc.8 artifact`).not.toBeNull();
                expect(canonicalEntry(sdk, e), `${file} ${e.type} ${e.name}`).toEqual(e.compiled);
            }
        });
    }
});
