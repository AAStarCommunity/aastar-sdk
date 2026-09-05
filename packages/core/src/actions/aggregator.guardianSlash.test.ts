import { describe, it, expect } from 'vitest';
import { aggregatorActions, GuardianSlashStatus } from './aggregator.js';
import { ErrorCode } from '../errors/index.js';
import { CANONICAL_ADDRESSES } from '../addresses.js';

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
 * The 4.11.0 struct, one word per field, each carrying a value that cannot be confused with another's.
 *
 * WHY THIS IS HAND-BUILT AND NOT CAPTURED FROM CHAIN
 * --------------------------------------------------
 * Measured on Sepolia against `blsAggregator` (version `BLSAggregator-4.11.0`), ids 0/1/2:
 * `guardianSlashCases` returns 224 bytes of ZEROES — no case has ever been queued. So the live
 * contract anchors the LENGTH (and `guardianSlashCaseShapeGate` below uses exactly that), but it
 * cannot anchor the FIELD ORDER: an all-zero return decodes identically under any ordering.
 *
 * That half of the evidence therefore stays offline until the first real case is queued. Recorded
 * rather than papered over: "7 words decode" is chain-anchored, "the 7 decode into the RIGHT fields"
 * is not.
 */
const CASE_WORDS = [
    word('11'.repeat(32)),              // guardiansHash   — bytes32, all 0x11
    word('22'.repeat(32)),              // fraudProofHash  — bytes32, all 0x22
    word('6a928d00'),                   // deadline        — uint64  1788085504
    word('01'),                         // status          — uint8   PENDING
    word('07'),                         // guardianCount   — uint16  7
    word('03'),                         // resolvedCount   — uint16  3
    word('a1346F1668cBf8D031Cc5D72eDA45F5788CA1cd3'), // verifier — the real 4.11.0 fraudProofVerifier
];
const CASE_DATA = ('0x' + CASE_WORDS.join('')) as `0x${string}`;
const ALL_ZERO_224 = ('0x' + '0'.repeat(448)) as `0x${string}`; // exactly what chain returns today

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

