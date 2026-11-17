/**
 * Test-only fake chain behind a real EIP-1193 `request({ method, params })` surface.
 *
 * The checker is driven through JSON-RPC exactly as it would be against a node: eth_call calldata
 * is ABI-decoded here, answered from state, and ABI-encoded back. Nothing in the checker is mocked.
 */
import {
    decodeFunctionData,
    encodeAbiParameters,
    encodeFunctionResult,
    getAddress,
    keccak256,
    pad,
    stringToHex,
    toEventSelector,
    toHex,
    type Abi,
    type AbiEvent,
    type AbiFunction,
    type Address,
    type Hex,
} from 'viem';
import type { Eip1193Provider } from './rpc.js';

export type Handler = (args: readonly unknown[]) => unknown;
export interface FakeContract { abi: Abi; fns: Record<string, Handler> }
export interface FakeLog { address: Address; topics: Hex[]; data: Hex; blockNumber: bigint; logIndex: number; txHash?: Hex }
export interface FakeChain {
    chainId: number;
    finalized: bigint;
    /** Seed for block hashes; two providers with different seeds disagree on every hash. */
    hashSeed: string;
    /** Per-block overrides of the seeded hash. */
    hashOverrides?: Record<string, Hex>;
    contracts: Record<string, FakeContract>;
    balances: Record<string, bigint>;
    logs: FakeLog[];
}

export const blockHash = (chain: FakeChain, n: bigint): Hex =>
    chain.hashOverrides?.[n.toString()] ?? keccak256(stringToHex(`${chain.hashSeed}:${n}`));

export function reputationLog(chain: FakeChain, registry: Address, ev: AbiEvent, source: Address, active: boolean, blockNumber: bigint, logIndex: number): FakeLog {
    return {
        address: registry,
        topics: [toEventSelector(ev), pad(source.toLowerCase() as Hex, { size: 32 })],
        data: encodeAbiParameters([{ type: 'bool' }], [active]),
        blockNumber,
        logIndex,
    };
}

/** OwnershipTransferred(previousOwner indexed, newOwner indexed), as Ownable emits from initialize. */
export function ownershipLog(registry: Address, ev: AbiEvent, previousOwner: Address, newOwner: Address, blockNumber: bigint, logIndex: number): FakeLog {
    return {
        address: registry,
        topics: [toEventSelector(ev), pad(previousOwner.toLowerCase() as Hex, { size: 32 }), pad(newOwner.toLowerCase() as Hex, { size: 32 })],
        data: '0x',
        blockNumber,
        logIndex,
    };
}

export interface FakeProvider extends Eip1193Provider { calls: { method: string; params: readonly unknown[] }[] }

export function fakeProvider(chain: FakeChain): FakeProvider {
    const calls: { method: string; params: readonly unknown[] }[] = [];
    const knownHash = (h: unknown) => {
        if (typeof h !== 'string') return false;
        for (let n = 0n; n <= chain.finalized + 5n; n++) if (blockHash(chain, n) === h.toLowerCase()) return true;
        return false;
    };
    const requireBlockHash = (tag: unknown) => {
        const h = (tag as { blockHash?: unknown } | undefined)?.blockHash;
        if (!knownHash(h)) throw new Error('unknown block hash');
    };
    return {
        calls,
        async request({ method, params = [] }) {
            calls.push({ method, params });
            switch (method) {
                case 'eth_chainId':
                    return toHex(chain.chainId);
                case 'eth_getBlockByNumber': {
                    const tag = params[0];
                    const n = tag === 'finalized' ? chain.finalized : BigInt(tag as string);
                    if (n > chain.finalized + 5n) return null;
                    return { number: toHex(n), hash: blockHash(chain, n), parentHash: n > 0n ? blockHash(chain, n - 1n) : pad('0x0', { size: 32 }) };
                }
                case 'eth_getBalance': {
                    requireBlockHash(params[1]);
                    return toHex(chain.balances[(params[0] as string).toLowerCase()] ?? 0n);
                }
                case 'eth_call': {
                    requireBlockHash(params[1]);
                    const { to, data } = params[0] as { to: string; data: Hex };
                    const c = chain.contracts[to.toLowerCase()];
                    if (!c) return '0x';
                    let decoded;
                    try {
                        decoded = decodeFunctionData({ abi: c.abi, data });
                    } catch {
                        return '0x';
                    }
                    const h = c.fns[decoded.functionName];
                    if (!h) throw new Error(`execution reverted (${decoded.functionName} not stubbed)`);
                    const fn = c.abi.find((x): x is AbiFunction => x.type === 'function' && x.name === decoded.functionName)!;
                    return encodeFunctionResult({ abi: [fn], functionName: fn.name, result: h(decoded.args ?? []) } as Parameters<typeof encodeFunctionResult>[0]);
                }
                case 'eth_getLogs': {
                    const f = params[0] as { address: string; topics: Hex[]; fromBlock: Hex; toBlock: Hex };
                    const lo = BigInt(f.fromBlock);
                    const hi = BigInt(f.toBlock);
                    return chain.logs
                        .filter(l => l.address.toLowerCase() === f.address.toLowerCase() && l.topics[0] === f.topics[0] && l.blockNumber >= lo && l.blockNumber <= hi)
                        .map(l => ({
                            address: getAddress(l.address).toLowerCase(),
                            topics: l.topics,
                            data: l.data,
                            blockNumber: toHex(l.blockNumber),
                            blockHash: blockHash(chain, l.blockNumber),
                            transactionHash: l.txHash ?? keccak256(stringToHex(`tx:${l.blockNumber}:${l.logIndex}`)),
                            logIndex: toHex(l.logIndex),
                            removed: false,
                        }));
                }
                default:
                    throw new Error(`method ${method} not supported by fake`);
            }
        },
    };
}
