import { describe, it, expect } from 'vitest';
import { decodeFunctionData, toFunctionSelector } from 'viem';
import { BLSAggregatorABI } from '../abis/index.js';
import { encodeSetSlashPolicyAdmin, encodeSetSlashThreshold, SlashLevel } from './aggregator.js';

// The calldata these encoders produce is the inner call routed through a TimelockController
// (CC-13 batch B). If they drift from the real BLSAggregator ABI, on-chain execute() reverts —
// so decode every output back against the ABI and assert the function + args survive intact.

describe('BLSAggregator slash-policy calldata encoders (CC-13 batch B)', () => {
    it('encodeSetSlashPolicyAdmin round-trips through the real ABI', () => {
        const newAdmin = '0x568b1486BFE036e603eA11f0D03Dc47fa62c9E0e';
        const data = encodeSetSlashPolicyAdmin(newAdmin);
        expect(data.startsWith(toFunctionSelector('setSlashPolicyAdmin(address)'))).toBe(true);
        const decoded = decodeFunctionData({ abi: BLSAggregatorABI, data });
        expect(decoded.functionName).toBe('setSlashPolicyAdmin');
        expect((decoded.args as readonly unknown[])[0]).toBe(newAdmin);
    });

    it('encodeSetSlashThreshold round-trips level + threshold through the real ABI', () => {
        const data = encodeSetSlashThreshold(SlashLevel.MINOR, 3);
        expect(data.startsWith(toFunctionSelector('setSlashThreshold(uint8,uint8)'))).toBe(true);
        const decoded = decodeFunctionData({ abi: BLSAggregatorABI, data });
        expect(decoded.functionName).toBe('setSlashThreshold');
        expect((decoded.args as readonly unknown[])[0]).toBe(1); // MINOR
        expect((decoded.args as readonly unknown[])[1]).toBe(3);
    });

    it('encodeSetSlashThreshold accepts WARNING (level 0) without tripping the required-param guard', () => {
        const data = encodeSetSlashThreshold(SlashLevel.WARNING, 2);
        const decoded = decodeFunctionData({ abi: BLSAggregatorABI, data });
        expect((decoded.args as readonly unknown[])[0]).toBe(0);
        expect((decoded.args as readonly unknown[])[1]).toBe(2);
    });

    it('encodeSetSlashPolicyAdmin rejects a malformed admin address', () => {
        expect(() => encodeSetSlashPolicyAdmin('0xnot-an-address' as `0x${string}`)).toThrow();
    });
});
