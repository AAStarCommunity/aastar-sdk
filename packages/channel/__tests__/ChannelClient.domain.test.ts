import { describe, it, expect, vi } from 'vitest';
import { decodeFunctionData, domainSeparator, encodeFunctionResult, keccak256, toHex, type Abi, type Address, type Hex } from 'viem';
import { GTokenAuthorizationABI, MicroPaymentChannelABI } from '@aastar/core';
import { ChannelClient } from '../src/ChannelClient.js';
import { VOUCHER_TYPEHASH } from '../src/voucher.js';

// Real values read from Sepolia (MicroPaymentChannel 0x3757…3818): eip712Domain() and VOUCHER_TYPEHASH.
const CHANNEL = '0x37578b70B231CC0Eda5991CA633ae99eb35f3818' as Address;
const CHAIN_ID = 11155111;
const ONCHAIN_TYPEHASH = '0xe97c93f01d3ef8eaba1586553df13308f236815bf4ea49c7b696895d8f5ea68a' as Hex;
const HASH = ('0x' + 'aa'.repeat(32)) as Hex;
const READ_ABI = [
    ...(GTokenAuthorizationABI as any[]).filter((e) => e.name === 'eip712Domain' || e.name === 'DOMAIN_SEPARATOR'),
    ...(MicroPaymentChannelABI as any[]).filter((e) => e.name === 'VOUCHER_TYPEHASH'),
] as Abi;
const DOMAIN = { name: 'MicroPaymentChannel', version: '1.0.0', chainId: CHAIN_ID, verifyingContract: CHANNEL };

function channel(o: { reportedChainId?: bigint; separator?: Hex; typehash?: Hex } = {}) {
    const request = vi.fn(async ({ method, params }: any) => {
        if (params[1]?.blockHash !== HASH || params[1]?.requireCanonical !== true) throw new Error(`${method} not pinned`);
        if (method === 'eth_getCode') return '0x6080';
        const { functionName } = decodeFunctionData({ abi: READ_ABI, data: params[0].data });
        if (functionName === 'VOUCHER_TYPEHASH') return encodeFunctionResult({ abi: READ_ABI, functionName, result: o.typehash ?? ONCHAIN_TYPEHASH } as any);
        if (functionName === 'eip712Domain') {
            return encodeFunctionResult({ abi: READ_ABI, functionName, result: ['0x0f', DOMAIN.name, DOMAIN.version, o.reportedChainId ?? BigInt(CHAIN_ID), CHANNEL, '0x' + '00'.repeat(32), []] } as any);
        }
        if (o.separator) return encodeFunctionResult({ abi: READ_ABI, functionName, result: o.separator } as any);
        const e: any = new Error('execution reverted'); e.code = 3; e.data = '0x'; throw e; // no DOMAIN_SEPARATOR() on this contract
    });
    const publicClient: any = {
        getChainId: vi.fn(async () => CHAIN_ID),
        getBlock: vi.fn(async () => ({ number: 1n, hash: HASH })),
        request,
        // Every read must go through the pinned request above; an unpinned readContract is a test failure.
        readContract: vi.fn(async ({ functionName }: any) => { throw new Error(`unpinned read ${functionName}`); }),
    };
    const walletClient: any = { account: { address: '0x1111111111111111111111111111111111111111' }, signTypedData: vi.fn(async () => '0xsig') };
    return { c: new ChannelClient({ publicClient, walletClient, channelAddress: CHANNEL, chainId: CHAIN_ID }), walletClient };
}

describe('ChannelClient.signVoucherOffline — domain and type from the contract', () => {
    it('the SDK voucher type is the one the deployed channel hashes (uint128)', () => {
        expect(VOUCHER_TYPEHASH).toBe(ONCHAIN_TYPEHASH);
        expect(VOUCHER_TYPEHASH).not.toBe(keccak256(toHex('Voucher(bytes32 channelId,uint256 cumulativeAmount)')));
    });

    it('signs under the domain the contract reports via eip712Domain()', async () => {
        const { c, walletClient } = channel();
        await c.signVoucherOffline(('0x' + '01'.repeat(32)) as Hex, 5n);
        expect(walletClient.signTypedData).toHaveBeenCalledWith(expect.objectContaining({ domain: DOMAIN, primaryType: 'Voucher' }));
    });

    it('a channel whose VOUCHER_TYPEHASH differs (e.g. uint256) gets no signature', async () => {
        const { c, walletClient } = channel({ typehash: keccak256(toHex('Voucher(bytes32 channelId,uint256 cumulativeAmount)')) });
        await expect(c.signVoucherOffline(('0x' + '01'.repeat(32)) as Hex, 5n)).rejects.toThrow('VOUCHER_TYPEHASH');
        expect(walletClient.signTypedData).not.toHaveBeenCalled();
    });

    it('a reported chainId other than the chain\'s, or a DOMAIN_SEPARATOR() that disagrees, gets no signature', async () => {
        for (const o of [{ reportedChainId: 1n }, { separator: ('0x' + 'ee'.repeat(32)) as Hex }]) {
            const { c, walletClient } = channel(o);
            await expect(c.signVoucherOffline(('0x' + '01'.repeat(32)) as Hex, 5n)).rejects.toThrow('refusing to sign');
            expect(walletClient.signTypedData).not.toHaveBeenCalled();
        }
    });

    it('a matching DOMAIN_SEPARATOR(), once the contract has one, is accepted', async () => {
        const { c, walletClient } = channel({ separator: domainSeparator({ domain: DOMAIN }) });
        await c.signVoucherOffline(('0x' + '01'.repeat(32)) as Hex, 5n);
        expect(walletClient.signTypedData).toHaveBeenCalled();
    });
});
