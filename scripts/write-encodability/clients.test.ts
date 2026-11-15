/**
 * The operator and admin client classes build arguments and hand them to @aastar/core actions. Every write they
 * reach must encode against the ABI the action sends, the same check as core.test.ts one layer up. This is where
 * ProtocolClient.registerBLSKey passed a hex key into a (address, G1, uint8, G2) ABI while its test mocked the action.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PaymasterOperatorClient } from '../../packages/operator/src/PaymasterOperatorClient';
import { ProtocolClient } from '../../packages/operator/src/ProtocolClient';
import { OperatorLifecycle } from '../../packages/operator/src/OperatorLifecycle';
import { ProtocolGovernance } from '../../packages/admin/src/ProtocolGovernance';
import { SlashGovernance } from '../../packages/admin/src/SlashGovernance';
import { capturingConfig, drive, synthesizeClassInputs, type MethodResult } from './harness';

const ROOT = path.resolve(__dirname, '../..');
const CLASSES: Record<string, any> = { PaymasterOperatorClient, ProtocolClient, OperatorLifecycle, ProtocolGovernance, SlashGovernance };
const FILES = [
    'packages/operator/src/PaymasterOperatorClient.ts', 'packages/operator/src/ProtocolClient.ts',
    'packages/operator/src/OperatorLifecycle.ts', 'packages/admin/src/ProtocolGovernance.ts', 'packages/admin/src/SlashGovernance.ts',
].map((f) => path.join(ROOT, f));

/** `hasRole(COMMUNITY)` must be true and `hasRole(PAYMASTER_SUPER)` false for the registration to proceed. */
const BOOL_ANSWERS: Record<string, boolean[]> = { registerAsSuperPaymasterOperator: [true, false] };

/** Methods that refuse on purpose with an explicit error and send nothing. */
const REFUSES = new Set([
    'ProtocolClient.executeWithProof', 'ProtocolClient.registerBLSKey',
    'ProtocolGovernance.setTreasury', 'ProtocolGovernance.updateEntryPoint',
]);

describe('every operator / admin client write encodes against the ABI it sends (no mock of the action)', () => {
    it('scans all client classes', async () => {
        const inputs = synthesizeClassInputs(FILES, Object.keys(CLASSES));
        const results: MethodResult[] = [];
        for (const [name, Cls] of Object.entries(CLASSES)) {
            const methods = inputs.get(name);
            if (!methods) throw new Error(`no class declaration found for ${name}`);
            results.push(...await drive(name, (client) => new Cls(capturingConfig(client)), methods, {}, BOOL_ANSWERS));
        }
        if (process.env.REPORT_OUT) fs.writeFileSync(process.env.REPORT_OUT, JSON.stringify(results, null, 1));
        const id = (r: MethodResult) => `${r.factory}.${r.method}`;
        const writes = results.filter((r) => r.outcome.kind === 'write');
        expect(writes.length).toBeGreaterThan(20);
        expect(writes.filter((r) => r.outcome.kind === 'write' && r.outcome.calls.some((c) => !c.ok)).map(id)).toEqual([]);
        expect(results.filter((r) => r.outcome.kind === 'undriven').map(id).sort()).toEqual([...REFUSES].sort());
        expect(writes.map(id)).toContain('OperatorLifecycle.registerAsSuperPaymasterOperator');
    }, 300_000);
});
