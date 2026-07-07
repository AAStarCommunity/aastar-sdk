import { describe, it, expect } from 'vitest';
import { decodeFunctionData } from 'viem';
import { BLSAggregatorABI } from '@aastar/core';
import { SlashGovernance } from '../src/SlashGovernance.js';

const BLS = '0xF51c029879685Ced8fbCfa4b647c2eAe50Cd8B13';
const TIMELOCK = '0x1111111111111111111111111111111111111111';
const ADMIN = '0x568b1486BFE036e603eA11f0D03Dc47fa62c9E0e';
const MIN_DELAY = 172800n; // 2 days

// Mock client recording every read/write. Returns MIN_DELAY for getMinDelay and a fake
// op-id/eta for the timelock reads, so we can assert the orchestration wiring without a chain.
function makeClient() {
    const calls: any[] = [];
    const client = {
        account: { address: '0xb5600060e6de5E11D3636731964218E53caadf0E' },
        chain: { id: 11155111 },
        readContract: async (p: any) => {
            calls.push({ kind: 'read', ...p });
            if (p.functionName === 'getMinDelay') return MIN_DELAY;
            if (p.functionName === 'hashOperation') return '0xabc0000000000000000000000000000000000000000000000000000000000abc';
            if (p.functionName === 'getTimestamp') return 1783000000n;
            return 0n;
        },
        writeContract: async (p: any) => {
            calls.push({ kind: 'write', ...p });
            return '0xdeadbeef';
        },
    };
    return { client, calls };
}

function newSG(client: any) {
    return new SlashGovernance({ client, blsAggregatorAddress: BLS, timelockAddress: TIMELOCK } as any);
}

describe('SlashGovernance — Timelock orchestration (CC-13 batch B)', () => {
    it('scheduleSetSlashPolicyAdmin schedules the encoded call against the BLSAggregator, defaulting delay to getMinDelay()', async () => {
        const { client, calls } = makeClient();
        await newSG(client).scheduleSetSlashPolicyAdmin({ newAdmin: ADMIN });

        const readMinDelay = calls.find((c) => c.functionName === 'getMinDelay');
        expect(readMinDelay, 'should read getMinDelay when delay omitted').toBeTruthy();
        expect(readMinDelay.address).toBe(TIMELOCK);

        const sched = calls.find((c) => c.kind === 'write' && c.functionName === 'schedule');
        expect(sched, 'should call timelock.schedule').toBeTruthy();
        expect(sched.address).toBe(TIMELOCK);
        // args: [target, value, data, predecessor, salt, delay]
        expect(sched.args[0]).toBe(BLS);            // target = BLSAggregator
        expect(sched.args[1]).toBe(0n);             // value
        expect(sched.args[5]).toBe(MIN_DELAY);      // delay defaulted to getMinDelay()
        // inner calldata must decode to setSlashPolicyAdmin(ADMIN)
        const decoded = decodeFunctionData({ abi: BLSAggregatorABI as any, data: sched.args[2] });
        expect(decoded.functionName).toBe('setSlashPolicyAdmin');
        expect((decoded.args as readonly unknown[])[0]).toBe(ADMIN);
    });

    it('honours an explicit delay and salt, and executes the same inner call', async () => {
        const { client, calls } = makeClient();
        const salt = '0x00000000000000000000000000000000000000000000000000000000000000aa';
        await newSG(client).scheduleSetSlashThreshold({ slashLevel: 1, threshold: 3, salt, delay: 999999n });

        const sched = calls.find((c) => c.functionName === 'schedule');
        expect(sched.args[4]).toBe(salt);       // salt passed through
        expect(sched.args[5]).toBe(999999n);    // explicit delay (no getMinDelay read)
        expect(calls.some((c) => c.functionName === 'getMinDelay')).toBe(false);
        const decoded = decodeFunctionData({ abi: BLSAggregatorABI as any, data: sched.args[2] });
        expect(decoded.functionName).toBe('setSlashThreshold');
        expect((decoded.args as readonly unknown[])[0]).toBe(1);
        expect((decoded.args as readonly unknown[])[1]).toBe(3);

        const { client: c2, calls: k2 } = makeClient();
        await newSG(c2).executeSetSlashThreshold({ slashLevel: 1, threshold: 3, salt });
        const exec = k2.find((c) => c.functionName === 'execute');
        expect(exec.address).toBe(TIMELOCK);
        expect(exec.args[0]).toBe(BLS);
        expect(exec.args[4]).toBe(salt);
    });

    it('getSetSlashPolicyAdminEta hashes the op then reads its timestamp', async () => {
        const { client, calls } = makeClient();
        const eta = await newSG(client).getSetSlashPolicyAdminEta({ newAdmin: ADMIN });
        expect(eta).toBe(1783000000n);
        const hashCall = calls.find((c) => c.functionName === 'hashOperation');
        expect(hashCall.args[0]).toBe(BLS); // hashOperation target = BLSAggregator
        const tsCall = calls.find((c) => c.functionName === 'getTimestamp');
        expect(tsCall.args[0]).toBe('0xabc0000000000000000000000000000000000000000000000000000000000abc');
    });

    it('read passthroughs hit the right contracts (slashPolicyAdmin → BLS, getMinDelay → timelock)', async () => {
        const { client, calls } = makeClient();
        const sg = newSG(client);
        await sg.getSlashPolicyAdmin();
        await sg.getMinDelay();
        expect(calls.find((c) => c.functionName === 'slashPolicyAdmin').address).toBe(BLS);
        expect(calls.find((c) => c.functionName === 'getMinDelay').address).toBe(TIMELOCK);
    });
});
