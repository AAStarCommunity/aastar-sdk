import { describe, it, expect, beforeEach } from 'vitest';
import {
    decodeErrorResult, encodeAbiParameters, encodeErrorResult, encodeFunctionData, keccak256, toFunctionSelector,
    zeroAddress, zeroHash, type Hex,
} from 'viem';
import { DVT_V090_ABI, dvtActions } from '../../src/actions/dvt';
import { DVTValidatorABI } from '../../src/abis/index';
import { ErrorCode } from '../../src/errors/index';
import { createMockWalletClient, resetMocks } from '../mocks/client';

const DVT = '0x1111111111111111111111111111111111111111' as const;
const OP = '0x2222222222222222222222222222222222222222' as const;
const USER = '0x4444444444444444444444444444444444444444' as const;
const CHECKER = '0x5555555555555555555555555555555555555555' as const;
// The contract's own constant, recomputed here so a test does not just echo the value the mock returns.
const TAG = keccak256(new TextEncoder().encode('SuperPaymaster.DVT.Evidence.v2'));
const CATEGORY = `0x${'0c'.repeat(32)}` as Hex;
const BODY = '0xdeadbeef' as Hex;
const EVIDENCE = encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes' }], [CATEGORY, BODY]);
const EVIDENCE_HASH = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }], [TAG, CATEGORY, keccak256(BODY)]));
const PROOF = '0x1234' as Hex;

const proposal = (o: { operator?: Hex, level?: number, executed?: boolean, exists?: boolean, evidenceHash?: Hex } = {}) =>
    [o.operator ?? zeroAddress, o.level ?? 0, 'r', o.executed ?? false, o.exists ?? true, o.evidenceHash ?? zeroHash] as const;

