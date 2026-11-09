#!/usr/bin/env tsx
/**
 * SuperPaymaster 5.5.0 cutover gate (read-only). Compares the 5.5.0 pins for the selected network
 * (packages/core/src/sp550Cutover.ts / sp550Deployments.ts, or a --pins JSON file) against the
 * chain, field by field.
 *
 *   pnpm exec tsx scripts/check-sp550-cutover.ts --network <sepolia|op-sepolia|op-mainnet> \
 *       --rpc <url> [--rpc2 <url>] [--pins <file.json>] [--block <n>] [--allow-rc]
 *
 * The network alone selects the pins and the deploy mode: `upgrade` (Sepolia, in-place 5.4.2 ->
 * 5.5.0) or `fresh` (OP chains, a new full V5 stack). Before any other read, every RPC's chainId
 * is asserted to be the network's; a mismatch exits 2. A fresh deploy is read back from TWO
 * RPCs (--rpc2 required): both must serve the same block hash at the snapshot block, and every
 * pinned address must have the same non-empty code on both.
 *
 * Every read is taken at ONE block (--block, default: the lower of the RPC heads when the run
 * starts), so a PASS describes a single consistent snapshot rather than values read across a
 * concurrent upgrade.
 *
 * Exit 0 only if every required pin is filled, no release hold applies, AND every check reads back
 * as pinned. A missing pin is a failure that prints the value observed on chain — the pin must be
 * written from a readback, never from this script's output alone (DSR cutover work order). Sends
 * no transaction.
 */
import * as fs from 'fs';
import { createPublicClient, http, keccak256, toHex, getAddress, type Address, type Hex, type PublicClient } from 'viem';
import { SuperPaymasterV550ABI, SuperPaymasterLensABI, xPNTsFactoryV2ABI, xPNTsTokenV2ABI, APNTsCappedABI } from '../packages/core/src/abis/index.js';
import { SP550_CUTOVER_PINS, sp550PinProblems } from '../packages/core/src/sp550Cutover.js';
import {
    SP550_FRESH_DEPLOY_PINS, SP550_RELEASE_HOLDS, assertSp550ChainId, resolveSp550Network, sp550FreshPinProblems,
    type Sp550FreshDeployPins,
} from '../packages/core/src/sp550Deployments.js';
import { CANONICAL_ADDRESSES } from '../packages/core/src/addresses.js';

const ERC1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const;
const EXPECTED_VERSION = 'SuperPaymaster-5.5.0';
const USAGE = 'usage: check-sp550-cutover.ts --network <sepolia|op-sepolia|op-mainnet> --rpc <url> [--rpc2 <url>] [--pins <file.json>] [--block <n>] [--allow-rc]';

const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const rpc = arg('--rpc') || process.env.RPC_URL;
const rpc2 = arg('--rpc2');
const allowRc = args.includes('--allow-rc');
const usage = (msg: string): never => { console.error(`${msg}\n${USAGE}`); process.exit(2); };
if (!rpc) usage('--rpc is required');
let net: ReturnType<typeof resolveSp550Network>;
try { net = resolveSp550Network(arg('--network')); } catch (e: any) { usage(e.message); }
if (net!.mode === 'fresh' && !rpc2) usage(`--network ${net!.network} is a fresh deploy: its read-back needs two RPCs (--rpc2)`);

const client = createPublicClient({ transport: http(rpc) }) as PublicClient;
const client2 = rpc2 ? (createPublicClient({ transport: http(rpc2) }) as PublicClient) : undefined;
const results: { check: string; ok: boolean; detail: string }[] = [];
const record = (check: string, ok: boolean, detail: string) => results.push({ check, ok, detail });
const eq = (a?: unknown, b?: unknown) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

