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
import { scannedGetters } from './abis/coexistStackAbi.js';
import { getAddress, keccak256, toHex, type Address, type PublicClient } from 'viem';
import {
    AOAProtocolRegistryABI, APNTsCappedABI, BLSAggregatorABI, BLSValidatorABI, DVTValidatorABI, GTokenABI, GTokenStakingABI, GlobalTierSourceABI, MicroPaymentChannelABI, MySBTABI,
    PaymasterABI, PaymasterFactoryABI, PolicyRegistryABI, RegistryABI, RegistryRc8ABI, GTokenAuthorizationRc8ABI, TimelockControllerABI, X402FacilitatorABI, ReputationSystemABI, SuperPaymasterLensABI, SuperPaymasterV550ABI, xPNTsFactoryV2ABI, xPNTsTokenV2ABI,
} from './abis/index.js';
import { CANONICAL_ADDRESSES } from './addresses.js';
import { sp550PinnedAddressEntries } from './sp550Cutover.js';
import {
    SP550_ADDRESS_OWNER, SP550_RELEASE_VERSIONS, SP550_RELEASE_VERSION_ENTRY, sp550ReleaseVersionsProblems, assertSp550ChainId, sp550NetworkPinProblems, type Sp550CoexistNetwork, resolveSp550Network, sp550FreshPinProblems, sp550OverlayBook, sp550PinsFor, sp550UpgradePinProblems,
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
/** A loopback / unspecified host by its parsed name: localhost, 127/8, 0.0.0.0, ::1, ::, IPv4-mapped forms. */
const isLoopback = (url: string) => {
    let h: string;
    try { h = new URL(url).hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, ''); } catch { return false; }
    if (h === 'localhost' || h.endsWith('.localhost') || /^127\.\d+\.\d+\.\d+$/.test(h) || h === '0.0.0.0' || h === '::1' || h === '::') return true;
    const m = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
    return !!m && (parseInt(m[1], 16) >> 8 === 0x7f || (parseInt(m[1], 16) === 0 && parseInt(m[2], 16) === 0));
};

/** The vendored ABI of each pinned entry the wiring scan reads (sp550PinnedAddressEntries names). */
export const SP550_WIRING_SCAN_ABI: Record<string, unknown> = {
    superPaymaster: SuperPaymasterV550ABI, spImpl: SuperPaymasterV550ABI, superPaymasterLens: SuperPaymasterLensABI,
    xPNTsFactoryV2: xPNTsFactoryV2ABI, xPNTsTokenV2Impl: xPNTsTokenV2ABI, aoaProtocolRegistry: AOAProtocolRegistryABI,
    globalTierSource: GlobalTierSourceABI, aPNTsCapped: APNTsCappedABI, registryImpl: RegistryABI,
    'addresses.registry': RegistryABI, 'addresses.gToken': GTokenABI, 'addresses.staking': GTokenStakingABI, 'addresses.sbt': MySBTABI,
    'addresses.reputationSystem': ReputationSystemABI, 'addresses.superPaymaster': SuperPaymasterV550ABI,
    'addresses.paymasterFactory': PaymasterFactoryABI, 'addresses.paymasterV4Impl': PaymasterABI, 'addresses.blsAggregator': BLSAggregatorABI,
    'addresses.dvtValidator': DVTValidatorABI, 'addresses.aPNTs': APNTsCappedABI, 'addresses.policyRegistry': PolicyRegistryABI,
    'addresses.x402Facilitator': X402FacilitatorABI, 'addresses.timelockController': TimelockControllerABI,
    'addresses.paymasterV4': PaymasterABI, 'addresses.aPNTsPaymasterV4': PaymasterABI, 'addresses.PNTsPaymasterV4': PaymasterABI,
    'addresses.xPNTsFactory': xPNTsFactoryV2ABI, 'addresses.microPaymentChannel': MicroPaymentChannelABI, 'addresses.blsValidator': BLSValidatorABI,
};

/**
 * A coexisting stack's own ABIs for entries whose contract is newer than the SDK-wide file (the rc.8 coexist set,
 * scripts/coexist-stack-abi-pin.ts found the gap): the scan and the reads of that stack use these instead.
 */
