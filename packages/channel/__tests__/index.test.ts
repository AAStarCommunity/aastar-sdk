import { describe, it, expect } from 'vitest';
import { VOUCHER_TYPES, getVoucherDomain } from '../src/index.js';

describe('@aastar/channel', () => {
    it('should export VOUCHER_TYPES with correct structure', () => {
        expect(VOUCHER_TYPES.Voucher).toBeDefined();
        expect(VOUCHER_TYPES.Voucher).toHaveLength(2);
        expect(VOUCHER_TYPES.Voucher[0].name).toBe('channelId');
        expect(VOUCHER_TYPES.Voucher[0].type).toBe('bytes32');
        expect(VOUCHER_TYPES.Voucher[1].name).toBe('cumulativeAmount');
        expect(VOUCHER_TYPES.Voucher[1].type).toBe('uint128');
    });

    it('should generate correct EIP-712 domain', () => {
        const contractAddr = '0x5753e9675f68221cA901e495C1696e33F552ea36' as `0x${string}`;
        const domain = getVoucherDomain(11155111, contractAddr);
        expect(domain.name).toBe('MicroPaymentChannel');
        expect(domain.version).toBe('1.0.0');
        expect(domain.chainId).toBe(11155111);
        expect(domain.verifyingContract).toBe(contractAddr);
    });
});
