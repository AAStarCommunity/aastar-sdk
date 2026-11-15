import { describe, it, expect, beforeEach } from 'vitest';
import {
    decodeErrorResult, encodeErrorResult, encodeFunctionData, toFunctionSelector, type Hex,
} from 'viem';
import { DVT_BLS_REGISTRATION_ABI, dvtActions } from '../../src/actions/dvt';
import { aggregatorActions, type BLSG1Point, type BLSG2Point } from '../../src/actions/aggregator';
import { BLSAggregatorABI } from '../../src/abis/index';
import { ErrorCode } from '../../src/errors/index';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const DVT = '0x1111111111111111111111111111111111111111' as const;
const AGG = '0x3333333333333333333333333333333333333333' as const;
const V = '0x2222222222222222222222222222222222222222' as const;
const w32 = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const KEY: BLSG1Point = { x_a: w32(1), x_b: w32(2), y_a: w32(3), y_b: w32(4) };
const POP: BLSG2Point = {
    x_c0_a: w32(5), x_c0_b: w32(6), x_c1_a: w32(7), x_c1_b: w32(8),
    y_c0_a: w32(9), y_c0_b: w32(10), y_c1_a: w32(11), y_c1_b: w32(12),
};
const SIG = 'registerBLSPublicKey(address,(bytes32,bytes32,bytes32,bytes32),uint8,(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32))';

describe('rc.8 BLS key registration routed through DVTValidator (dev pin, SP #630)', () => {
    let w: any;
    beforeEach(() => {
        resetMocks();
        w = createMockWalletClient();
    });

    it('sends DVTValidator.registerBLSPublicKey(validator, G1, slot, G2) to the DVT address', async () => {
        w.writeContract.mockResolvedValue('0xhash');
        await expect(dvtActions(DVT)(w).registerBLSPublicKey({ validator: V, key: KEY, slot: 3, pop: POP })).resolves.toBe('0xhash');
        const call = w.writeContract.mock.calls[0][0];
        expect(call.address).toBe(DVT);
        expect(call.functionName).toBe('registerBLSPublicKey');
        expect(call.args).toEqual([V, KEY, 3, POP]);
        const data = encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args });
        expect(data.slice(0, 10)).toBe(toFunctionSelector(SIG));
        expect(data.length).toBe(10 + 64 * (1 + 4 + 1 + 8));
    });

    it('names the aggregator reverts that bubble through the DVT call', () => {
        const name = `0x${Buffer.from('slashLevel').toString('hex').padEnd(64, '0')}` as Hex;
        for (const [errorName, args] of [
            ['InvalidParameter', [name]], ['InvalidThreshold', []], ['PermissionlessRegistrationDisabled', []],
            ['UnauthorizedCaller', [V]], ['SlotOutOfRange', [9]], ['ValidatorSuspended', [V]],
        ] as const) {
            const data = encodeErrorResult({ abi: DVT_BLS_REGISTRATION_ABI, errorName, args: args as any });
            expect(decodeErrorResult({ abi: DVT_BLS_REGISTRATION_ABI, data }).errorName).toBe(errorName);
        }
        const errors = DVT_BLS_REGISTRATION_ABI.filter((item) => item.type === 'error');
        const keys = errors.map((item) => `${item.name}(${item.inputs.map((x: any) => x.type).join(',')})`);
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys).toContain('InvalidParameter(bytes32)');
        expect(keys).not.toContain('InvalidParameter(string)');
    });

    it('rejects a bad slot or a non-bytes32 field before sending', async () => {
        const send = dvtActions(DVT)(w).registerBLSPublicKey;
        for (const slot of [-1, 256, 1.5, Number.NaN]) {
            await expect(send({ validator: V, key: KEY, slot, pop: POP })).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER });
        }
        await expect(send({ validator: V, key: { ...KEY, y_b: '0x1234' }, slot: 1, pop: POP })).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER });
        await expect(send({ validator: V, key: KEY, slot: 1, pop: { ...POP, y_c1_b: undefined } as any })).rejects.toMatchObject({ code: ErrorCode.INVALID_PARAMETER });
        expect(w.writeContract).not.toHaveBeenCalled();
    });

    it('the old aggregator action throws NOT_IMPLEMENTED and sends nothing', async () => {
        const p = createMockPublicClient();
        for (const client of [w, p]) {
            await expect(aggregatorActions(AGG)(client).registerBLSPublicKey({ validator: V, publicKey: '0x1234' }))
                .rejects.toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: expect.stringMatching(/dvtActions\(dvtValidator\)\.registerBLSPublicKey/) });
        }
        expect(w.writeContract).not.toHaveBeenCalled();
        // Why it was dead even before 4.14.0: the vendored ABI takes (address, G1Point, uint8, G2Point).
        expect(() => encodeFunctionData({ abi: BLSAggregatorABI, functionName: 'registerBLSPublicKey', args: [V, '0x1234'] as any })).toThrow();
    });
});
