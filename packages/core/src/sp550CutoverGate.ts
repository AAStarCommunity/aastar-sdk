/**
 * SuperPaymaster 5.5.0 cutover gate (read-only): the logic behind scripts/check-sp550-cutover.ts,
 * kept here so it runs against injected clients in tests. Not exported from the package index.
 *
 * Order of operations, each step refusing before the next one reads anything:
 *  1. usage: a known --network, at least one RPC, two DISTINCT RPC endpoints for a fresh deploy;
 *  2. chain identity: every RPC's chainId must be the network's;
 *  3. snapshot: one block number (default: the lowest FINALIZED block across the RPCs), and with
 *     two RPCs a well-formed, identical block hash on both;
 *  4. pins: complete and well-formed for the network's mode, and no release hold;
 *  5. every state read (SP version, impl slot, wiring, code) is taken on EVERY RPC at the
 *     snapshot block. A disagreement between RPCs is a Diverge object, not a value: it is never
 *     equal to anything (not even another Diverge), so it fails every check it feeds;
 *  6. every pinned address (top-level and address book) has the same non-empty code on every RPC.
 * Exit 2 = refused before reading state; 1 = read, something failed; 0 = every check passed.
 */
import { getAddress, keccak256, toHex, type Address, type PublicClient } from 'viem';
import { APNTsCappedABI, SuperPaymasterLensABI, SuperPaymasterV550ABI, xPNTsFactoryV2ABI, xPNTsTokenV2ABI } from './abis/index.js';
import { CANONICAL_ADDRESSES } from './addresses.js';
import { SP550_CUTOVER_PINS, sp550PinProblems } from './sp550Cutover.js';
import {
    SP550_FRESH_DEPLOY_PINS, SP550_RELEASE_HOLDS, assertSp550ChainId, resolveSp550Network, sp550FreshPinProblems,
    type Sp550FreshDeployPins,
} from './sp550Deployments.js';

const ERC1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const;
const EXPECTED_VERSION = 'SuperPaymaster-5.5.0';

export type GateClient = Pick<PublicClient, 'getChainId' | 'getBlockNumber' | 'getBlock' | 'readContract' | 'getStorageAt' | 'getCode'>;
export interface GateRpc { label: string; url: string; client: GateClient }
export interface GateInput {
    network: string | undefined;
    rpcs: GateRpc[];
    /** Pins to check; default: the network's table entry. */
    pins?: Sp550FreshDeployPins;
    pinsSource?: string;
    /** Snapshot block: a number, or the lowest 'finalized' (default) / 'latest' block across the RPCs. */
    block?: bigint | 'finalized' | 'latest';
    allowRc?: boolean;
}
export interface GateCheck { check: string; ok: boolean; detail: string }
export interface GateResult { exitCode: 0 | 1 | 2; error?: string; header?: string; results: GateCheck[] }

