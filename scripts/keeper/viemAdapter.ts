/**
 * Adapts a viem PublicClient to the keeper's chain interfaces.
 * State reads pin the block by hash (EIP-1898 requireCanonical). Errors stay inside the adapter.
 */
import { toHex, type Address, type Hex, type PublicClient } from 'viem';
import { explainHex } from './hex.js';
import type { ChainIO, ChainReceipt } from './sender.js';
import type { PauseCall, PauseChain, PauseLog } from './pauseDuty.js';
import type { IdentityChain } from './signerGuard.js';

export function asIdentityChain(chain: PauseChain): IdentityChain {
    return {
        async call({ to, data, blockHash }) {
            const out = await chain.call({ to, data, blockHash });
            if (!out.ok) throw new Error('identity read failed');
            return out.data;
        },
    };
}

const MAX_LOGS = 2_000;

type Client = Pick<PublicClient, 'getBlock' | 'getTransactionCount' | 'getBalance' | 'estimateGas' | 'estimateMaxPriorityFeePerGas' | 'sendRawTransaction' | 'getTransactionReceipt' | 'request'>;

function atHash(hash: Hex): { blockHash: Hex; requireCanonical: true } {
    return { blockHash: hash, requireCanonical: true };
}

function hexData(value: unknown, max: number): Hex | null {
    const parsed = explainHex(value, max);
    return parsed.ok ? parsed.data : null;
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

function qty(value: unknown): bigint | null {
    if (typeof value === 'bigint' && value >= 0n) return value;
    if (typeof value !== 'string' || value.length < 3 || value.length > 66) return null;
    if (value.charCodeAt(0) !== 48 || value.charCodeAt(1) !== 120) return null;
    try {
        return BigInt(value);
    } catch {
        return null;
    }
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
                if (!blockHash || typeof gasUsed !== 'bigint' || typeof blockNumber !== 'bigint') return null;
                return {
                    status: receipt.status === 'success' ? 'success' : 'reverted',
                    gasUsed,
                    blockHash,
                    blockNumber,
                    transactionHash: hash,
                };
            } catch {
                return null;
            }
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

export function adaptPauseChain(client: Client): PauseChain {
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
        async blockByNumber(n) {
            try {
                const block = await client.getBlock({ blockNumber: n });
                if (!block.hash) return null;
                return { hash: block.hash };
            } catch {
                return null;
            }
        },
        async finalizedBlock() {
            try {
                const block = await client.getBlock({ blockTag: 'finalized' });
                if (typeof block.number !== 'bigint') return null;
                return block.number;
            } catch {
                return null;
            }
        },
        async getCode(addr, blockHash) {
            try {
                const code = await client.request({ method: 'eth_getCode', params: [addr, atHash(blockHash)] });
                return explainHex(code, 200_000);
            } catch {
                return { ok: false as const, reason: 'unavailable' };
            }
        },
        async getStorageAt(addr, slot, blockHash) {
            try {
                const word = await client.request({ method: 'eth_getStorageAt', params: [addr, slot, atHash(blockHash)] });
                return explainHex(word, 66);
            } catch {
                return { ok: false as const, reason: 'unavailable' };
            }
        },
        async call(tx: PauseCall) {
            const block = tx.at === 'latest' || !tx.blockHash ? 'latest' : atHash(tx.blockHash);
            try {
                const data = await client.request({
                    method: 'eth_call',
                    params: [{ to: tx.to, data: tx.data, from: tx.from }, block],
                });
                const parsed = explainHex(data, 200_000);
                if (!parsed.ok) return { ok: false as const, reason: parsed.reason };
                return { ok: true as const, data: parsed.data };
            } catch (error) {
                return { ok: false as const, data: revertDataOf(error), reason: 'unavailable' };
            }
        },
        async getLogs(q) {
            try {
                const raw = await client.request({
                    method: 'eth_getLogs',
                    params: [{
                        address: q.address,
                        topics: [q.topic0],
                        fromBlock: toHex(q.fromBlock),
                        toBlock: toHex(q.toBlock),
                    }],
                });
                if (!Array.isArray(raw) || raw.length > MAX_LOGS) return null;
                const logs: PauseLog[] = [];
                for (const item of raw) {
                    if (!item || typeof item !== 'object') return null;
                    const row = item as { address?: unknown; topics?: unknown; blockNumber?: unknown; removed?: unknown };
                    const address = hexData(row.address, 42);
                    if (!address || !Array.isArray(row.topics) || row.topics.length > 8) return null;
                    const topics: Hex[] = [];
                    for (const topic of row.topics) {
                        const hex = hexData(topic, 66);
                        if (!hex) return null;
                        topics.push(hex);
                        if (topics.length > 4) return null;
                    }
                    const blockNumber = qty(row.blockNumber);
                    if (blockNumber === null) return null;
                    logs.push({
                        address: address as Address,
                        topics,
                        blockNumber,
                        removed: row.removed === true,
                    });
                }
                return logs;
            } catch {
                return null;
            }
        },
    };
}
