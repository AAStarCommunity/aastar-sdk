import { describe, it, expect } from 'vitest';
import { aggregatorActions, GuardianSlashStatus } from './aggregator.js';
import { ErrorCode } from '../errors/index.js';
import { CANONICAL_ADDRESSES } from '../addresses.js';
import { BLSAggregatorABI } from '../abis/index.js';

// Read the canonical pin rather than a literal — same reason as aggregator.slashPolicy.test.ts:
// a hardcoded address survives a canonical bump silently.
const ADDR = CANONICAL_ADDRESSES[11155111].blsAggregator;
const GUARDIAN = '0xb5600060e6de5E11D3636731964218E53caadf0E';

function mockClient(returns: (params: any) => unknown) {
    const calls: any[] = [];
    const client = {
        readContract: async (params: any) => {
            calls.push(params);
            return returns(params);
        },
    };
    return { client: client as any, calls };
}

/** Mock for the raw-`call` path `guardianSlashCase` uses instead of `readContract`. */
function mockCallClient(data: string | undefined) {
    const calls: any[] = [];
    const client = {
        call: async (params: any) => {
            calls.push(params);
            return { data };
        },
    };
    return { client: client as any, calls };
}

function assertAbiFn(abi: any[], name: string, inputTypes: string[], outputTypes: string[]) {
    const entry = abi.find((e) => e?.type === 'function' && e?.name === name);
    expect(entry, `ABI missing function ${name}`).toBeTruthy();
    expect((entry.inputs ?? []).map((i: any) => i.type)).toEqual(inputTypes);
    expect((entry.outputs ?? []).map((o: any) => o.type)).toEqual(outputTypes);
}

/**
 * Lay out one 32-byte word BY HAND, right-aligned — deliberately NOT via `encodeAbiParameters`.
 *
 * A fixture generated from the same ABI the decoder consumes is the assumption checking itself: if
 * the ABI's field order is wrong, encode and decode are wrong together and the test stays green.
 * Hand-laid words with DISTINCT sentinel values make a field-order regression land visibly in the
 * wrong field.
 */
const word = (hexNoPrefix: string) => hexNoPrefix.replace(/^0x/, '').padStart(64, '0');

/**
 * The BLSAggregator-4.13.0 struct (rc.8), one word per field, each carrying a value that cannot be
 * confused with another's. Transcribed from the source struct (`BLSAggregator.sol`
 * `GuardianSlashCase`, SuperPaymaster cc125/rc8-bls f00be603):
 *
 *   bytes32 guardiansHash / bytes32 fraudProofHash / uint64 deadline / uint8 status
 *   uint16 guardianCount / uint16 resolvedCount / uint16 slashBps / address verifier
 *
 * `slashBps` is INSERTED BEFORE `verifier` relative to the deployed 4.11.0 struct, not appended.
 * NOT chain-anchored yet: no 4.13.0 aggregator is deployed; re-measure once one is.
 */
const CASE_WORDS = [
    word('11'.repeat(32)),              // guardiansHash   — bytes32, all 0x11
    word('22'.repeat(32)),              // fraudProofHash  — bytes32, all 0x22
    word('6a928d00'),                   // deadline        — uint64  1788085504
    word('01'),                         // status          — uint8   PENDING
    word('07'),                         // guardianCount   — uint16  7
    word('03'),                         // resolvedCount   — uint16  3
    word('0bb8'),                       // slashBps        — uint16  3000 (30%)
    word('a1346F1668cBf8D031Cc5D72eDA45F5788CA1cd3'), // verifier
];
const CASE_DATA = ('0x' + CASE_WORDS.join('')) as `0x${string}`;
const ALL_ZERO_256 = ('0x' + '0'.repeat(512)) as `0x${string}`; // an id with no case queued
/** The deployed 4.11.0 layout: the same fields without slashBps (what Sepolia returns today). */
const WORDS_4_11 = [...CASE_WORDS.slice(0, 6), CASE_WORDS[7]];

