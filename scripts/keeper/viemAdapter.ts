/**
 * Adapts a viem PublicClient to the keeper's chain interfaces.
 * State reads pin the block by hash (EIP-1898 requireCanonical). Errors stay inside the adapter.
 */
import { type Address, type Hex, type PublicClient } from 'viem';
import { explainHex } from './hex.js';
import type { ChainIO, ChainReceipt } from './sender.js';
import type { IdentityChain } from './signerGuard.js';

export interface HeadChain {
    latestHeader(): Promise<{ number: bigint; hash: Hex } | null>;
    call(tx: { to: Address; data: Hex; blockHash?: Hex }): Promise<{ ok: true; data: Hex } | { ok: false; data?: Hex; reason: string }>;
}

export function asIdentityChain(chain: HeadChain): IdentityChain {
    return {
        async call({ to, data, blockHash }) {
            const out = await chain.call({ to, data, blockHash });
            if (!out.ok) throw new Error('identity read failed');
            return out.data;
        },
    };
}

type Client = Pick<PublicClient, 'getBlock' | 'getTransactionCount' | 'getBalance' | 'estimateGas' | 'estimateMaxPriorityFeePerGas' | 'sendRawTransaction' | 'getTransactionReceipt' | 'request'>;

function atHash(hash: Hex): { blockHash: Hex; requireCanonical: true } {
    return { blockHash: hash, requireCanonical: true };
}

function hexData(value: unknown, max: number): Hex | null {
    const parsed = explainHex(value, max);
    return parsed.ok ? parsed.data : null;
}

function receiptHash(value: unknown): Hex | null {
    const parsed = explainHex(value, 66);
    if (!parsed.ok || parsed.data.length !== 66) return null;
    return parsed.data;
}

function revertDataOf(error: unknown): Hex | undefined {
    let cur: unknown = error;
    for (let i = 0; i < 5 && cur && typeof cur === 'object'; i++) {
        const data = (cur as { data?: unknown }).data;
        if (typeof data === 'string' && data.startsWith('0x') && data.length <= 8_000) return data as Hex;
        cur = (cur as { cause?: unknown }).cause;
    }
    return undefined;
}

export function adaptChainIO(client: Client, opts: { tipWei?: bigint } = {}): ChainIO {
    const fallbackTip = opts.tipWei ?? 1_000_000n;
    return {
        async getTransactionCount(addr, tag) {
            const count = await client.getTransactionCount({ address: addr, blockTag: tag });
            return typeof count === 'bigint' ? count : BigInt(count);
        },
        async getBalance(addr) {
            return client.getBalance({ address: addr });
        },
        async estimateGas(tx) {
            return client.estimateGas({ account: tx.from, to: tx.to, data: tx.data });
        },
        async fees() {
            const block = await client.getBlock({ blockTag: 'latest' });
            const baseFee = block.baseFeePerGas ?? 0n;
            let tip = fallbackTip;
            try {
                const quoted = await client.estimateMaxPriorityFeePerGas();
                if (typeof quoted === 'bigint' && quoted >= 0n) tip = quoted;
            } catch {
                tip = fallbackTip;
            }
            return { baseFee, tip };
        },
        async sendRawTransaction(raw) {
            return client.sendRawTransaction({ serializedTransaction: raw });
        },
        async getTransactionReceipt(hash): Promise<ChainReceipt | null> {
            try {
                const receipt = await client.getTransactionReceipt({ hash });
                const gasUsed = receipt.gasUsed;
                const blockHash = receipt.blockHash;
                const blockNumber = receipt.blockNumber;
                const txHash = receiptHash(receipt.transactionHash);
                if (!blockHash || !txHash || typeof gasUsed !== 'bigint' || typeof blockNumber !== 'bigint') return null;
                return {
                    status: receipt.status === 'success' ? 'success' : 'reverted',
                    gasUsed,
                    blockHash,
                    blockNumber,
                    transactionHash: txHash,
                };
            } catch {
                return null;
            }
        },
        async chainId() {
            let raw: unknown;
            try {
                raw = await client.request({ method: 'eth_chainId' });
            } catch {
                throw new Error('sender: chain id unreadable');
            }
            if (typeof raw !== 'string' || raw.length < 3 || raw.length > 66) throw new Error('sender: chain id unreadable');
            if (raw.charCodeAt(0) !== 48 || raw.charCodeAt(1) !== 120) throw new Error('sender: chain id unreadable');
            let id: bigint;
            try {
                id = BigInt(raw);
            } catch {
                throw new Error('sender: chain id unreadable');
            }
            if (id <= 0n || id > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('sender: chain id unreadable');
            return Number(id);
        },
        async getBlockByNumber(n) {
            try {
                const block = await client.getBlock({ blockNumber: n });
                if (!block.hash || typeof block.number !== 'bigint') return null;
                return { hash: block.hash, number: block.number };
            } catch {
                return null;
            }
        },
        async getBlockByHash(hash) {
            try {
                const block = await client.getBlock({ blockHash: hash });
                if (!block.hash || typeof block.number !== 'bigint') return null;
                return { hash: block.hash, number: block.number };
            } catch {
                return null;
            }
        },
        async call(tx) {
            const block = tx.blockHash ? atHash(tx.blockHash) : 'latest';
            const data = await client.request({
                method: 'eth_call',
                params: [{ to: tx.to, data: tx.data, from: tx.from }, block],
            });
            const hex = hexData(data, 200_000);
            if (!hex) throw new Error('sender: call rejected');
            return hex;
        },
    };
}

export function adaptHeadChain(client: Client): HeadChain {
    return {
        async latestHeader() {
            try {
                const block = await client.getBlock({ blockTag: 'latest' });
                if (!block.hash || typeof block.number !== 'bigint') return null;
                return { number: block.number, hash: block.hash };
            } catch {
                return null;
            }
        },
        async call(tx) {
            const block = tx.blockHash ? atHash(tx.blockHash) : 'latest';
            try {
                const data = await client.request({
                    method: 'eth_call',
                    params: [{ to: tx.to, data: tx.data }, block],
                });
                const parsed = explainHex(data, 200_000);
                if (!parsed.ok) return { ok: false as const, reason: parsed.reason };
                return { ok: true as const, data: parsed.data };
            } catch (error) {
                return { ok: false as const, data: revertDataOf(error), reason: 'unavailable' };
            }
        },
    };
}