export const SP550_COEXIST_SCAN_ABI: Record<Sp550CoexistNetwork, Record<string, unknown>> = {
    // null: not a contract of this release (rc.8 deploys no BLSValidator, SP DeployLive.s.sol:39): a pin naming it fails.
    'sepolia-rc8': { registryImpl: RegistryRc8ABI, 'addresses.registry': RegistryRc8ABI, 'addresses.gToken': GTokenAuthorizationRc8ABI, 'addresses.blsValidator': null },
};
/** The ABI the gate reads each pinned entry with on a network: the coexist set first, then the SDK-wide file. */
export const sp550WiringScanAbi = (network: string): Record<string, unknown> =>
    ({ ...SP550_WIRING_SCAN_ABI, ...((SP550_COEXIST_SCAN_ABI as Record<string, Record<string, unknown>>)[network] ?? {}) });

/** Pinned entries the scan does not read, each with why. Any other entry without an ABI above fails the gate. */
export const SP550_WIRING_SCAN_EXEMPT: Record<string, string> = {
    spAdminExtension: 'no vendored ABI (reached through SP.EXTENSION(), which the gate compares with the pin)',
    xPNTsTokenV2Ext: 'no vendored ABI (compared through tokenImpl.EXTENSION() and the factory extensionCodehash)',
    disclosureRegistry: 'no vendored ABI; 5.5.0 deploys none (declared absent)',
    'addresses.agentIdentityRegistry': 'no vendored ABI for SP\'s ERC-8004 registries (SP.agentIdentityRegistry() is compared)',
    'addresses.agentReputationRegistry': 'no vendored ABI for SP\'s ERC-8004 registries (SP.agentReputationRegistry() is compared)',
    'addresses.agentValidationRegistry': 'no vendored ABI for SP\'s ERC-8004 registries',
    'addresses.pnts': 'a community token whose generation (xPNTs v1 / v2) differs by deployment; no single ABI',
};

/**
 * FU-124: the expected value of every address getter of every scanned contract (pin / external book key / allowed
 * zero / named operator address), generated from the re-pinned rc.8 ABI and SP's readback.json. EMPTY until that PR:
 * while it is empty the exhaustive scan can only refuse the shipped stack, not prove each getter points at the right
 * contract, so no network's pins may be written (DSR 2026-11-19; scripts/sp550-pin-fill.ts --write refuses).
 */
export const SP550_WIRING_EXPECTED: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({});

/**
 * Set to true ONLY by the change that makes the gate compare every scanned getter with SP550_WIRING_EXPECTED (FU-124).
 * A filled table alone does not unlock writing: the gate must also enforce it.
 */
export const SP550_WIRING_ALLOWLIST_ENFORCED = false;

/** True once the getter allow-list (FU-124) exists AND the gate enforces it; until then pin writing is refused. */
export const sp550WiringAllowListReady = (): boolean => SP550_WIRING_ALLOWLIST_ENFORCED && Object.keys(SP550_WIRING_EXPECTED).length > 0;

/**
 * Getters a vendored ABI lists that this release's contract does not implement (they revert): reviewed per release
 * at the ABI re-pin, so a revert anywhere else fails the gate. None known.
 */
export const SP550_WIRING_SCAN_UNSUPPORTED: Record<string, readonly string[]> = {};