/** Normalised endpoint identity: scheme + lower-cased host + non-default port + path without trailing slash + query. */
export function rpcEndpointKey(url: string): string {
    const u = new URL(url);
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`;
}

/** RPCs disagreed on a read. Deliberately not a string: every comparison below requires strings. */
class Diverge {
    constructor(readonly detail: string) {}
}

const str = (v: unknown): string => (v instanceof Diverge ? v.detail : typeof v === 'bigint' ? v.toString() : typeof v === 'string' ? v : JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)));
const eq = (a?: unknown, b?: unknown) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const HASH = /^0x[0-9a-fA-F]{64}$/;

export async function runSp550CutoverGate(input: GateInput): Promise<GateResult> {
    const results: GateCheck[] = [];
    const refuse = (error: string): GateResult => ({ exitCode: 2, error, results });

    // 1. Usage.
    let net: ReturnType<typeof resolveSp550Network>;
    try { net = resolveSp550Network(input.network); } catch (e: any) { return refuse(e.message); }
    const rpcs = input.rpcs;
    if (rpcs.length === 0) return refuse('--rpc is required');
    if (net.mode === 'fresh' && rpcs.length < 2) return refuse(`--network ${net.network} is a fresh deploy: its read-back needs two RPCs (--rpc2)`);
    let keys: string[];
    try { keys = rpcs.map((r) => rpcEndpointKey(r.url)); } catch (e: any) { return refuse(`malformed RPC URL: ${e.message}`); }
    if (new Set(keys).size !== keys.length) return refuse('--rpc and --rpc2 are the same endpoint; a two-RPC read-back needs two independent endpoints');

    // 2. Chain identity, before any other read.
    for (const r of rpcs) {
        try { assertSp550ChainId(net.network, await r.client.getChainId()); } catch (e: any) { return refuse(`${r.label}: ${e.message}`); }
    }
    const record = (check: string, ok: boolean, detail: string) => results.push({ check, ok, detail });

    // 3. One snapshot block, identical on every RPC. State reads below can only name the block by
    //    NUMBER (eth_call / getCode / getStorageAt in viem take no block hash), so the hash each RPC
    //    served is taken again after the last read (finish()): a reorg that is still in place when
    //    the reads end fails the gate. Known limit: a fork that goes A -> B -> A between the two
    //    hash reads is invisible (equal hashes). Reads are not hash-bound, so the default snapshot
    //    is the lowest FINALIZED block across the RPCs, where that window cannot open. 'latest' is
    //    for a local fork (whose finalized block predates the rehearsed upgrade), not a read-back.
    const at = input.block ?? 'finalized';
    let blockNumber: bigint;
    if (typeof at === 'bigint') blockNumber = at;
    else {
        let tips: unknown[];
        try {
            tips = at === 'latest'
                ? await Promise.all(rpcs.map((r) => r.client.getBlockNumber()))
                : (await Promise.all(rpcs.map((r) => r.client.getBlock({ blockTag: 'finalized' })))).map((b) => b?.number);
        } catch (e: any) { return refuse(`could not read the ${at} block (${e.shortMessage ?? e.message}); pass --block <n>`); }
        const bad = tips.findIndex((n) => typeof n !== 'bigint');
        if (bad >= 0) return refuse(`${rpcs[bad].label} served no ${at} block number; pass --block <n>`);
        blockNumber = (tips as bigint[]).reduce((a, b) => (a < b ? a : b));
    }
    const snapshotHashes = async () => (await Promise.all(rpcs.map((r) => r.client.getBlock({ blockNumber })))).map((b) =>
        typeof b.hash === 'string' && HASH.test(b.hash) && b.number === blockNumber ? b.hash : undefined);
    const before = await snapshotHashes();
    record(rpcs.length > 1 ? 'every RPC serves the same block at the snapshot' : 'the RPC serves a well-formed snapshot block',
        before.every((h) => h !== undefined && h === before[0]),
        before.map((h, i) => `${rpcs[i].label} #${blockNumber} ${h ?? 'malformed or other block'}`).join(' · '));

    // 4. Pins for the network's mode, and holds.
    const chainId = net.chainId;
    const table = net.mode === 'fresh' ? 'SP550_FRESH_DEPLOY_PINS' : 'SP550_CUTOVER_PINS';
    const pins: Sp550FreshDeployPins = input.pins ?? (net.mode === 'fresh' ? SP550_FRESH_DEPLOY_PINS : SP550_CUTOVER_PINS)[chainId] ?? {};
    const header = `=== SP 5.5.0 cutover gate — ${net.network} (chain ${chainId}, ${net.mode}), all reads at block ${blockNumber}${typeof at === 'bigint' ? '' : ` (lowest ${at})`}, pins from ${input.pinsSource ?? `${table}[${chainId}]`} ===`;
    const problems = net.mode === 'fresh' ? sp550FreshPinProblems(pins, { allowRc: input.allowRc }) : sp550PinProblems(pins, { allowRc: input.allowRc });
    record('pins complete and well-formed', problems.length === 0, problems.length ? problems.join('; ') : 'ok');
    const hold = SP550_RELEASE_HOLDS[chainId];
    if (hold) record('no release hold on this chain', false, hold);

    // 5. State reads on every RPC; a disagreement is returned as a Diverge object, which fails any comparison.
    const agree = (vals: unknown[]): unknown =>
        vals.every((v) => str(v) === str(vals[0])) ? vals[0] : new Diverge(`DIVERGE ${vals.map((v, i) => `${rpcs[i].label}=${str(v)}`).join(' ')}`);
    const read = async (address: Address | undefined, abi: any, functionName: string): Promise<any> => {
        if (!address) return '(unpinned address)';
        return agree(await Promise.all(rpcs.map((r) =>
            r.client.readContract({ address, abi, functionName, blockNumber } as any).catch((e: any) => `ERR ${e?.shortMessage ?? e?.message}`))));
    };
    const codeHash = async (address?: Address): Promise<unknown> => {
        if (!address) return undefined;
        return agree(await Promise.all(rpcs.map(async (r) => {
            const code = await r.client.getCode({ address, blockNumber });
            return code && code !== '0x' ? keccak256(code) : undefined;
        })));
    };
    const cmp = (check: string, observed: unknown, expected: unknown, what = 'pinned') =>
        record(check, eq(observed, expected), `observed ${str(observed)} · ${what} ${expected === undefined ? '(unpinned)' : str(expected)}`);

    // Unpinned proxy: still READ the canonical one, so the report shows what the chain holds.
    const canonical = (CANONICAL_ADDRESSES as Record<number, any>)[chainId] ?? {};
    const sp = (pins.superPaymaster ?? canonical.superPaymaster) as Address | undefined;
    if (!pins.superPaymaster) record('pins.superPaymaster', false, `(unpinned) — reading canonical ${sp ?? 'none'}`);
    if (!sp) return await finish();

    // 5a. What is behind the proxy.
    const version = await read(sp, SuperPaymasterV550ABI, 'version');
    record(`SP.version() == "${EXPECTED_VERSION}"`, version === EXPECTED_VERSION, str(version));
    const slot = agree(await Promise.all(rpcs.map((r) => r.client.getStorageAt({ address: sp, slot: ERC1967_IMPL_SLOT, blockNumber }))));
    const impl = typeof slot === 'string' && /^0x0{24}[0-9a-fA-F]{40}$/.test(slot) ? getAddress(('0x' + slot.slice(-40)) as Address) : undefined;
    cmp('ERC-1967 impl == pins.spImpl', impl ?? `malformed slot ${str(slot)}`, pins.spImpl);
    cmp('keccak256(code(impl)) == pins.spImplCodehash', await codeHash(impl), pins.spImplCodehash);

    // 5b. SP's own 5.5.0 wiring.
    cmp('SP.APNTS_TOKEN() == pins.aPNTsCapped', await read(sp, SuperPaymasterV550ABI, 'APNTS_TOKEN'), pins.aPNTsCapped);
    cmp('SP.xpntsFactory() == pins.xPNTsFactoryV2', await read(sp, SuperPaymasterV550ABI, 'xpntsFactory'), pins.xPNTsFactoryV2);
    const apntsVersion = await read(pins.aPNTsCapped, APNTsCappedABI, 'version');
    record('aPNTsCapped.version() is APNTsCapped-*', typeof apntsVersion === 'string' && apntsVersion.startsWith('APNTsCapped-'), str(apntsVersion));

    // 5c. The xPNTs v2 stack points at the pinned pieces (an unrelated contract with code fails here).
    const f = pins.xPNTsFactoryV2;
    cmp('factory.SUPERPAYMASTER() == pins.superPaymaster', await read(f, xPNTsFactoryV2ABI, 'SUPERPAYMASTER'), pins.superPaymaster);
    cmp('factory.implementation() == pins.xPNTsTokenV2Impl', await read(f, xPNTsFactoryV2ABI, 'implementation'), pins.xPNTsTokenV2Impl);
    cmp('factory.defaultTierSource() == pins.globalTierSource', await read(f, xPNTsFactoryV2ABI, 'defaultTierSource'), pins.globalTierSource);
    cmp('factory.implementationCodehash() == keccak256(code(xPNTsTokenV2Impl))', await read(f, xPNTsFactoryV2ABI, 'implementationCodehash'), await codeHash(pins.xPNTsTokenV2Impl));
    cmp('factory.extensionCodehash() == keccak256(code(xPNTsTokenV2Ext))', await read(f, xPNTsFactoryV2ABI, 'extensionCodehash'), await codeHash(pins.xPNTsTokenV2Ext));
    const ti = pins.xPNTsTokenV2Impl;
    cmp('tokenImpl.EXTENSION() == pins.xPNTsTokenV2Ext', await read(ti, xPNTsTokenV2ABI, 'EXTENSION'), pins.xPNTsTokenV2Ext);
    cmp('tokenImpl.PROTOCOL_REGISTRY() == pins.aoaProtocolRegistry', await read(ti, xPNTsTokenV2ABI, 'PROTOCOL_REGISTRY'), pins.aoaProtocolRegistry);
    // NOT tokenImpl.FACTORY(): FACTORY is storage written by initialize() on each CLONE
    // (xPNTsTokenV2.sol:74); the implementation disables initializers (:44), so on the impl it is 0.
    // EXTENSION and PROTOCOL_REGISTRY above are immutables (:26, xPNTsV2Base.sol:53), set on the impl.

    // 5d. The Lens is the 5.5.0 one.
    const lensVersion = await read(pins.superPaymasterLens, SuperPaymasterLensABI, 'EXPECTED_SP_VERSION');
    record('Lens.EXPECTED_SP_VERSION() == keccak256("SuperPaymaster-5.5.0")', eq(lensVersion, keccak256(toHex(EXPECTED_VERSION))), str(lensVersion));

    // 5e. Fresh deploy: the SP-owned address book is the one SP is wired to, and every pinned address is code.
    if (net.mode === 'fresh') {
        const book = pins.addresses ?? {};
        cmp('SP.REGISTRY() == addresses.registry', await read(sp, SuperPaymasterV550ABI, 'REGISTRY'), book.registry);
        cmp('SP.BLS_AGGREGATOR() == addresses.blsAggregator', await read(sp, SuperPaymasterV550ABI, 'BLS_AGGREGATOR'), book.blsAggregator);
        cmp('SP.agentIdentityRegistry() == addresses.agentIdentityRegistry', await read(sp, SuperPaymasterV550ABI, 'agentIdentityRegistry'), book.agentIdentityRegistry);
        cmp('SP.agentReputationRegistry() == addresses.agentReputationRegistry', await read(sp, SuperPaymasterV550ABI, 'agentReputationRegistry'), book.agentReputationRegistry);
        cmp('addresses.aPNTs == pins.aPNTsCapped', book.aPNTs, pins.aPNTsCapped);
        // External entries are not SP's deploy: compare SP's wiring with the SDK book, not with pins.
        cmp('SP.entryPoint() == SDK book entryPoint', await read(sp, SuperPaymasterV550ABI, 'entryPoint'), canonical.entryPoint, 'SDK book');
        cmp('SP.ETH_USD_PRICE_FEED() == SDK book priceFeed', await read(sp, SuperPaymasterV550ABI, 'ETH_USD_PRICE_FEED'), canonical.priceFeed, 'SDK book');
    }

    // 5f. Every pinned address, top-level and address book, is real code and the same code on every RPC.
    const pinnedAddresses: Record<string, unknown> = {
        superPaymaster: pins.superPaymaster, spImpl: pins.spImpl, superPaymasterLens: pins.superPaymasterLens,
        xPNTsFactoryV2: pins.xPNTsFactoryV2, xPNTsTokenV2Impl: pins.xPNTsTokenV2Impl, xPNTsTokenV2Ext: pins.xPNTsTokenV2Ext,
        aoaProtocolRegistry: pins.aoaProtocolRegistry, globalTierSource: pins.globalTierSource, aPNTsCapped: pins.aPNTsCapped,
        ...Object.fromEntries(Object.entries(pins.addresses ?? {}).map(([k, a]) => [`addresses.${k}`, a])),
    };
    for (const [k, a] of Object.entries(pinnedAddresses)) {
        if (typeof a !== 'string') continue; // unpinned: already a failure in 'pins complete and well-formed'
        const h = await codeHash(a as Address);
        record(`${k} has the same non-empty code on every RPC`, typeof h === 'string' && HASH.test(h), `${a} · ${h === undefined ? 'no code' : str(h)}`);
    }

    // 6. The readback the pins came from is not in the future of this snapshot.
    record('pins.readbackBlock <= snapshot block', pins.readbackBlock !== undefined && pins.readbackBlock <= blockNumber, `${pins.readbackBlock ?? '(unpinned)'} · snapshot ${blockNumber}`);
    return await finish();

    async function finish(): Promise<GateResult> {
        const after = await snapshotHashes();
        record('the snapshot block did not change during the reads (no reorg)', after.every((h, i) => h !== undefined && h === before[i]),
            after.map((h, i) => `${rpcs[i].label} ${before[i] ?? '?'} -> ${h ?? 'malformed or other block'}`).join(' · '));
        return { exitCode: results.every((r) => r.ok) ? 0 : 1, header, results };
    }
}
