import { describe, it, expect } from 'vitest';
import { concatHex, keccak256, pad, toHex } from 'viem';
import { aggregatorActions } from './aggregator.js';
import { ErrorCode } from '../errors/index.js';
import { BLSAggregatorABI } from '../abis/index.js';

const ADDR = '0x' + '42'.repeat(20) as `0x${string}`;
// The literal SuperPaymaster defines, not a value read from the ABI under test.
const TAG_PROPOSAL = keccak256(toHex('SuperPaymaster.BLS.Proposal.v1'));

function mockClient(returns: (params: any) => unknown) {
    const calls: any[] = [];
    const client = {
        readContract: async (params: any) => { calls.push(params); return returns(params); },
        writeContract: async (params: any) => { calls.push(params); return '0xhash'; },
    };
    return { client: client as any, calls };
}

describe('BLSAggregator-4.13.0 typed proposal keys', () => {
    it('the generic replay key is keccak256(TAG_PROPOSAL ‖ uint256 id), with the tag read from chain', async () => {
        const { client, calls } = mockClient(() => TAG_PROPOSAL);
        const key = await aggregatorActions(ADDR)(client).genericProposalReplayKey({ proposalId: 7n });
        // Built by hand (concat of two 32-byte words), not with the encoder the action uses.
        expect(key).toBe(BigInt(keccak256(concatHex([TAG_PROPOSAL, pad(toHex(7n), { size: 32 })]))));
        expect(calls[0]).toMatchObject({ address: ADDR, functionName: 'TAG_PROPOSAL', args: [] });
    });

    it('isGenericProposalExecuted reads executedProposals at the typed key, never at the raw id', async () => {
        const typed = BigInt(keccak256(concatHex([TAG_PROPOSAL, pad(toHex(7n), { size: 32 })])));
        const { client, calls } = mockClient((p) => (p.functionName === 'TAG_PROPOSAL' ? TAG_PROPOSAL : p.args[0] === typed));
        expect(await aggregatorActions(ADDR)(client).isGenericProposalExecuted({ proposalId: 7n })).toBe(true);
        expect(calls.map((c) => c.functionName)).toEqual(['TAG_PROPOSAL', 'executedProposals']);
        expect(calls[1].args).toEqual([typed]);
    });

    it('signersCommitment reads proposalSignersCommitment(key)', async () => {
        const c = ('0x' + 'ab'.repeat(32)) as `0x${string}`;
        const { client, calls } = mockClient(() => c);
        expect(await aggregatorActions(ADDR)(client).signersCommitment({ key: 5n })).toBe(c);
        expect(calls[0]).toMatchObject({ functionName: 'proposalSignersCommitment', args: [5n] });
    });

    it('the vendored ABI is 4.13.0: SignersCommitted(uint256 indexed, uint256) and MAX_VALIDATORS exist', () => {
        const ev = (BLSAggregatorABI as any[]).find((e) => e.type === 'event' && e.name === 'SignersCommitted');
        expect(ev.inputs.map((i: any) => [i.type, i.indexed])).toEqual([['uint256', true], ['uint256', false]]);
        expect((BLSAggregatorABI as any[]).some((e) => e.type === 'function' && e.name === 'GUARDIAN_FRAUD_CHALLENGE')).toBe(true);
    });
});

describe('verifyAndExecute refuses ids outside 1..2^128-1 before sending', () => {
    const args = {
        operator: '0x' + '11'.repeat(20) as `0x${string}`, slashLevel: 1, repUsers: [], newScores: [], epoch: 1n,
        evidenceHash: ('0x' + '00'.repeat(32)) as `0x${string}`, proof: '0x' as `0x${string}`,
    };
    it.each([0n, 2n ** 128n, 2n ** 255n])('%s is refused with INVALID_PARAMETER and nothing is sent', async (proposalId) => {
        const { client, calls } = mockClient(() => undefined);
        const err = await aggregatorActions(ADDR)(client).verifyAndExecute({ proposalId, ...args }).catch((e) => e);
        expect(err.code).toBe(ErrorCode.INVALID_PARAMETER);
        expect(calls).toEqual([]);
    });
    it.each([1n, 2n ** 128n - 1n])('%s is sent', async (proposalId) => {
        const { client, calls } = mockClient(() => undefined);
        await aggregatorActions(ADDR)(client).verifyAndExecute({ proposalId, ...args });
        expect(calls[0]).toMatchObject({ functionName: 'verifyAndExecute' });
        expect(calls[0].args[0]).toBe(proposalId);
    });
});
