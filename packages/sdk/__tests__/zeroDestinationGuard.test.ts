import { describe, it, expect, vi } from 'vitest';
import { custom, parseTransaction, zeroAddress, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import { ZeroAddressDestinationError } from '@aastar/core';
import { createOperatorClient, createAdminClient, createEndUserClient, createCommunityClient } from '../src/index.js';

// anvil's public default mnemonic: a throwaway local signer, never funded anywhere.
const MNEMONIC = 'test test test test test test test test test test test junk';

/** A transport that answers the reads a local-account send needs and records every method it is asked for. */
function recording() {
    const methods: string[] = [];
    const raw: string[] = [];
    const transport = custom({
        async request({ method, params }: { method: string; params?: any[] }) {
            methods.push(method);
            if (method === 'eth_sendRawTransaction' || method === 'eth_sendRawTransactionSync') raw.push(params![0]);
            switch (method) {
                case 'eth_chainId': return '0x' + sepolia.id.toString(16);
                case 'eth_getTransactionCount': return '0x0';
                case 'eth_estimateGas': return '0x5208';
                case 'eth_maxPriorityFeePerGas': return '0x1';
                case 'eth_gasPrice': return '0x1';
                case 'eth_getBlockByNumber': return { baseFeePerGas: '0x1', number: '0x1', hash: '0x' + '11'.repeat(32), timestamp: '0x1' };
                case 'eth_sendRawTransaction': return '0x' + '22'.repeat(32);
                case 'eth_sendRawTransactionSync': return { transactionHash: '0x' + '22'.repeat(32), status: '0x1', blockNumber: '0x1', blockHash: '0x' + '11'.repeat(32), logs: [], cumulativeGasUsed: '0x1', gasUsed: '0x1', effectiveGasPrice: '0x1', from: '0x' + '00'.repeat(20), to: null, transactionIndex: '0x0', type: '0x2', logsBloom: '0x' + '00'.repeat(256), contractAddress: null };
                default: throw new Error(`unexpected ${method}`);
            }
        },
    });
    return { methods, transport, raw };
}

const SENDS = ['eth_sendRawTransaction', 'eth_sendRawTransactionSync', 'eth_sendTransaction', 'eth_signTransaction', 'wallet_sendCalls'];

describe('client writes to a zero-address book entry are refused before signing (Codex r3 H1 on sepolia-rc8)', () => {
    it('OperatorClient.addDeposit with value, paymasterV4 declared absent (zero): ZeroAddressDestinationError, nothing signed or sent', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const sign = vi.spyOn(account, 'signTransaction');
        const client = createOperatorClient({ chain: sepolia, transport, account, addresses: { paymasterV4: zeroAddress } as Record<string, Address> });
        // The action wraps it (AAStarError), keeping the named error as its cause.
        const err: any = await (client as any).addDeposit({ value: 10n ** 18n, account }).catch((e: unknown) => e);
        expect(err instanceof ZeroAddressDestinationError || err?.cause instanceof ZeroAddressDestinationError).toBe(true);
        expect(sign).not.toHaveBeenCalled();
        expect(methods.filter((m) => SENDS.includes(m))).toEqual([]);
    });

    it('the same call to a deployed address goes through to the signer and the node (the guard is not a blanket refusal)', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client = createOperatorClient({ chain: sepolia, transport, account, addresses: { paymasterV4: '0x4444444444444444444444444444444444444444' } as Record<string, Address> });
        await (client as any).addDeposit({ value: 1n, account }).catch(() => undefined);
        expect(methods).toContain('eth_sendRawTransaction');
    });

    it.each([
        ['operator', createOperatorClient],
        ['admin', createAdminClient],
        ['endUser', createEndUserClient],
        ['community', createCommunityClient],
    ] as const)('%s client: writeContract / sendTransaction to address zero are refused', async (_n, make) => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client = (make as any)({ chain: sepolia, transport, account });
        await expect(client.writeContract({ address: zeroAddress, abi: [{ type: 'function', name: 'f', inputs: [], outputs: [], stateMutability: 'payable' }], functionName: 'f', value: 1n, account, chain: sepolia }))
            .rejects.toThrow(ZeroAddressDestinationError);
        await expect(client.sendTransaction({ to: zeroAddress, value: 1n, account, chain: sepolia })).rejects.toThrow(ZeroAddressDestinationError);
        expect(methods.filter((m) => SENDS.includes(m))).toEqual([]);
    });
});