/** SP-owned (and history) addresses of a shipped book, lower-cased, with their key. */
function shippedStackAddresses(shipped: Record<string, unknown>): Map<string, string> {
    const old = new Map<string, string>();
    for (const [k, owner] of Object.entries(SP550_ADDRESS_OWNER)) {
        const v = shipped[k];
        if ((owner !== 'external' || k === 'timelockControllerLegacy') && typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v) && !/^0x0{40}$/i.test(v)) old.set(v.toLowerCase(), k);
    }
    return old;
}

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
    const entry = sp550PinsFor(net.network);
    const pins: Sp550FreshDeployPins = input.pins ?? entry.pins ?? {};
    const header = `=== SP 5.5.0 cutover gate — ${net.network} (chain ${chainId}, ${net.mode}${net.coexist ? ', coexisting stack' : ''}), all reads at block ${blockNumber}${typeof at === 'bigint' ? '' : ` (lowest ${at})`}, pins from ${input.pinsSource ?? `${entry.table}[${JSON.stringify(entry.key)}]`} ===`;
    const { problems, hold } = sp550NetworkPinProblems(net.network, pins, { allowRc: input.allowRc });
    record('pins complete and well-formed', problems.length === 0, problems.length ? problems.join('; ') : 'ok');
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
    // A coexisting stack never enters CANONICAL_ADDRESSES: its book is the shipped one with the pins' SP entries.
    const shipped = ((CANONICAL_ADDRESSES as Record<number, any>)[chainId] ?? {}) as Record<string, unknown>;
    const canonical = (input.book ?? (net.coexist ? sp550OverlayBook(shipped, pins) : shipped)) as Record<string, any>;
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
    const regAbi = sp550WiringScanAbi(net.network)['addresses.registry'];
    cmp('Registry.blsAggregator() == addresses.blsAggregator', await read(reg, regAbi, 'blsAggregator'), bls);
    cmp('Registry.SUPER_PAYMASTER() == pins.superPaymaster', await read(reg, regAbi, 'SUPER_PAYMASTER'), pins.superPaymaster);
    cmp('DVTValidator.BLS_AGGREGATOR() == addresses.blsAggregator', await read(dvt, DVTValidatorABI, 'BLS_AGGREGATOR'), bls);
    cmp('DVTValidator.REGISTRY() == addresses.registry', await read(dvt, DVTValidatorABI, 'REGISTRY'), reg);
    cmp('BLSAggregator.DVT_VALIDATOR() == addresses.dvtValidator', await read(bls, BLSAggregatorABI, 'DVT_VALIDATOR'), dvt);
    cmp('BLSAggregator.REGISTRY() == addresses.registry', await read(bls, BLSAggregatorABI, 'REGISTRY'), reg);
    cmp('BLSAggregator.SUPERPAYMASTER() == pins.superPaymaster', await read(bls, BLSAggregatorABI, 'SUPERPAYMASTER'), pins.superPaymaster);
    cmp('ReputationSystem.REGISTRY() == addresses.registry', await read(certified.reputationSystem as Address | undefined, ReputationSystemABI, 'REGISTRY'), reg);
    for (const [k, a] of Object.entries(certified)) cmp(`SDK book ${k} == addresses.${k}`, canonical[k], a, 'pinned');
    // A key the pins declare absent is not a live book entry, in either mode (an upgrade declares only the timelock).
    // ("not deployed" in the book is the zero address — every chain carries every key — or no entry at all.)
    if (net.mode === 'upgrade') for (const k of pins.absent ?? []) {
        const v = canonical[k];
        record(`SDK book has no live ${k} (declared absent)`, v === undefined || (typeof v === 'string' && /^0x0{40}$/i.test(v)), `SDK book ${str(v ?? '(none)')}`);
    }

    // 5e'. Fresh deploy: the rest of the SP-owned book is the one SP is wired to.
    if (net.mode === 'fresh') {
        const book = certified;
        cmp('SP.agentIdentityRegistry() == addresses.agentIdentityRegistry', await read(sp, SuperPaymasterV550ABI, 'agentIdentityRegistry'), book.agentIdentityRegistry);
        cmp('SP.agentReputationRegistry() == addresses.agentReputationRegistry', await read(sp, SuperPaymasterV550ABI, 'agentReputationRegistry'), book.agentReputationRegistry);
        cmp('addresses.aPNTs == pins.aPNTsCapped', book.aPNTs, pins.aPNTsCapped);
        // External entries are not SP's deploy: compare SP's wiring with the SDK book, not with pins.
        cmp('SP.entryPoint() == SDK book entryPoint', await read(sp, SuperPaymasterV550ABI, 'entryPoint'), canonical.entryPoint, 'SDK book');
        cmp('SP.ETH_USD_PRICE_FEED() == SDK book priceFeed', await read(sp, SuperPaymasterV550ABI, 'ETH_USD_PRICE_FEED'), canonical.priceFeed, 'SDK book');
        // Not deployed = no entry or the zero address (a coexisting set keeps every key, zeroed, so a client merge
        // cannot fall back to the chain's other stack).
        // The token / staking / SBT legs name the pinned contracts, so pins that are each new and correct cannot hide a
        // contract still wired into another stack (e.g. a fresh Registry whose GTOKEN_STAKING is the old staking).
        const stk = book.staking as Address | undefined, sbt = book.sbt as Address | undefined;
        cmp('Registry.GTOKEN_STAKING() == addresses.staking', await read(reg, regAbi, 'GTOKEN_STAKING'), stk);
        cmp('Registry.MYSBT() == addresses.sbt', await read(reg, regAbi, 'MYSBT'), sbt);
        cmp('GTokenStaking.REGISTRY() == addresses.registry', await read(stk, GTokenStakingABI, 'REGISTRY'), reg);
        cmp('GTokenStaking.GTOKEN() == addresses.gToken', await read(stk, GTokenStakingABI, 'GTOKEN'), book.gToken);
        cmp('MySBT.REGISTRY() == addresses.registry', await read(sbt, MySBTABI, 'REGISTRY'), reg);
        cmp('MySBT.GTOKEN_STAKING() == addresses.staking', await read(sbt, MySBTABI, 'GTOKEN_STAKING'), stk);
        cmp('MySBT.GTOKEN() == addresses.gToken', await read(sbt, MySBTABI, 'GTOKEN'), book.gToken);
        cmp('xPNTsFactoryV2.REGISTRY() == addresses.registry', await read(pins.xPNTsFactoryV2, xPNTsFactoryV2ABI, 'REGISTRY'), reg);
        cmp('PaymasterFactory.registry() == addresses.registry', await read(book.paymasterFactory as Address | undefined, PaymasterFactoryABI, 'registry'), reg);
        cmp('X402Facilitator.REGISTRY() == addresses.registry', await read(book.x402Facilitator as Address | undefined, X402FacilitatorABI, 'REGISTRY'), reg);
        cmp('X402Facilitator.XPNTS_FACTORY() == pins.xPNTsFactoryV2', await read(book.x402Facilitator as Address | undefined, X402FacilitatorABI, 'XPNTS_FACTORY'), pins.xPNTsFactoryV2);
        cmp('PaymasterV4 impl registry() == addresses.registry', await read(book.paymasterV4Impl as Address | undefined, PaymasterABI, 'registry'), reg);
        cmp('GlobalTierSource.REGISTRY() == addresses.registry', await read(pins.globalTierSource, GlobalTierSourceABI, 'REGISTRY'), reg);
        // Each deployed V4 paymaster instance: its Registry, EntryPoint and price feed are the stack's.
        for (const k of ['paymasterV4', 'aPNTsPaymasterV4', 'PNTsPaymasterV4'] as const) {
            const pm = book[k] as Address | undefined;
            if (typeof pm !== 'string' || /^0x0{40}$/i.test(pm)) continue; // declared absent
            cmp(`${k}.registry() == addresses.registry`, await read(pm, PaymasterABI, 'registry'), reg);
            cmp(`${k}.entryPoint() == SDK book entryPoint`, await read(pm, PaymasterABI, 'entryPoint'), canonical.entryPoint, 'SDK book');
            cmp(`${k}.ethUsdPriceFeed() == SDK book priceFeed`, await read(pm, PaymasterABI, 'ethUsdPriceFeed'), canonical.priceFeed, 'SDK book');
        }
        // Exhaustive, not a hand list: every no-argument address getter of every pinned contract is read on every RPC.
        // A disagreement, a failed call or a malformed answer fails (a revert only where SP550_WIRING_SCAN_UNSUPPORTED
        // lists it); every pinned entry has an ABI here or a reasoned exemption. For a COEXISTING stack, no getter
        // may name an SP-owned contract of the chain's shipped stack (a hybrid with the old one). A chain-keyed fresh
        // stack replaces its chain's book, so its shipped book is not a forbidden set (after the switch it IS the stack).
        const old = net.coexist ? shippedStackAddresses(shipped) : new Map<string, string>();
        const scanAbi = sp550WiringScanAbi(net.network);
        for (const [entry, address] of sp550PinnedAddressEntries(pins)) {
            if (typeof address !== 'string') continue;
            const abi = scanAbi[entry];
            if (abi === null) {
                record(`${entry} is not a contract of this release`, false, `pinned ${address}; this release deploys none: omit it from addresses and list it in absent`);
                continue;
            }
            if (!abi) {
                record(`address getters of ${entry} scanned`, entry in SP550_WIRING_SCAN_EXEMPT, SP550_WIRING_SCAN_EXEMPT[entry] ?? 'no ABI mapping and no exemption: add one');
                continue;
            }
            // Every no-argument view whose outputs carry an address anywhere (address, address[], tuples of them): the
            // same predicate the rc.8 coexist proof enumerates with (abis/coexistStackAbi.ts), one definition.
            const getters = scannedGetters(abi as any[]).map((w) => w.name);
            const unsupported = new Set(SP550_WIRING_SCAN_UNSUPPORTED[entry] ?? []);
            const bad: string[] = [], skipped: string[] = [];
            // The addresses at the ADDRESS-typed positions of a decoded result, guided by the ABI outputs; undefined when
            // the value does not have that shape (a disagreement between RPCs, or an unreadable answer).
            const at = (o: any, v: unknown): string[] | undefined => {
                if (o.type.endsWith('[]')) {
                    if (!Array.isArray(v)) return undefined;
                    const inner = { ...o, type: o.type.slice(0, o.type.lastIndexOf('[')) };
                    const out: string[] = [];
                    for (const x of v) { const a = at(inner, x); if (!a) return undefined; out.push(...a); }
                    return out;
                }
                if (o.type === 'address') return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v) ? [v] : undefined;
                if (o.type === 'tuple') return outputsAt(o.components ?? [], v);
                return []; // not an address position
            };
            const outputsAt = (outs: any[], v: unknown): string[] | undefined => {
                const vals = outs.length === 1 && !(outs[0].type === 'tuple' && Array.isArray(v) === false && v && typeof v === 'object') ? [v]
                    : Array.isArray(v) ? v : v && typeof v === 'object' ? outs.map((o, k) => (v as any)[o.name || k]) : undefined;
                if (!vals || vals.length !== outs.length) return undefined;
                const out: string[] = [];
                for (let k = 0; k < outs.length; k++) { const a = at(outs[k], vals[k]); if (!a) return undefined; out.push(...a); }
                return out;
            };
            const outputsOf = (g: string) => (abi as any[]).find((e) => e.type === 'function' && e.name === g && (e.inputs ?? []).length === 0).outputs;
            for (const g of getters) {
                const v = await read(address as Address, abi, g);
                if (typeof v === 'string' && v.startsWith('ERR ')) { if (unsupported.has(g)) skipped.push(g); else bad.push(`${g}() ${v}`); continue; }
                const found = v instanceof Diverge ? undefined : outputsAt(outputsOf(g), v);
                if (!found) { bad.push(`${g}() ${str(v)}`); continue; }
                for (const a of found) { const k = old.get(a.toLowerCase()); if (k) bad.push(`${g}() names ${a} (the shipped stack's ${k})`); }
            }
            record(`address getters of ${entry}${net.coexist ? ' name no shipped-stack contract' : ' read on every RPC'}`, bad.length === 0,
                bad.length ? bad.join('; ') : `${getters.length - skipped.length}/${getters.length} read${skipped.length ? `; unsupported in this release: ${skipped.join(', ')}` : ''}`);
        }
        for (const k of pins.absent ?? []) {
            if (k === 'disclosureRegistry') continue; // a top-level pin, not a book entry
            const v = canonical[k];
            record(`SDK book has no ${k} (declared absent)`, v === undefined || (typeof v === 'string' && /^0x0{40}$/i.test(v)), `SDK book ${str(v ?? '(none)')}`);
        }
    }

    // 5e''. A coexisting stack's contracts report the release's version() strings (SP's release-versions table).
    if (net.coexist) {
        const rv = SP550_RELEASE_VERSIONS[net.network as Sp550CoexistNetwork];
        const entries = new Map(sp550PinnedAddressEntries(pins));
        const abiFor: Record<string, unknown> = { SuperPaymaster: SuperPaymasterV550ABI, Registry: regAbi, xPNTsFactoryV2: xPNTsFactoryV2ABI, GTokenStaking: GTokenStakingABI, GTokenAuthorization: sp550WiringScanAbi(net.network)['addresses.gToken'], APNTsCapped: APNTsCappedABI };
        // Daybreak #469 H1: the table is held to the exact required key set first, and the loop walks the REQUIRED
        // mapping, not the table: a table missing a key fails instead of silently comparing less. An empty expected or
        // observed version is a failure (eq() would call two empty strings equal).
        const tableProblems = sp550ReleaseVersionsProblems(rv);
        record('release-versions table: exact key set, non-empty versions', tableProblems.length === 0, tableProblems.join('; ') || `${Object.keys(rv).length} entries`);
        for (const [name, entry] of Object.entries(SP550_RELEASE_VERSION_ENTRY)) {
            const want = (rv as Record<string, unknown>)[name];
            const addr = entries.get(entry) as Address | undefined;
            const label = `${name}.version() == release-versions ${JSON.stringify(want ?? '(missing)')}`;
            if (!abiFor[name]) { record(label, false, `no ABI mapping for ${name}: add one`); continue; }
            const observed = await read(addr, abiFor[name], 'version');
            record(label, typeof want === 'string' && want !== '' && typeof observed === 'string' && observed !== '' && observed === want,
                `observed ${str(observed)} · release-versions ${str(want ?? '(missing)')}${addr ? '' : ' · (no pinned address)'}`);
        }
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
