/**
 * SuperPaymaster 5.5.0 cutover gate (read-only): the logic behind scripts/check-sp550-cutover.ts,
 * kept here so it runs against injected clients in tests. Not exported from the package index.
 *
 * Order of operations, each step refusing before the next one reads anything:
 *  1. usage: a known --network and two DISTINCT RPC endpoints (a single RPC only for a local,
 *     loopback fork rehearsal of the upgrade);
 *  2. chain identity: every RPC's chainId must be the network's;
 *  3. snapshot: one block number (default: the lowest FINALIZED block across the RPCs), and with
 *     two RPCs a well-formed, identical block hash on both;
 *  4. pins: complete and well-formed for the network's mode, and no release hold;
 *  5. every state read (SP version, impl slot, wiring, code) is taken on EVERY RPC at the
 *     snapshot block. A disagreement between RPCs is a Diverge object, not a value: it is never
 *     equal to anything (not even another Diverge), so it fails every check it feeds;
 *  6. every pinned address (top-level and address book) has the same non-empty code on every RPC;
 *  7. the SDK's own address book names what was certified: the proxy, and the entries SP is wired
 *     to (a PASS for a proxy the SDK does not use would authorise nothing it actually calls).
 * Exit 2 = refused before reading state; 1 = read, something failed; 0 = every check passed.
 */
import { getAddress, keccak256, toHex, type Address, type PublicClient } from 'viem';
import {
    APNTsCappedABI, BLSAggregatorABI, DVTValidatorABI, RegistryABI, ReputationSystemABI, SuperPaymasterLensABI, SuperPaymasterV550ABI, xPNTsFactoryV2ABI, xPNTsTokenV2ABI,
} from './abis/index.js';
import { CANONICAL_ADDRESSES } from './addresses.js';
import { SP550_CUTOVER_PINS, sp550PinnedAddressEntries } from './sp550Cutover.js';
import {
    SP550_FRESH_DEPLOY_PINS, SP550_RELEASE_HOLDS, assertSp550ChainId, resolveSp550Network, sp550FreshPinProblems, sp550UpgradePinProblems,
    type Sp550FreshDeployPins,
} from './sp550Deployments.js';

const ERC1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const;

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
    /** The SDK address book to hold the pins against; default CANONICAL_ADDRESSES[chainId] (tests inject). */
    book?: Record<string, unknown>;
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
const isLoopback = (url: string) => { try { return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(new URL(url).hostname); } catch { return false; } };

