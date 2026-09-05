/**
 * `onboardDvtNode({ router })` — resolve the validator instead of trusting an address (gap G12).
 *
 * ## The failure this closes, and why it is invisible without a router
 *
 * `AirAccount/kms/node-setup/setup-server.py` hard-pins the Sepolia validator as
 * `0x539B9681…`. That contract is SUPERSEDED. It is also still deployed, still has 13610 bytes of
 * code, and still answers `isRegistered = true` for our three nodes — measured, see
 * `packages/core/src/dvt.onchain.test.ts`. So the two checks anyone would actually run ("is there
 * code at this address?", "does it know my node?") pass against the wrong contract.
 *
 * The router is the only thing that distinguishes them, because it mounts exactly one validator at
 * algId 0x01. These tests assert the option is wired to that read and cannot be silently bypassed.
 */
import { describe, expect, it } from 'vitest';
import { onboardDvtNode } from './onboardDvtNode.js';

const ROUTER = '0xA97A752779ebfDA58612F6727Ec7C8366c39f897' as const;   // canonical ValidatorRouter
const MOUNTED = '0x7ac7E9d471742FA4397Beef0B5b11fbD22D196a9' as const;  // what it mounts today
const STALE = '0x539B9681aFd5BFbCaa655Fe4c6BdcFe1fa7864bC' as const;    // the superseded one

const ACCOUNT = { address: '0xb5600060e6de5E11D3636731964218E53caadf0E' } as const;

/** Records every read so the test can assert WHICH address the flow decided to talk to. */
function harness(mountedReturns: string) {
    const reads: { address: string; functionName: string }[] = [];
    const publicClient = {
        chain: { id: 11155111 },
        getChainId: async () => 11155111,
        readContract: async (p: any) => {
            reads.push({ address: p.address, functionName: p.functionName });
            if (p.functionName === 'getAlgorithm') return mountedReturns;
            if (p.functionName === 'validatorRouter') return ROUTER;
            // Enough of the read surface to reach the first decision point and stop.
            if (p.functionName === 'operatorNode') return `0x${'00'.repeat(32)}`;
            if (p.functionName === 'nodeOperator') return '0x0000000000000000000000000000000000000000';
            if (p.functionName === 'isRegistered') return false;
            if (p.functionName === 'minStake') return 0n;
            if (p.functionName === 'requireStake') return false;
            return 0n;
        },
        getBalance: async () => 10n ** 18n,
        simulateContract: async () => { throw new Error('STOP: reached simulate'); },
    } as any;
    const operatorWallet = { account: ACCOUNT, chain: { id: 11155111 } } as any;
    return { publicClient, operatorWallet, reads };
}

describe('onboardDvtNode router resolution (G12)', () => {
    it('reads getAlgorithm on the ROUTER and then talks to what it mounted', async () => {
        const h = harness(MOUNTED);
        await onboardDvtNode({
            publicClient: h.publicClient, operatorWallet: h.operatorWallet,
            blsSecretKey: `0x${'11'.repeat(32)}`, router: ROUTER, dryRun: true,
        }).catch(() => { /* the flow is stopped early on purpose; the reads are the assertion */ });

        const resolve = h.reads.find((r) => r.functionName === 'getAlgorithm');
        expect(resolve, 'never asked the router').toBeTruthy();
        expect(resolve!.address).toBe(ROUTER);

        // Everything after the resolve must go to the MOUNTED address, never to the router and never
        // to the canonical default. This is the assertion that would catch "option accepted, value
        // ignored" — a wiring bug that leaves every other test green.
        const after = h.reads.filter((r) => r.functionName !== 'getAlgorithm');
        expect(after.length).toBeGreaterThan(0);
        for (const r of after) expect(r.address).toBe(MOUNTED);
    });

    it('follows the router even when it mounts an address we believe is stale', async () => {
        // Deliberately makes the router return the SUPERSEDED validator. The SDK must not
        // second-guess it: the router is the authority, and a client-side "that looks wrong" list is
        // exactly the hardcoded knowledge this option removes. If the router is wrong, that is a
        // governance fact to fix on chain, not something to paper over here.
        const h = harness(STALE);
        await onboardDvtNode({
            publicClient: h.publicClient, operatorWallet: h.operatorWallet,
            blsSecretKey: `0x${'11'.repeat(32)}`, router: ROUTER, dryRun: true,
        }).catch(() => {});
        const after = h.reads.filter((r) => r.functionName !== 'getAlgorithm');
        for (const r of after) expect(r.address).toBe(STALE);
    });

    it('REFUSES both validator and router — a disagreement has no safe resolution here', async () => {
        const h = harness(MOUNTED);
        await expect(onboardDvtNode({
            publicClient: h.publicClient, operatorWallet: h.operatorWallet,
            blsSecretKey: `0x${'11'.repeat(32)}`, router: ROUTER, validator: STALE, dryRun: true,
        })).rejects.toThrow(/pass exactly one of/);
    });

    it('POSITIVE CONTROL: without router it uses the explicit validator and never touches a router', async () => {
        // Proves the new branch did not become unconditional — the old path must still work, and the
        // router read must not happen when nobody asked for it.
        const h = harness(MOUNTED);
        await onboardDvtNode({
            publicClient: h.publicClient, operatorWallet: h.operatorWallet,
            blsSecretKey: `0x${'11'.repeat(32)}`, validator: STALE, dryRun: true,
        }).catch(() => {});
        expect(h.reads.some((r) => r.functionName === 'getAlgorithm')).toBe(false);
        for (const r of h.reads) expect(r.address).toBe(STALE);
    });
});