describe('aggregatorActions guardian slash + exit cooldown reads (CC-13 batch A)', () => {
    it('guardianExitCooldown() reads the ABI-confirmed constant with no args', async () => {
        const { client, calls } = mockClient(() => 86400n);
        const res = await aggregatorActions(ADDR)(client).guardianExitCooldown();
        expect(res).toBe(86400n);
        expect(calls[0].address).toBe(ADDR);
        expect(calls[0].functionName).toBe('GUARDIAN_EXIT_COOLDOWN');
        expect(calls[0].args).toEqual([]);
        assertAbiFn(calls[0].abi, 'GUARDIAN_EXIT_COOLDOWN', [], ['uint256']);
    });

    it('guardianSlashCaseWindow() reads the ABI-confirmed constant with no args', async () => {
        const { client, calls } = mockClient(() => 345600n);
        const res = await aggregatorActions(ADDR)(client).guardianSlashCaseWindow();
        expect(res).toBe(345600n);
        expect(calls[0].functionName).toBe('GUARDIAN_SLASH_CASE_WINDOW');
        assertAbiFn(calls[0].abi, 'GUARDIAN_SLASH_CASE_WINDOW', [], ['uint256']);
    });

    it('slashThresholdFloor() coerces the uint8 to a number', async () => {
        const { client, calls } = mockClient(() => 2);
        const res = await aggregatorActions(ADDR)(client).slashThresholdFloor();
        expect(res).toBe(2);
        expect(typeof res).toBe('number');
        assertAbiFn(calls[0].abi, 'SLASH_THRESHOLD_FLOOR', [], ['uint8']);
    });

    it('slashPathTags() reads BOTH tags and does not swap them', async () => {
        const queue = '0xcc6c401b1dc97cb5d64b721110f2358c23600da41a1f52f6bb8302e5a3de65a6';
        const execute = '0x83169fd87fa5b696801c1a24d7cc5ac227d221bf201afe84d5eea1029b2929ef';
        const { client, calls } = mockClient((p) => (p.functionName === 'TAG_QUEUE_SLASH' ? queue : execute));
        const res = await aggregatorActions(ADDR)(client).slashPathTags();
        // The whole point of these tags is separating QUEUE from EXECUTE intent; a wrapper that
        // swaps them hands the caller a valid signature over the wrong action.
        expect(res.queue).toBe(queue);
        expect(res.execute).toBe(execute);
        expect(calls.map((c) => c.functionName).sort()).toEqual(['TAG_EXECUTE_SLASH', 'TAG_QUEUE_SLASH']);
    });

    it('guardianExitCooldownUntil() passes the guardian and widens uint64 → bigint', async () => {
        const { client, calls } = mockClient(() => 1788085504);
        const res = await aggregatorActions(ADDR)(client).guardianExitCooldownUntil({ guardian: GUARDIAN });
        expect(res).toBe(1788085504n);
        expect(typeof res).toBe('bigint');
        expect(calls[0].args).toEqual([GUARDIAN]);
        assertAbiFn(calls[0].abi, 'guardianExitCooldownUntil', ['address'], ['uint64']);
    });

    it('guardianExitRequest() keeps readyAt and expiresAt in ABI order', async () => {
        const { client, calls } = mockClient(() => [111n, 222n]);
        const res = await aggregatorActions(ADDR)(client).guardianExitRequest({ guardian: GUARDIAN });
        expect(res).toEqual({ readyAt: 111n, expiresAt: 222n });
        expect(calls[0].functionName).toBe('guardianExitRequests');
        assertAbiFn(calls[0].abi, 'guardianExitRequests', ['address'], ['uint64', 'uint64']);
    });

    it('pendingGuardianSlashCount() passes the guardian through', async () => {
        const { client, calls } = mockClient(() => 3n);
        const res = await aggregatorActions(ADDR)(client).pendingGuardianSlashCount({ guardian: GUARDIAN });
        expect(res).toBe(3n);
        expect(calls[0].args).toEqual([GUARDIAN]);
        assertAbiFn(calls[0].abi, 'pendingGuardianSlashCount', ['address'], ['uint256']);
    });

    it('guardianSlashed() passes (caseId, guardian) in that order', async () => {
        const { client, calls } = mockClient(() => true);
        const res = await aggregatorActions(ADDR)(client).guardianSlashed({ caseId: 5n, guardian: GUARDIAN });
        expect(res).toBe(true);
        // Order matters and is not type-checkable on-chain: (uint256, address) reversed is a
        // different call that would revert or read a different slot.
        expect(calls[0].args).toEqual([5n, GUARDIAN]);
        assertAbiFn(calls[0].abi, 'guardianSlashed', ['uint256', 'address'], ['bool']);
    });

    it('guardianSlashed() accepts caseId 0 without tripping the required-param guard', async () => {
        const { client, calls } = mockClient(() => false);
        const res = await aggregatorActions(ADDR)(client).guardianSlashed({ caseId: 0n, guardian: GUARDIAN });
        expect(res).toBe(false);
        expect(calls[0].args).toEqual([0n, GUARDIAN]);
    });

    it('isSlashQueueHashUsed() reads usedSlashQueueHashes', async () => {
        const hash = '0x' + 'ab'.repeat(32);
        const { client, calls } = mockClient(() => true);
        const res = await aggregatorActions(ADDR)(client).isSlashQueueHashUsed({ queueHash: hash as `0x${string}` });
        expect(res).toBe(true);
        expect(calls[0].functionName).toBe('usedSlashQueueHashes');
        expect(calls[0].args).toEqual([hash]);
        assertAbiFn(calls[0].abi, 'usedSlashQueueHashes', ['bytes32'], ['bool']);
    });
});