describe('guardianSlashCase shape gate (BLSAggregator 4.11.0 = 7 words)', () => {
    it('uses a raw call, not readContract — the length must be visible BEFORE decoding', async () => {
        const { client, calls } = mockCallClient(CASE_DATA);
        await aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n });
        // If this ever goes back to readContract, the gate is dead: viem would decode 7 params out of
        // a longer return without complaint, which is the exact failure this wrapper exists to stop.
        expect(calls[0].to).toBe(ADDR);
        expect(calls[0].data.startsWith('0xee02231c')).toBe(true); // guardianSlashCases(uint256)
    });

    it('decodes the 7 hand-laid sentinel words into the right fields', async () => {
        const { client } = mockCallClient(CASE_DATA);
        const res = await aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n });
        expect(res.guardiansHash).toBe('0x' + '11'.repeat(32));
        expect(res.fraudProofHash).toBe('0x' + '22'.repeat(32));
        expect(res.deadline).toBe(0x6a928d00n);
        expect(res.status).toBe(GuardianSlashStatus.PENDING);
        expect(res.guardianCount).toBe(7);
        expect(res.resolvedCount).toBe(3);
        expect(res.verifier.toLowerCase()).toBe('0xa1346f1668cbf8d031cc5d72eda45f5788ca1cd3');
        // Each sentinel is distinct, so a field-order regression cannot land a value in a slot where
        // it still looks right.
        expect(res.guardianCount).not.toBe(res.resolvedCount);
    });

    it('accepts the all-zero 224-byte return the live contract actually gives today', async () => {
        // Measured on Sepolia: ids 0/1/2 all return 224 zero bytes (no case ever queued). The gate
        // must not treat "empty" as "wrong shape" — an empty case is the normal state right now.
        const { client } = mockCallClient(ALL_ZERO_224);
        const res = await aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 0n });
        expect(res.status).toBe(GuardianSlashStatus.NONE);
        expect(res.guardianCount).toBe(0);
        expect(res.verifier).toBe('0x0000000000000000000000000000000000000000');
    });

    it('REFUSES an 8-word return (the 4.12.0 struct) instead of silently dropping a field', async () => {
        // The whole hazard: same selector, longer struct, no revert. 4.12.0 adds a field; if it is
        // added anywhere but the end, every later field shifts and every value is plausible.
        const eightWords = ('0x' + CASE_WORDS.join('') + word('ff')) as `0x${string}`;
        const { client } = mockCallClient(eightWords);
        await expect(
            aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n }),
        ).rejects.toThrow(/returned 256 bytes.*expected 224/s);
    });

    it('REFUSES the REAL 4.12.0 layout — read from upstream source, not invented', async () => {
        // The case above uses a made-up extra word. This one is the actual struct, transcribed from
        // SuperPaymaster@d651646a `contracts/src/modules/monitoring/BLSAggregator.sol:143`, which
        // self-declares `BLSAggregator-4.12.0` while the deployed contract is 4.11.0:
        //
        //   bytes32 guardiansHash / bytes32 fraudProofHash / uint64 deadline / uint8 status
        //   uint16 guardianCount / uint16 resolvedCount / uint16 slashBps / address verifier
        //
        // `slashBps` is INSERTED BEFORE `verifier`, not appended — so a 7-parameter decode reads
        // words 0-5 correctly, reads `slashBps` AS `verifier`, and drops the real verifier entirely.
        // An invented trailing word could never have shown that.
        const REAL_412 = [
            CASE_WORDS[0], CASE_WORDS[1], CASE_WORDS[2], CASE_WORDS[3], CASE_WORDS[4], CASE_WORDS[5],
            word('64'),                                       // slashBps = 100 bps, the new word 6
            word('a1346F1668cBf8D031Cc5D72eDA45F5788CA1cd3'), // verifier, displaced to word 7
        ];
        const { client } = mockCallClient(('0x' + REAL_412.join('')) as `0x${string}`);
        await expect(
            aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n }),
        ).rejects.toThrow(/returned 256 bytes.*expected 224/s);
    });

    it('and on that real layout ONLY the width guard fires — the zero-padding one is blind to it', async () => {
        // Worth pinning because it corrects an overclaim. `slashBps` is a uint16: right-aligned,
        // 30 zero high bytes. So when it lands in the `verifier` slot the high-12-bytes check passes
        // happily. The zero-padding guard catches displacement only when the displaced value is
        // LARGE — it is not a general field-shift detector, and the real upcoming change is exactly
        // the case it misses.
        //
        // Truncating the real 4.12.0 return to 7 words simulates "width somehow agreed": every
        // remaining guard is then satisfied, and `verifier` decodes to 0x…0064 — a plausible-looking
        // address that is really a basis-point count. That is what the width check is preventing,
        // alone.
        const truncated = [
            CASE_WORDS[0], CASE_WORDS[1], CASE_WORDS[2], CASE_WORDS[3], CASE_WORDS[4], CASE_WORDS[5],
            word('64'), // slashBps sitting where verifier is expected
        ];
        const { client } = mockCallClient(('0x' + truncated.join('')) as `0x${string}`);
        const res = await aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n });
        expect(res.verifier).toBe('0x0000000000000000000000000000000000000064');
        // Documented, not celebrated: this is the shape the guards do NOT catch between them.
    });

    it('REFUSES a 6-word return too — the gate is exact, not a lower bound', async () => {
        const sixWords = ('0x' + CASE_WORDS.slice(0, 6).join('')) as `0x${string}`;
        const { client } = mockCallClient(sixWords);
        await expect(
            aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n }),
        ).rejects.toThrow(/returned 192 bytes/);
    });

    it('REFUSES a same-width struct change: right length, non-zero high bytes in the address word', async () => {
        // Length alone cannot see a field being REPLACED rather than added — still 7 words. The
        // address word is the cheap discriminator: a displaced uint256/bytes32 does not have 12 zero
        // high bytes. This is the half the byte-length check is blind to.
        const shifted = [...CASE_WORDS];
        shifted[6] = word('ff'.repeat(32));
        const { client } = mockCallClient(('0x' + shifted.join('')) as `0x${string}`);
        await expect(
            aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n }),
        ).rejects.toThrow(/high 12 bytes are not zero/);
    });

    it('throws rather than returning undefined when the node gives back no data', async () => {
        const { client } = mockCallClient(undefined);
        await expect(
            aggregatorActions(ADDR)(client).guardianSlashCase({ caseId: 1n }),
        ).rejects.toThrow();
    });

    it('an EMPTY `0x` return is diagnosed as a wrong address, NOT as ABI drift', async () => {
        // Found in adversarial round 2: the shape gate used to swallow this case and tell the caller
        // to re-sync the ABI. `eth_call` returns `0x` when there is no code at the address (or no such
        // function and no fallback) — sending someone to re-sync the ABI for that costs an hour on the
        // wrong lead. The remediation text is the assertion here, because the remediation text is what
        // was wrong.
        const { client } = mockCallClient('0x');
        const err = await aggregatorActions(ADDR)(client)
            .guardianSlashCase({ caseId: 1n })
            .catch((e) => e);
        expect(err.message).toMatch(/no contract code at this address/);
        expect(err.message).not.toMatch(/Re-sync the BLSAggregator ABI/);
        expect(err.code).toBe(ErrorCode.CONTRACT_REVERT);
    });

    it('a wrong-shape return is tagged ABI_SHAPE_MISMATCH so callers can tell it from a revert', async () => {
        // The code, not just the text: a shape mismatch must never be retried, while a revert might
        // legitimately be. Callers branch on `code`, so it has to be the distinguishing one.
        const eightWords = ('0x' + CASE_WORDS.join('') + word('ff')) as `0x${string}`;
        const { client } = mockCallClient(eightWords);
        const err = await aggregatorActions(ADDR)(client)
            .guardianSlashCase({ caseId: 1n })
            .catch((e) => e);
        expect(err.code).toBe(ErrorCode.ABI_SHAPE_MISMATCH);
    });
});