export async function runSp550CutoverGate(input: GateInput): Promise<GateResult> {
    const results: GateCheck[] = [];
    const refuse = (error: string): GateResult => ({ exitCode: 2, error, results });

    // 1. Usage.
    let net: ReturnType<typeof resolveSp550Network>;
    try { net = resolveSp550Network(input.network); } catch (e: any) { return refuse(e.message); }
    const rpcs = input.rpcs;
    if (rpcs.length === 0) return refuse('--rpc is required');
    if (net.mode === 'fresh' && rpcs.length < 2) return refuse(`--network ${net.network} is a fresh deploy: its read-back needs two RPCs (--rpc2)`);
    if (rpcs.length < 2 && !rpcs.every((r) => isLoopback(r.url))) {
        return refuse(`--network ${net.network}: a read-back needs two independent RPCs (--rpc2); a single RPC is accepted only for a loopback fork rehearsal`);
    }
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
    // An RPC that cannot serve the block yields `undefined` (fails every comparison) rather than throwing.
    const snapshotHashes = async () => Promise.all(rpcs.map((r) => r.client.getBlock({ blockNumber }).then(
        (b) => (typeof b?.hash === 'string' && HASH.test(b.hash) && b.number === blockNumber ? b.hash : undefined),
        () => undefined,
    )));
    const before = await snapshotHashes();
    record(rpcs.length > 1 ? 'every RPC serves the same block at the snapshot' : 'the RPC serves a well-formed snapshot block',
        before.every((h) => h !== undefined && h === before[0]),
        before.map((h, i) => `${rpcs[i].label} #${blockNumber} ${h ?? 'malformed or other block'}`).join(' · '));

    // 4. Pins for the network's mode, and holds.
    const chainId = net.chainId;
    const table = net.mode === 'fresh' ? 'SP550_FRESH_DEPLOY_PINS' : 'SP550_CUTOVER_PINS';
    const pins: Sp550FreshDeployPins = input.pins ?? (net.mode === 'fresh' ? SP550_FRESH_DEPLOY_PINS : SP550_CUTOVER_PINS)[chainId] ?? {};
    const header = `=== SP 5.5.0 cutover gate — ${net.network} (chain ${chainId}, ${net.mode}), all reads at block ${blockNumber}${typeof at === 'bigint' ? '' : ` (lowest ${at})`}, pins from ${input.pinsSource ?? `${table}[${chainId}]`} ===`;
    const problems = net.mode === 'fresh'
        ? sp550FreshPinProblems(pins, { allowRc: input.allowRc })
        : sp550UpgradePinProblems(pins, { allowRc: input.allowRc });
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
            try {
                const code = await r.client.getCode({ address, blockNumber });
                return code && code !== '0x' ? keccak256(code) : undefined;
            } catch (e: any) { return `ERR ${e?.shortMessage ?? e?.message}`; }
        })));
    };
    const cmp = (check: string, observed: unknown, expected: unknown, what = 'pinned') =>
        record(check, eq(observed, expected), `observed ${str(observed)} · ${what} ${expected === undefined ? '(unpinned)' : str(expected)}`);

    // Unpinned proxy: still READ the canonical one, so the report shows what the chain holds.
    const canonical = (input.book ?? (CANONICAL_ADDRESSES as Record<number, any>)[chainId] ?? {}) as Record<string, any>;
    const sp = (pins.superPaymaster ?? canonical.superPaymaster) as Address | undefined;
    if (!pins.superPaymaster) record('pins.superPaymaster', false, `(unpinned) — reading canonical ${sp ?? 'none'}`);
    if (!sp) return await finish();

    // The proxy the gate certifies must be the one the SDK talks to (executeGasless, the keeper).
    cmp('pins.superPaymaster == SDK book superPaymaster', pins.superPaymaster, canonical.superPaymaster, 'SDK book');

    // 5a. What is behind the proxy. The expected version is a reviewed pin, never a constant here.
    const version = await read(sp, SuperPaymasterV550ABI, 'version');
    record('SP.version() == pins.spVersion', typeof pins.spVersion === 'string' && pins.spVersion !== '' && version === pins.spVersion,
        `observed ${str(version)} · pinned ${pins.spVersion === undefined || pins.spVersion === '' ? '(unpinned)' : JSON.stringify(pins.spVersion)}`);
    const implOf = async (proxy: Address): Promise<{ impl?: Address; shown: string }> => {
        const slot = agree(await Promise.all(rpcs.map((r) => r.client.getStorageAt({ address: proxy, slot: ERC1967_IMPL_SLOT, blockNumber }))));
        const impl = typeof slot === 'string' && /^0x0{24}[0-9a-fA-F]{40}$/.test(slot) ? getAddress(('0x' + slot.slice(-40)) as Address) : undefined;
        return { impl, shown: impl ?? `malformed slot ${str(slot)}` };
    };
    const { impl, shown } = await implOf(sp);
    cmp('ERC-1967 impl == pins.spImpl', shown, pins.spImpl);
    cmp('keccak256(code(impl)) == pins.spImplCodehash', await codeHash(impl), pins.spImplCodehash);
    // The fallback DELEGATECALLs EXTENSION for every selector the core lacks: it must be the pinned admin code.
    cmp('SP.EXTENSION() == pins.spAdminExtension', await read(sp, SuperPaymasterV550ABI, 'EXTENSION'), pins.spAdminExtension);

    // 5b. SP's own 5.5.0 wiring.
    const apntsToken = await read(sp, SuperPaymasterV550ABI, 'APNTS_TOKEN');
    const xpntsFactory = await read(sp, SuperPaymasterV550ABI, 'xpntsFactory');
    cmp('SP.APNTS_TOKEN() == pins.aPNTsCapped', apntsToken, pins.aPNTsCapped);
    cmp('SP.xpntsFactory() == pins.xPNTsFactoryV2', xpntsFactory, pins.xPNTsFactoryV2);
    if (net.mode === 'upgrade') {
        // The upgrade keeps the book's addresses, so after the APNTS / factory switch the book must be
        // updated with the cutover: the SDK deposits aPNTs and deploys xPNTs through these entries.
        cmp('SDK book aPNTs == SP.APNTS_TOKEN()', canonical.aPNTs, apntsToken, 'chain');
        cmp('SDK book xPNTsFactory == SP.xpntsFactory()', canonical.xPNTsFactory, xpntsFactory, 'chain');
    }
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

    // 5d. The Lens expects exactly the pinned SP version (derived from the same pin, not a constant).
    const lensVersion = await read(pins.superPaymasterLens, SuperPaymasterLensABI, 'EXPECTED_SP_VERSION');
    const expectedLens = typeof pins.spVersion === 'string' && pins.spVersion !== '' ? keccak256(toHex(pins.spVersion)) : undefined;
    cmp('Lens.EXPECTED_SP_VERSION() == keccak256(pins.spVersion)', lensVersion, expectedLens);
    const lensOwnVersion = await read(pins.superPaymasterLens, SuperPaymasterLensABI, 'version');
    record('Lens.version() == pins.lensVersion', typeof pins.lensVersion === 'string' && pins.lensVersion !== '' && lensOwnVersion === pins.lensVersion,
        `observed ${str(lensOwnVersion)} · pinned ${pins.lensVersion === undefined || pins.lensVersion === '' ? '(unpinned)' : JSON.stringify(pins.lensVersion)}`);

    // 5e. The certified book entries, in either mode: SP is wired to them, the Registry proxy runs the
    //     pinned implementation, and the SDK book (after the cutover switch) names exactly them.
    const certified = pins.addresses ?? {};
    cmp('SP.REGISTRY() == addresses.registry', await read(sp, SuperPaymasterV550ABI, 'REGISTRY'), certified.registry);
    cmp('SP.BLS_AGGREGATOR() == addresses.blsAggregator', await read(sp, SuperPaymasterV550ABI, 'BLS_AGGREGATOR'), certified.blsAggregator);
    if (typeof certified.registry === 'string') {
        const r = await implOf(certified.registry as Address);
        cmp('ERC-1967 impl of addresses.registry == pins.registryImpl', r.shown, pins.registryImpl);
    } else record('ERC-1967 impl of addresses.registry == pins.registryImpl', false, 'addresses.registry (unpinned)');
    // Every leg of the BLS / DVT / Registry wiring names the certified contracts: SP alone is not enough
    // (2026-08-26..09-01 the Registry pointed at a new aggregator while SP and DVT kept the old one).
    const reg = certified.registry as Address | undefined, bls = certified.blsAggregator as Address | undefined, dvt = certified.dvtValidator as Address | undefined;
    cmp('Registry.blsAggregator() == addresses.blsAggregator', await read(reg, RegistryABI, 'blsAggregator'), bls);
    cmp('Registry.SUPER_PAYMASTER() == pins.superPaymaster', await read(reg, RegistryABI, 'SUPER_PAYMASTER'), pins.superPaymaster);
    cmp('DVTValidator.BLS_AGGREGATOR() == addresses.blsAggregator', await read(dvt, DVTValidatorABI, 'BLS_AGGREGATOR'), bls);
    cmp('DVTValidator.REGISTRY() == addresses.registry', await read(dvt, DVTValidatorABI, 'REGISTRY'), reg);
    cmp('BLSAggregator.DVT_VALIDATOR() == addresses.dvtValidator', await read(bls, BLSAggregatorABI, 'DVT_VALIDATOR'), dvt);
    cmp('BLSAggregator.REGISTRY() == addresses.registry', await read(bls, BLSAggregatorABI, 'REGISTRY'), reg);
    cmp('BLSAggregator.SUPERPAYMASTER() == pins.superPaymaster', await read(bls, BLSAggregatorABI, 'SUPERPAYMASTER'), pins.superPaymaster);
    cmp('ReputationSystem.REGISTRY() == addresses.registry', await read(certified.reputationSystem as Address | undefined, ReputationSystemABI, 'REGISTRY'), reg);
    for (const [k, a] of Object.entries(certified)) cmp(`SDK book ${k} == addresses.${k}`, canonical[k], a, 'pinned');

    // 5e'. Fresh deploy: the rest of the SP-owned book is the one SP is wired to.
    if (net.mode === 'fresh') {
        const book = certified;
        cmp('SP.agentIdentityRegistry() == addresses.agentIdentityRegistry', await read(sp, SuperPaymasterV550ABI, 'agentIdentityRegistry'), book.agentIdentityRegistry);
        cmp('SP.agentReputationRegistry() == addresses.agentReputationRegistry', await read(sp, SuperPaymasterV550ABI, 'agentReputationRegistry'), book.agentReputationRegistry);
        cmp('addresses.aPNTs == pins.aPNTsCapped', book.aPNTs, pins.aPNTsCapped);
        // External entries are not SP's deploy: compare SP's wiring with the SDK book, not with pins.
        cmp('SP.entryPoint() == SDK book entryPoint', await read(sp, SuperPaymasterV550ABI, 'entryPoint'), canonical.entryPoint, 'SDK book');
        cmp('SP.ETH_USD_PRICE_FEED() == SDK book priceFeed', await read(sp, SuperPaymasterV550ABI, 'ETH_USD_PRICE_FEED'), canonical.priceFeed, 'SDK book');
        for (const k of pins.absent ?? []) record(`SDK book has no ${k} (declared absent)`, canonical[k] === undefined, `SDK book ${str(canonical[k] ?? '(none)')}`);
    }

    // 5f. Every pinned address, top-level and address book, is real code and the same code on every RPC.
    //     And it is the PINNED code: version() does not identify a build (two SP-a builds report the
    //     same string), so every address is held to its read-back runtime codehash.
    for (const [k, a] of sp550PinnedAddressEntries(pins)) {
        if (typeof a !== 'string') continue; // unpinned: already a failure in 'pins complete and well-formed'
        const h = await codeHash(a as Address);
        record(`${k} has the same non-empty code on every RPC`, typeof h === 'string' && HASH.test(h), `${a} · ${h === undefined ? 'no code' : str(h)}`);
        cmp(`keccak256(code(${k})) == pins.codehashes.${k}`, h, pins.codehashes?.[k]);
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