describe('guardianSlashCase shape gate (BLSAggregator 4.13.0 = 8 words)', () => {
    it('uses a raw call, not readContract — the length must be visible BEFORE decoding', async () => {
        const { client, calls } = mockCallClient(CASE_DATA);
        await aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n });
        // If this ever goes back to readContract, the gate is dead: viem would decode a fixed number
        // of params out of a return of another width without complaint.
        expect(calls[0].to).toBe(ADDR);
        expect(calls[0].data.startsWith('0xee02231c')).toBe(true); // guardianSlashCases(uint256)
    });

    it('decodes the 8 hand-laid sentinel words into the right fields', async () => {
        const { client } = mockCallClient(CASE_DATA);
        const res = await aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n });
        expect(res.guardiansHash).toBe('0x' + '11'.repeat(32));
        expect(res.fraudProofHash).toBe('0x' + '22'.repeat(32));
        expect(res.deadline).toBe(0x6a928d00n);
        expect(res.status).toBe(GuardianSlashStatus.PENDING);
        expect(res.guardianCount).toBe(7);
        expect(res.resolvedCount).toBe(3);
        expect(res.slashBps).toBe(3000);
        expect(res.verifier.toLowerCase()).toBe('0xa1346f1668cbf8d031cc5d72eda45f5788ca1cd3');
        expect(new Set([res.guardianCount, res.resolvedCount, res.slashBps]).size).toBe(3);
    });

    it('the vendored ABI has the 4.13.0 output shape (slashBps before verifier)', () => {
        const entry = (BLSAggregatorABI as any[]).find((e) => e.type === 'function' && e.name === 'guardianSlashCases');
        expect(entry.outputs.map((o: any) => `${o.type} ${o.name}`)).toEqual([
            'bytes32 guardiansHash', 'bytes32 fraudProofHash', 'uint64 deadline', 'uint8 status',
            'uint16 guardianCount', 'uint16 resolvedCount', 'uint16 slashBps', 'address verifier',
        ]);
    });

    it('accepts the all-zero 256-byte return of an id with no case queued', async () => {
        const { client } = mockCallClient(ALL_ZERO_256);
        const res = await aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 0n });
        expect(res.status).toBe(GuardianSlashStatus.NONE);
        expect(res.slashBps).toBe(0);
        expect(res.verifier).toBe('0x0000000000000000000000000000000000000000');
    });

    it('REFUSES the deployed 4.11.0 layout (7 words) and names it, instead of decoding it shifted', async () => {
        // What Sepolia returns today. Decoded as 4.13.0 it would be short a word; the refusal must say
        // which aggregator this is, because the fix is a different SDK build, not a different caseId.
        const { client } = mockCallClient(('0x' + WORDS_4_11.join('')) as `0x${string}`);
        const err = await aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n }).catch((e) => e);
        expect(err.code).toBe(ErrorCode.ABI_SHAPE_MISMATCH);
        expect(err.message).toMatch(/returned 224 bytes.*expected 256/s);
        expect(err.message).toMatch(/BLSAggregator-4\.11\.0 struct/);
    });

    it('REFUSES a 9-word return too — the gate is exact, not a lower bound', async () => {
        const nine = ('0x' + CASE_WORDS.join('') + word('ff')) as `0x${string}`;
        const { client } = mockCallClient(nine);
        const err = await aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n }).catch((e) => e);
        expect(err.message).toMatch(/returned 288 bytes.*expected 256/s);
        expect(err.message).not.toMatch(/4\.11\.0 struct/);
    });

    it('REFUSES a same-width change that puts a large value in the slashBps word', async () => {
        const shifted = [...CASE_WORDS];
        shifted[6] = word('ff'.repeat(32));
        const { client } = mockCallClient(('0x' + shifted.join('')) as `0x${string}`);
        await expect(aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n }))
            .rejects.toThrow(/word 6 .*high 30 bytes are not zero — it cannot be the uint16 `slashBps`/s);
    });

    it('REFUSES a same-width change that puts a large value in the verifier word', async () => {
        const shifted = [...CASE_WORDS];
        shifted[7] = word('ff'.repeat(32));
        const { client } = mockCallClient(('0x' + shifted.join('')) as `0x${string}`);
        await expect(aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n }))
            .rejects.toThrow(/word 7 .*high 12 bytes are not zero — it cannot be the `verifier` address/s);
    });

    it('a 4.11.0 return padded to 8 words by a misbehaving node is caught by the slashBps guard', async () => {
        // Padding puts the 4.11.0 verifier in word 6: its high 12 bytes are zero but its high 30 are
        // not, so the slashBps guard catches it. (A SMALL integer displaced into either constrained
        // slot would still pass — the guards are not a general field-shift detector.)
        const padded = [...WORDS_4_11, word('00')];
        const { client } = mockCallClient(('0x' + padded.join('')) as `0x${string}`);
        await expect(aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n }))
            .rejects.toThrow(/word 6 .*cannot be the uint16 `slashBps`/s);
    });

    it('throws rather than returning undefined when the node gives back no data', async () => {
        const { client } = mockCallClient(undefined);
        await expect(
            aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n }),
        ).rejects.toThrow();
    });

    it('an EMPTY `0x` return is diagnosed as a wrong address, NOT as ABI drift', async () => {
        const { client } = mockCallClient('0x');
        const err = await aggregatorActions(ADDR)(client)
            .guardianSlashCase({ caseId: 1n })
            .catch((e) => e);
        expect(err.message).toMatch(/no contract code at this address/);
        expect(err.message).not.toMatch(/vendored ABI/);
        expect(err.code).toBe(ErrorCode.CONTRACT_REVERT);
    });
});