describe('onboardDvtNode account anchor (FU-65) — the router is not a global fact', () => {
    const AA_ACCOUNT = '0x0985785d1fc37978474C472E39391774DcB1C711' as const;

    it('resolves through the ACCOUNT: validatorRouter() first, then getAlgorithm on what it named', async () => {
        // Two reads in order, on two different addresses. Asserting only the final validator would
        // pass against an implementation that ignored the account and used the canonical router —
        // which is precisely the bug this option exists to remove.
        const h = harness(MOUNTED);
        await onboardDvtNode({
            publicClient: h.publicClient, operatorWallet: h.operatorWallet,
            blsSecretKey: `0x${'11'.repeat(32)}`, account: AA_ACCOUNT, dryRun: true,
        }).catch(() => { /* stopped early on purpose; the read TRACE is the assertion */ });

        const vr = h.reads.find((r) => r.functionName === 'validatorRouter');
        expect(vr, 'never asked the account').toBeTruthy();
        expect(vr!.address, 'asked the wrong contract for the router').toBe(AA_ACCOUNT);

        const alg = h.reads.find((r) => r.functionName === 'getAlgorithm');
        expect(alg, 'never resolved algId 0x01').toBeTruthy();
        expect(alg!.address).toBe(ROUTER);
        // Order matters: the router must come FROM the account, not be known beforehand.
        expect(h.reads.indexOf(vr!)).toBeLessThan(h.reads.indexOf(alg!));

        const after = h.reads.filter((r) => !['validatorRouter', 'getAlgorithm'].includes(r.functionName));
        expect(after.length).toBeGreaterThan(0);
        for (const r of after) expect(r.address).toBe(MOUNTED);
    });

    it('NEGATIVE CONTROL: without `account`, validatorRouter is never read', async () => {
        // Otherwise the assertion above would also hold for an implementation that always reads the
        // account — and a flow that reads an address it was not given is its own bug.
        const h = harness(MOUNTED);
        await onboardDvtNode({
            publicClient: h.publicClient, operatorWallet: h.operatorWallet,
            blsSecretKey: `0x${'11'.repeat(32)}`, router: ROUTER, dryRun: true,
        }).catch(() => {});
        expect(h.reads.find((r) => r.functionName === 'validatorRouter')).toBeUndefined();
    });

    for (const [name, extra] of [
        ['account + router', { account: AA_ACCOUNT, router: ROUTER }],
        ['account + validator', { account: AA_ACCOUNT, validator: STALE }],
        ['router + validator', { router: ROUTER, validator: STALE }],
        ['all three', { account: AA_ACCOUNT, router: ROUTER, validator: STALE }],
    ] as const) {
        it(`REFUSES ${name} — they can disagree, and the chain will not tell you which won`, async () => {
            // `validator` vs `router` was ALREADY guarded pairwise before this (9b5f31c2:223). The
            // real gap is narrower and easy to miss: **a two-way check does not become a three-way
            // one by adding a third option next to it.** An earlier draft of this comment said the
            // code "silently preferred router" — that was wrong, and an existing test asserting the
            // old error message is what caught it.
            //
            // Why it matters more than an ordinary argument clash: a wrong DVT validator does not
            // revert, so nothing downstream would ever surface which anchor won.
            const h = harness(MOUNTED);
            await expect(onboardDvtNode({
                publicClient: h.publicClient, operatorWallet: h.operatorWallet,
                blsSecretKey: `0x${'11'.repeat(32)}`, dryRun: true, ...extra,
            })).rejects.toThrow(/pass exactly one/);
            // And it must refuse BEFORE touching the chain: a rejection that already sent reads has
            // decided something on the caller's behalf.
            expect(h.reads).toHaveLength(0);
        });
    }

    it('POSITIVE CONTROL: exactly one anchor is accepted, all three ways', async () => {
        // Without this, a guard that threw on ANY anchor would satisfy every case above while
        // making the option unusable.
        for (const extra of [{ account: AA_ACCOUNT }, { router: ROUTER }, { validator: MOUNTED }]) {
            const h = harness(MOUNTED);
            const err = await onboardDvtNode({
                publicClient: h.publicClient, operatorWallet: h.operatorWallet,
                blsSecretKey: `0x${'11'.repeat(32)}`, dryRun: true, ...extra,
            }).then(() => null, (e: Error) => e);
            expect(err?.message ?? '', JSON.stringify(extra)).not.toMatch(/pass exactly one of/);
            expect(h.reads.length, JSON.stringify(extra)).toBeGreaterThan(0);
        }
    });
});