describe('the inner call target and the admin DVT / BLS bindings (Codex r4 H2 / M4)', () => {
    it('EndUserClient.executeGasless with target = address zero: refused before the account is touched or anything signed', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const signMsg = vi.spyOn(account, 'signMessage');
        const client = createEndUserClient({ chain: sepolia, transport, account });
        await expect((client as any).executeGasless({ target: zeroAddress, data: '0x', value: 1n, operator: '0x4444444444444444444444444444444444444444' }))
            .rejects.toThrow(ZeroAddressDestinationError);
        expect(signMsg).not.toHaveBeenCalled();
        expect(methods).toEqual([]); // not even a read: the check is first
    });

    it('AdminClient binds dvtActions to the resolved dvtValidator (not a placeholder): the write goes to the selected pin', async () => {
        const { transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const dvt = '0x5555555555555555555555555555555555555555' as Address;
        const client: any = createAdminClient({ chain: sepolia, transport, account, addresses: { dvtValidator: dvt, blsAggregator: '0x6666666666666666666666666666666666666666' } as Record<string, Address> });
        const sent: string[] = [];
        const orig = client.writeContract;
        client.writeContract = (args: any) => { sent.push(args.address); return orig(args); };
        const err: any = await client.addValidator({ v: '0x7777777777777777777777777777777777777777', account }).catch((e: unknown) => e);
        expect(sent).toEqual([dvt]);
        expect(err instanceof ZeroAddressDestinationError || err?.cause instanceof ZeroAddressDestinationError).toBe(false);
    });
});

describe('batch and account-execution paths (Codex r6 M3 / H4)', () => {
    it('sendCalls with a zero destination: refused before any wallet request', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client: any = createOperatorClient({ chain: sepolia, transport, account });
        await expect(client.sendCalls({ account, chain: sepolia, calls: [{ to: '0x1111111111111111111111111111111111111111', value: 0n }, { to: zeroAddress, value: 1n }] }))
            .rejects.toThrow(ZeroAddressDestinationError);
        expect(methods).toEqual([]);
    });

    it('account execute / executeBatch with a zero inner target: refused before signing (the outer call goes to the account)', async () => {
        const { accountActions } = await import('@aastar/core');
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client: any = createEndUserClient({ chain: sepolia, transport, account });
        const acct = accountActions('0x1111111111111111111111111111111111111111')(client);
        const named = (e: any) => e instanceof ZeroAddressDestinationError || e?.cause instanceof ZeroAddressDestinationError;
        expect(named(await acct.execute({ dest: zeroAddress, value: 1n, func: '0x', account }).catch((e: unknown) => e))).toBe(true);
        expect(named(await acct.executeBatch({ dest: ['0x2222222222222222222222222222222222222222', zeroAddress], value: [0n, 1n], func: ['0x', '0x'], account }).catch((e: unknown) => e))).toBe(true);
        expect(methods.filter((m) => SENDS.includes(m))).toEqual([]);
    });
});

describe('the Sync variants and signTransaction are guarded too (clestons #465 follow-up 1)', () => {
    const payable = [{ type: 'function', name: 'f', inputs: [], outputs: [], stateMutability: 'payable' }] as const;
    it.each([
        ['operator', createOperatorClient],
        ['admin', createAdminClient],
        ['endUser', createEndUserClient],
        ['community', createCommunityClient],
    ] as const)('%s client: writeContractSync / sendTransactionSync / sendCallsSync / signTransaction to address zero: refused, nothing signed or sent', async (_n, make) => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const sign = vi.spyOn(account, 'signTransaction');
        const client = (make as any)({ chain: sepolia, transport, account });
        await expect(client.writeContractSync({ address: zeroAddress, abi: payable, functionName: 'f', value: 1n, account, chain: sepolia })).rejects.toThrow(ZeroAddressDestinationError);
        await expect(client.sendTransactionSync({ to: zeroAddress, value: 1n, account, chain: sepolia })).rejects.toThrow(ZeroAddressDestinationError);
        await expect(client.sendCallsSync({ account, chain: sepolia, calls: [{ to: zeroAddress, value: 1n }] })).rejects.toThrow(ZeroAddressDestinationError);
        await expect(client.signTransaction({ to: zeroAddress, value: 1n, account, chain: sepolia })).rejects.toThrow(ZeroAddressDestinationError);
        expect(sign).not.toHaveBeenCalled();
        expect(methods.filter((m) => SENDS.includes(m))).toEqual([]);
    });
});