describe('executeSlashWithProof: one action, two DVTValidator generations (SP #635)', () => {
    let w: any;
    const reads = (p: readonly unknown[], checker: Hex = CHECKER) => {
        w.readContract.mockImplementation(async ({ functionName }: any) => {
            if (functionName === 'proposals') return p;
            if (functionName === 'checkerOf') return checker;
            if (functionName === 'TAG_EVIDENCE') return TAG;
            throw new Error(`unexpected read ${functionName}`);
        });
    };
    beforeEach(() => {
        resetMocks();
        w = createMockWalletClient();
        w.writeContract.mockResolvedValue('0xhash');
    });

    it('without evidence: the deployed 5-argument form, no read', async () => {
        await dvtActions(DVT)(w).executeSlashWithProof({ proposalId: 7n, repUsers: [USER], newScores: [5n], epoch: 3n, proof: PROOF });
        const call = w.writeContract.mock.calls[0][0];
        expect(call.abi).toBe(DVTValidatorABI);
        expect(call.args).toEqual([7n, [USER], [5n], 3n, PROOF]);
        const data = encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args });
        expect(data.slice(0, 10)).toBe(toFunctionSelector('executeWithProof(uint256,address[],uint256[],uint256,bytes)'));
        expect(w.readContract).not.toHaveBeenCalled();
    });

    it('pure reputation on 0.9.0: evidence 0x goes in before proof', async () => {
        reads(proposal());
        await dvtActions(DVT)(w).executeSlashWithProof({ proposalId: 7n, repUsers: [USER], newScores: [5n], epoch: 3n, evidence: '0x', proof: PROOF });
        const call = w.writeContract.mock.calls[0][0];
        expect(call.abi).toBe(DVT_V090_ABI);
        expect(call.args).toEqual([7n, [USER], [5n], 3n, '0x', PROOF]);
        const data = encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args });
        expect(data.slice(0, 10)).toBe(toFunctionSelector('executeWithProof(uint256,address[],uint256[],uint256,bytes,bytes)'));
    });

    it('pure reputation on 0.9.0: refuses non-empty evidence, no repUsers, or a stored non-zero hash, and sends nothing', async () => {
        const send = dvtActions(DVT)(w).executeSlashWithProof;
        const base = { proposalId: 7n, repUsers: [USER] as `0x${string}`[], newScores: [5n], epoch: 3n, evidence: '0x' as Hex, proof: PROOF };
        reads(proposal());
        await expect(send({ ...base, evidence: EVIDENCE })).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER, message: expect.stringMatching(/ReputationEvidenceNotEmpty/) });
        await expect(send({ ...base, repUsers: [], newScores: [] })).rejects.toMatchObject({ message: expect.stringMatching(/ProposalShapeMismatch/) });
        reads(proposal({ evidenceHash: EVIDENCE_HASH }));
        await expect(send(base)).rejects.toMatchObject({ message: expect.stringMatching(/ReputationEvidenceHashNotZero/) });
        expect(w.writeContract).not.toHaveBeenCalled();
    });

    it('slash shape on 0.9.0: sends when the evidence hashes to the stored commitment', async () => {
        reads(proposal({ operator: OP, level: 1, evidenceHash: EVIDENCE_HASH }));
        await dvtActions(DVT)(w).executeSlashWithProof({ proposalId: 7n, repUsers: [], newScores: [], epoch: 3n, evidence: EVIDENCE, proof: PROOF });
        expect(w.writeContract.mock.calls[0][0].args).toEqual([7n, [], [], 3n, EVIDENCE, PROOF]);
    });

    it('slash shape on 0.9.0: refuses a wrong hash, an unconfigured category, bad encoding or repUsers', async () => {
        const send = dvtActions(DVT)(w).executeSlashWithProof;
        const base = { proposalId: 7n, repUsers: [] as `0x${string}`[], newScores: [] as bigint[], epoch: 3n, evidence: EVIDENCE, proof: PROOF };
        reads(proposal({ operator: OP, level: 1, evidenceHash: `0x${'99'.repeat(32)}` }));
        await expect(send(base)).rejects.toMatchObject({ message: expect.stringMatching(/EvidenceHashMismatch/) });
        reads(proposal({ operator: OP, level: 1, evidenceHash: EVIDENCE_HASH }), zeroAddress);
        await expect(send(base)).rejects.toMatchObject({ message: expect.stringMatching(/UnknownEvidenceCategory/) });
        reads(proposal({ operator: OP, level: 1, evidenceHash: EVIDENCE_HASH }));
        await expect(send({ ...base, evidence: '0x' })).rejects.toMatchObject({ message: expect.stringMatching(/abi\.encode\(bytes32 category, bytes body\)/) });
        await expect(send({ ...base, repUsers: [USER], newScores: [5n] })).rejects.toMatchObject({ message: expect.stringMatching(/ProposalShapeMismatch/) });
        // A level-only slash (operator 0, level != 0) is slash-shaped, not reputation.
        reads(proposal({ level: 2, evidenceHash: EVIDENCE_HASH }));
        await expect(send({ ...base, repUsers: [USER], newScores: [5n], evidence: '0x' })).rejects.toMatchObject({ message: expect.stringMatching(/ProposalShapeMismatch/) });
        expect(w.writeContract).not.toHaveBeenCalled();
    });

    it('refuses a missing or executed proposal and malformed evidence hex before sending', async () => {
        const send = dvtActions(DVT)(w).executeSlashWithProof;
        const base = { proposalId: 7n, repUsers: [USER] as `0x${string}`[], newScores: [5n], epoch: 3n, evidence: '0x' as Hex, proof: PROOF };
        reads(proposal({ exists: false }));
        await expect(send(base)).rejects.toMatchObject({ message: expect.stringMatching(/ProposalDoesNotExist/) });
        reads(proposal({ executed: true }));
        await expect(send(base)).rejects.toMatchObject({ message: expect.stringMatching(/ProposalExecutedAlready/) });
        await expect(send({ ...base, evidence: '0xabc' as Hex })).rejects.toMatchObject({ message: expect.stringMatching(/hex bytes/) });
        expect(w.writeContract).not.toHaveBeenCalled();
    });

    it('names every DVTValidator-0.9.0 error', () => {
        for (const [errorName, args] of [
            ['UnknownEvidenceCategory', [CATEGORY]], ['EvidenceRejected', [CATEGORY]], ['EvidenceHashMismatch', []],
            ['MissingEvidenceHash', []], ['ReputationEvidenceHashNotZero', []], ['ReputationEvidenceNotEmpty', []],
            ['ProposalShapeMismatch', []], ['DuplicateEvidenceCategory', [CATEGORY]], ['EvidenceConfigLengthMismatch', []],
            ['ZeroEvidenceCategory', []], ['ZeroEvidenceChecker', []],
        ] as const) {
            const data = encodeErrorResult({ abi: DVT_V090_ABI, errorName, args: args as any });
            expect(decodeErrorResult({ abi: DVT_V090_ABI, data }).errorName).toBe(errorName);
        }
    });

    it('carries the new event and category getters', () => {
        expect(DVT_V090_ABI.some((i: any) => i.type === 'event' && i.name === 'ValidatorAdded')).toBe(true);
        for (const name of ['TAG_EVIDENCE', 'checkerOf', 'categoryCount', 'categoryAt']) {
            expect(DVT_V090_ABI.some((i: any) => i.type === 'function' && i.name === name), name).toBe(true);
        }
    });
});