async function main() {
    // 0. Chain identity first: nothing else is read from an RPC that is on the wrong chain.
    const chainId = net.chainId;
    for (const [label, c] of [['--rpc', client], ['--rpc2', client2]] as const) {
        if (!c) continue;
        try { assertSp550ChainId(net.network, await c.getChainId()); } catch (e: any) { usage(`${label}: ${e.message}`); }
    }
    const heads = await Promise.all([client, client2].filter(Boolean).map((c) => c!.getBlockNumber()));
    const blockNumber = arg('--block') ? BigInt(arg('--block')!) : heads.reduce((a, b) => (a < b ? a : b));
    if (client2) {
        const [h1, h2] = await Promise.all([client.getBlock({ blockNumber }), client2.getBlock({ blockNumber })]);
        record('both RPCs serve the same block at the snapshot', h1.hash === h2.hash, `${h1.hash} · ${h2.hash}`);
    }

    let pins: Sp550FreshDeployPins;
    let source: string;
    const file = arg('--pins');
    const table = net.mode === 'fresh' ? 'SP550_FRESH_DEPLOY_PINS' : 'SP550_CUTOVER_PINS';
    if (file) {
        const j = JSON.parse(fs.readFileSync(file, 'utf8'));
        pins = { ...j, readbackBlock: j.readbackBlock !== undefined ? BigInt(j.readbackBlock) : undefined };
        source = file;
    } else {
        pins = (net.mode === 'fresh' ? SP550_FRESH_DEPLOY_PINS : SP550_CUTOVER_PINS)[chainId] ?? {};
        source = `${table}[${chainId}]`;
    }
    console.log(`=== SP 5.5.0 cutover gate — ${net.network} (chain ${chainId}, ${net.mode}), all reads at block ${blockNumber}, pins from ${source} ===`);

    const problems = net.mode === 'fresh' ? sp550FreshPinProblems(pins, { allowRc }) : sp550PinProblems(pins, { allowRc });
    record('pins complete and well-formed', problems.length === 0, problems.length ? problems.join('; ') : 'ok');
    const hold = SP550_RELEASE_HOLDS[chainId];
    if (hold) record('no release hold on this chain', false, hold);

    // Unpinned proxy: still READ the canonical proxy, so the report shows what the chain holds.
    const sp = (pins.superPaymaster ?? (CANONICAL_ADDRESSES as Record<number, any>)[chainId]?.superPaymaster) as Address | undefined;
    if (!pins.superPaymaster) record('pins.superPaymaster', false, `(unpinned) — reading canonical proxy ${sp ?? 'none'}`);
    if (!sp) { report(); return; }

    const read = (address: Address | undefined, abi: any, functionName: string) =>
        address
            ? (client.readContract({ address, abi, functionName, blockNumber } as any).catch((e: any) => `ERR ${e?.shortMessage ?? e?.message}`) as Promise<any>)
            : Promise.resolve('(unpinned address)');
    const codeHash = async (address?: Address, c: PublicClient = client) => {
        if (!address) return undefined;
        const code = await c.getCode({ address, blockNumber });
        return code && code !== '0x' ? keccak256(code) : undefined;
    };
    const cmp = (check: string, observed: unknown, pinned: unknown) =>
        record(check, eq(observed, pinned), `observed ${String(observed)} · pinned ${pinned === undefined ? '(unpinned)' : String(pinned)}`);

    // 1. What is behind the proxy.
    const version = await read(sp, SuperPaymasterV550ABI, 'version');
    record(`SP.version() == "${EXPECTED_VERSION}"`, version === EXPECTED_VERSION, String(version));
    const slot = await client.getStorageAt({ address: sp, slot: ERC1967_IMPL_SLOT, blockNumber });
    const impl = slot && /^0x0{24}[0-9a-fA-F]{40}$/.test(slot) ? getAddress(('0x' + slot.slice(-40)) as Address) : undefined;
    cmp('ERC-1967 impl == pins.spImpl', impl ?? `malformed slot ${slot}`, pins.spImpl);
    cmp('keccak256(code(impl)) == pins.spImplCodehash', await codeHash(impl), pins.spImplCodehash);

    // 2. SP's own wiring.
    cmp('SP.APNTS_TOKEN() == pins.aPNTsCapped', await read(sp, SuperPaymasterV550ABI, 'APNTS_TOKEN'), pins.aPNTsCapped);
    cmp('SP.xpntsFactory() == pins.xPNTsFactoryV2', await read(sp, SuperPaymasterV550ABI, 'xpntsFactory'), pins.xPNTsFactoryV2);
    const apntsVersion = await read(pins.aPNTsCapped, APNTsCappedABI, 'version');
    record('aPNTsCapped.version() is APNTsCapped-*', typeof apntsVersion === 'string' && apntsVersion.startsWith('APNTsCapped-'), String(apntsVersion));

    // 3. The xPNTs v2 stack points at the pinned pieces (an unrelated contract with code fails here).
    const f = pins.xPNTsFactoryV2 as Address | undefined;
    cmp('factory.SUPERPAYMASTER() == pins.superPaymaster', await read(f, xPNTsFactoryV2ABI, 'SUPERPAYMASTER'), pins.superPaymaster);
    cmp('factory.implementation() == pins.xPNTsTokenV2Impl', await read(f, xPNTsFactoryV2ABI, 'implementation'), pins.xPNTsTokenV2Impl);
    cmp('factory.defaultTierSource() == pins.globalTierSource', await read(f, xPNTsFactoryV2ABI, 'defaultTierSource'), pins.globalTierSource);
    cmp('factory.implementationCodehash() == keccak256(code(xPNTsTokenV2Impl))', await read(f, xPNTsFactoryV2ABI, 'implementationCodehash'), await codeHash(pins.xPNTsTokenV2Impl as Address | undefined));
    cmp('factory.extensionCodehash() == keccak256(code(xPNTsTokenV2Ext))', await read(f, xPNTsFactoryV2ABI, 'extensionCodehash'), await codeHash(pins.xPNTsTokenV2Ext as Address | undefined));
    const ti = pins.xPNTsTokenV2Impl as Address | undefined;
    cmp('tokenImpl.EXTENSION() == pins.xPNTsTokenV2Ext', await read(ti, xPNTsTokenV2ABI, 'EXTENSION'), pins.xPNTsTokenV2Ext);
    cmp('tokenImpl.PROTOCOL_REGISTRY() == pins.aoaProtocolRegistry', await read(ti, xPNTsTokenV2ABI, 'PROTOCOL_REGISTRY'), pins.aoaProtocolRegistry);
    // NOT tokenImpl.FACTORY(): FACTORY is storage written by initialize() on each CLONE
    // (xPNTsTokenV2.sol:74); the implementation disables initializers (:44), so on the impl it is 0.
    // EXTENSION and PROTOCOL_REGISTRY above are immutables (:26, xPNTsV2Base.sol:53), set on the impl.

    // 4. The Lens is the 5.5.0 one.
    const lensVersion = await read(pins.superPaymasterLens as Address | undefined, SuperPaymasterLensABI, 'EXPECTED_SP_VERSION');
    record('Lens.EXPECTED_SP_VERSION() == keccak256("SuperPaymaster-5.5.0")', eq(lensVersion, keccak256(toHex(EXPECTED_VERSION))), String(lensVersion));

    // 5. Fresh deploy: the SP-owned address book is the one SP is wired to, and is real code.
    if (net.mode === 'fresh') {
        const book = pins.addresses ?? {};
        const canonical = (CANONICAL_ADDRESSES as Record<number, any>)[chainId] ?? {};
        cmp('SP.REGISTRY() == addresses.registry', await read(sp, SuperPaymasterV550ABI, 'REGISTRY'), book.registry);
        cmp('SP.BLS_AGGREGATOR() == addresses.blsAggregator', await read(sp, SuperPaymasterV550ABI, 'BLS_AGGREGATOR'), book.blsAggregator);
        cmp('SP.agentIdentityRegistry() == addresses.agentIdentityRegistry', await read(sp, SuperPaymasterV550ABI, 'agentIdentityRegistry'), book.agentIdentityRegistry);
        cmp('SP.agentReputationRegistry() == addresses.agentReputationRegistry', await read(sp, SuperPaymasterV550ABI, 'agentReputationRegistry'), book.agentReputationRegistry);
        cmp('addresses.aPNTs == pins.aPNTsCapped', book.aPNTs, pins.aPNTsCapped);
        // External entries are not SP's deploy: compare SP's wiring with the SDK book, not with pins.
        cmp('SP.entryPoint() == SDK book entryPoint', await read(sp, SuperPaymasterV550ABI, 'entryPoint'), canonical.entryPoint);
        cmp('SP.ETH_USD_PRICE_FEED() == SDK book priceFeed', await read(sp, SuperPaymasterV550ABI, 'ETH_USD_PRICE_FEED'), canonical.priceFeed);
        for (const [k, a] of Object.entries(book)) {
            const h = await codeHash(a as Address);
            record(`addresses.${k} has code`, h !== undefined, `${a} · ${h ?? 'no code'}`);
        }
    }

    // 6. Two-RPC read-back: every pinned address has the same code on both RPCs.
    if (client2) {
        const all = { ...(pins.addresses ?? {}), spImpl: pins.spImpl, superPaymasterLens: pins.superPaymasterLens, xPNTsFactoryV2: pins.xPNTsFactoryV2,
            xPNTsTokenV2Impl: pins.xPNTsTokenV2Impl, xPNTsTokenV2Ext: pins.xPNTsTokenV2Ext, aoaProtocolRegistry: pins.aoaProtocolRegistry,
            globalTierSource: pins.globalTierSource, aPNTsCapped: pins.aPNTsCapped };
        for (const [k, a] of Object.entries(all)) {
            if (!a) continue;
            const [h1, h2] = await Promise.all([codeHash(a as Address), codeHash(a as Address, client2)]);
            record(`code(${k}) identical on both RPCs`, h1 !== undefined && h1 === h2, `${h1 ?? 'no code'} · ${h2 ?? 'no code'}`);
        }
    }

    // 7. The readback the pins came from is not in the future of this snapshot.
    record('pins.readbackBlock <= snapshot block', pins.readbackBlock !== undefined && pins.readbackBlock <= blockNumber, `${pins.readbackBlock ?? '(unpinned)'} · snapshot ${blockNumber}`);
    report();
}

function report() {
    for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.check} — ${r.detail}`);
    const bad = results.filter((r) => !r.ok).length;
    console.log(bad ? `\nFAIL: ${bad}/${results.length} check(s) failed.` : `\nPASS: ${results.length}/${results.length} checks.`);
    process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