describe('Codex r1 on the guard: conflicting destinations, deployments, request building, positive controls', () => {
    const payable = [{ type: 'function', name: 'f', inputs: [], outputs: [], stateMutability: 'payable' }] as const;
    const NONZERO = '0x1111111111111111111111111111111111111111' as Address;
    const named = (e: any) => e instanceof ZeroAddressDestinationError || e?.cause instanceof ZeroAddressDestinationError;

    it('writeContract / writeContractSync with a non-zero address but a `to` field: refused, nothing sent (viem would send to `to`)', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client: any = createOperatorClient({ chain: sepolia, transport, account });
        for (const m of ['writeContract', 'writeContractSync']) {
            expect(named(await client[m]({ address: NONZERO, to: zeroAddress, abi: payable, functionName: 'f', value: 1n, account, chain: sepolia }).catch((e: unknown) => e)), m).toBe(true);
        }
        expect(methods.filter((x) => SENDS.includes(x))).toEqual([]);
    });

    it('deployContract carrying a `to`: refused, nothing sent (viem spreads it into a direct send)', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client: any = createOperatorClient({ chain: sepolia, transport, account });
        expect(named(await client.deployContract({ abi: [], bytecode: '0x00', to: zeroAddress, value: 1n, account, chain: sepolia }).catch((e: unknown) => e))).toBe(true);
        expect(methods.filter((x) => SENDS.includes(x))).toEqual([]);
    });

    it('prepareTransactionRequest / fillTransaction to address zero: refused before anything is built', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client: any = createOperatorClient({ chain: sepolia, transport, account });
        expect(named(await client.prepareTransactionRequest({ to: zeroAddress, value: 1n, account, chain: sepolia }).catch((e: unknown) => e))).toBe(true);
        expect(named(await client.fillTransaction({ to: zeroAddress, value: 1n, account, chain: sepolia }).catch((e: unknown) => e))).toBe(true);
        expect(methods).toEqual([]);
    });

    it('positive controls: each newly guarded action with a non-zero destination goes past the guard to the signer / node', async () => {
        const account = mnemonicToAccount(MNEMONIC);
        const run = async (fn: (c: any) => Promise<unknown>) => {
            const { methods, transport } = recording();
            const sign = vi.spyOn(account, 'signTransaction');
            const c: any = createOperatorClient({ chain: sepolia, transport, account });
            const err = await fn(c).then(() => undefined, (e) => e);
            const r = { named: named(err), signed: sign.mock.calls.length, methods };
            sign.mockRestore();
            return r;
        };
        const wcs = await run((c) => c.writeContractSync({ address: NONZERO, abi: payable, functionName: 'f', value: 1n, account, chain: sepolia }));
        expect(wcs.named).toBe(false); expect(wcs.signed).toBe(1); expect(wcs.methods).toContain('eth_sendRawTransactionSync');
        const sts = await run((c) => c.sendTransactionSync({ to: NONZERO, value: 1n, account, chain: sepolia }));
        expect(sts.named).toBe(false); expect(sts.signed).toBe(1); expect(sts.methods).toContain('eth_sendRawTransactionSync');
        const st = await run((c) => c.signTransaction({ to: NONZERO, value: 1n, gas: 21_000n, maxFeePerGas: 2n, maxPriorityFeePerGas: 1n, nonce: 0, account, chain: sepolia }));
        expect(st.named).toBe(false); expect(st.signed).toBe(1);
        const ptr = await run((c) => c.prepareTransactionRequest({ to: NONZERO, value: 1n, account, chain: sepolia }));
        expect(ptr.named).toBe(false); expect(ptr.methods).toContain('eth_estimateGas');
    });
});

describe('Codex r2 on the guard: check-then-use and raw sends', () => {
    const NONZERO = '0x1111111111111111111111111111111111111111' as Address;
    const named = (e: any) => e instanceof ZeroAddressDestinationError || e?.cause instanceof ZeroAddressDestinationError;

    it('a getter that answers non-zero when checked and zero when used cannot slip through: the checked copy is what viem gets', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const sign = vi.spyOn(account, 'signTransaction');
        const client: any = createOperatorClient({ chain: sepolia, transport, account });
        let reads = 0;
        const req: any = { account, chain: sepolia, value: 1n, get to() { return ++reads === 1 ? NONZERO : zeroAddress; } };
        await client.sendTransaction(req);
        // Signed exactly once, to the address that was checked, never to zero.
        expect(sign).toHaveBeenCalledTimes(1);
        expect((sign.mock.calls[0][0] as any).to?.toLowerCase()).toBe(NONZERO.toLowerCase());
        expect(reads).toBe(1);
        let callReads = 0;
        const batch: any = { account, chain: sepolia, calls: [{ value: 1n, get to() { return ++callReads === 1 ? NONZERO : zeroAddress; } }] };
        await client.sendCalls(batch).catch(() => undefined);
        expect(callReads).toBe(1);
        expect(methods.filter((m) => m === 'eth_sendRawTransaction').length).toBeLessThanOrEqual(2);
    });

    it('sendRawTransaction / sendRawTransactionSync of bytes signed elsewhere to address zero: refused before the node is asked', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client: any = createOperatorClient({ chain: sepolia, transport, account });
        const toZero = await account.signTransaction({ to: zeroAddress, value: 1n, gas: 21_000n, maxFeePerGas: 2n, maxPriorityFeePerGas: 1n, nonce: 0, chainId: sepolia.id, type: 'eip1559' });
        for (const m of ['sendRawTransaction', 'sendRawTransactionSync']) {
            expect(named(await client[m]({ serializedTransaction: toZero }).catch((e: unknown) => e)), m).toBe(true);
        }
        expect(methods.filter((x) => SENDS.includes(x))).toEqual([]);
        // Positive control: the same bytes to a non-zero address reach the node.
        const toOther = await account.signTransaction({ to: NONZERO, value: 1n, gas: 21_000n, maxFeePerGas: 2n, maxPriorityFeePerGas: 1n, nonce: 0, chainId: sepolia.id, type: 'eip1559' });
        await client.sendRawTransaction({ serializedTransaction: toOther });
        expect(methods).toContain('eth_sendRawTransaction');
    });
});

describe('clestons #466: only plain-object requests; a missing address is refused', () => {
    const payable = [{ type: 'function', name: 'f', inputs: [], outputs: [], stateMutability: 'payable' }] as const;
    const NONZERO = '0x1111111111111111111111111111111111111111' as Address;
    const named = (e: any) => e instanceof ZeroAddressDestinationError || e?.cause instanceof ZeroAddressDestinationError;
    class ConstTo { value = 7n; constructor(private readonly dest: Address) {} get to() { return this.dest; } }
    class ConstAddress { abi = payable; functionName = 'f' as const; value = 7n; constructor(private readonly dest: Address) {} get address() { return this.dest; } }

    it.each([['zero', zeroAddress], ['non-zero', NONZERO]] as const)('Object.create / class-instance requests (%s destination): refused, nothing signed or sent', async (_l, dest) => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const sign = vi.spyOn(account, 'signTransaction');
        const client: any = createOperatorClient({ chain: sepolia, transport, account });
        const withCtx = (o: any) => Object.assign(o, { account, chain: sepolia });
        expect(named(await client.sendTransaction(withCtx(Object.create({ to: dest, value: 7n }))).catch((e: unknown) => e))).toBe(true);
        expect(named(await client.sendTransaction(withCtx(new ConstTo(dest))).catch((e: unknown) => e))).toBe(true);
        expect(named(await client.writeContract(withCtx(new ConstAddress(dest))).catch((e: unknown) => e))).toBe(true);
        expect(named(await client.writeContract(withCtx(Object.create({ address: dest, abi: payable, functionName: 'f', value: 7n }))).catch((e: unknown) => e))).toBe(true);
        expect(named(await client.sendCalls({ account, chain: sepolia, calls: [Object.create({ to: dest, value: 7n })] }).catch((e: unknown) => e))).toBe(true);
        expect(sign).not.toHaveBeenCalled();
        expect(methods.filter((m) => SENDS.includes(m))).toEqual([]);
    });

    it('a contract write with no address (a missing book key) is refused instead of becoming a contract creation', async () => {
        const { methods, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client: any = createOperatorClient({ chain: sepolia, transport, account });
        expect(named(await client.writeContract({ address: undefined, abi: payable, functionName: 'f', value: 1n, account, chain: sepolia }).catch((e: unknown) => e))).toBe(true);
        expect(methods.filter((m) => SENDS.includes(m))).toEqual([]);
    });

    it('a plain-object batch is forwarded with exactly the checked destinations', async () => {
        const { raw, transport } = recording();
        const account = mnemonicToAccount(MNEMONIC);
        const client: any = createOperatorClient({ chain: sepolia, transport, account });
        await client.sendCalls({ account, chain: sepolia, calls: [{ to: NONZERO, value: 1n }], experimental_fallback: true });
        expect(raw.map((r) => parseTransaction(r as any).to?.toLowerCase())).toEqual([NONZERO.toLowerCase()]);
    });
});
