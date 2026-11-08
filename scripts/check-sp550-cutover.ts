#!/usr/bin/env tsx
/**
 * SuperPaymaster 5.5.0 cutover gate (read-only). Compares the cutover pins
 * (packages/core/src/sp550Cutover.ts, or a --pins JSON file) against the chain, field by field.
 *
 *   pnpm exec tsx scripts/check-sp550-cutover.ts --rpc <url> [--pins <file.json>] [--allow-rc]
 *
 * Exit 0 only if every required pin is filled AND every check reads back as pinned. A missing pin
 * is a failure that prints the value observed on chain — the pin must be written from a readback,
 * never from this script's output alone (DSR cutover work order). Sends no transaction.
 */
import * as fs from 'fs';
import { createPublicClient, http, keccak256, toHex, getAddress, type Address, type Hex } from 'viem';
import { SuperPaymasterV550ABI, SuperPaymasterLensABI } from '../packages/core/src/abis/index.js';
import { SP550_CUTOVER_PINS, missingSp550Pins, type Sp550CutoverPins } from '../packages/core/src/sp550Cutover.js';
import { CANONICAL_ADDRESSES } from '../packages/core/src/addresses.js';

const ERC1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const;
const EXPECTED_VERSION = 'SuperPaymaster-5.5.0';

const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const rpc = arg('--rpc') || process.env.RPC_URL;
const allowRc = args.includes('--allow-rc');
if (!rpc) { console.error('usage: check-sp550-cutover.ts --rpc <url> [--pins <file.json>] [--allow-rc]'); process.exit(2); }

const client = createPublicClient({ transport: http(rpc) });
const results: { check: string; ok: boolean; detail: string }[] = [];
const record = (check: string, ok: boolean, detail: string) => results.push({ check, ok, detail });
const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

async function main() {
    const chainId = await client.getChainId();
    const head = await client.getBlockNumber();
    let pins: Sp550CutoverPins;
    let source: string;
    const file = arg('--pins');
    if (file) {
        const j = JSON.parse(fs.readFileSync(file, 'utf8'));
        pins = { ...j, readbackBlock: j.readbackBlock !== undefined ? BigInt(j.readbackBlock) : undefined };
        source = file;
    } else {
        pins = SP550_CUTOVER_PINS[chainId] ?? {};
        source = `SP550_CUTOVER_PINS[${chainId}]`;
    }
    console.log(`=== SP 5.5.0 cutover gate — chain ${chainId}, head ${head}, pins from ${source} ===`);

    const missing = missingSp550Pins(pins);
    record('all required pins filled', missing.length === 0, missing.length ? `unpinned: ${missing.join(', ')}` : 'complete');

    // Unpinned proxy: still READ the canonical proxy, so the report shows what the chain holds
    // (the pin checks below keep failing until the pins are written).
    const sp = (pins.superPaymaster ?? (CANONICAL_ADDRESSES as Record<number, any>)[chainId]?.superPaymaster) as Address | undefined;
    if (!pins.superPaymaster) record('pins.superPaymaster', false, `(unpinned) — reading canonical proxy ${sp ?? 'none'}`);
    if (!sp) { report(); return; }
    const read = (functionName: string, address: Address = sp, abi: any = SuperPaymasterV550ABI) =>
        client.readContract({ address, abi, functionName } as any).catch((e: any) => `ERR ${e?.shortMessage ?? e?.message}`) as Promise<any>;

    const version = await read('version');
    record(`SP.version() == "${EXPECTED_VERSION}"`, version === EXPECTED_VERSION, String(version));

    const slot = await client.getStorageAt({ address: sp, slot: ERC1967_IMPL_SLOT });
    const impl = slot ? getAddress(('0x' + slot.slice(-40)) as Address) : undefined;
    record('ERC-1967 impl == pins.spImpl', eq(impl, pins.spImpl), `observed ${impl} · pinned ${pins.spImpl ?? '(unpinned)'}`);
    if (impl) {
        const code = await client.getCode({ address: impl });
        const hash = code && code !== '0x' ? keccak256(code) : undefined;
        record('keccak256(code(spImpl)) == pins.spImplCodehash', eq(hash, pins.spImplCodehash), `observed ${hash} · pinned ${pins.spImplCodehash ?? '(unpinned)'}`);
    }

    for (const k of ['superPaymasterLens', 'xPNTsFactoryV2', 'xPNTsTokenV2Impl', 'xPNTsTokenV2Ext', 'aoaProtocolRegistry', 'globalTierSource', 'aPNTsCapped'] as const) {
        const a = pins[k] as Address | undefined;
        if (!a) { record(`code at ${k}`, false, '(unpinned)'); continue; }
        const code = await client.getCode({ address: a });
        record(`code at ${k}`, !!code && code !== '0x', `${a} · ${code && code !== '0x' ? `${(code.length - 2) / 2} bytes` : 'NO CODE'}`);
    }

    const apnts = await read('APNTS_TOKEN');
    record('SP.APNTS_TOKEN() == pins.aPNTsCapped', eq(apnts, pins.aPNTsCapped), `observed ${apnts} · pinned ${pins.aPNTsCapped ?? '(unpinned)'}`);
    const factory = await read('xpntsFactory');
    record('SP.xpntsFactory() == pins.xPNTsFactoryV2', eq(factory, pins.xPNTsFactoryV2), `observed ${factory} · pinned ${pins.xPNTsFactoryV2 ?? '(unpinned)'}`);
    if (pins.superPaymasterLens) {
        const expected = await read('EXPECTED_SP_VERSION', pins.superPaymasterLens as Address, SuperPaymasterLensABI);
        const want = keccak256(toHex(EXPECTED_VERSION));
        record('Lens.EXPECTED_SP_VERSION() == keccak256("SuperPaymaster-5.5.0")', eq(expected, want), String(expected));
    }

    const tagOk = !!pins.tag && /^v5\.5\.\d+/.test(pins.tag) && (allowRc || !/-rc/i.test(pins.tag));
    record(`tag is a 5.5.x release${allowRc ? ' (rc allowed)' : ''}`, tagOk, pins.tag ?? '(unpinned)');
    record('readbackBlock <= head', pins.readbackBlock !== undefined && pins.readbackBlock <= head, `${pins.readbackBlock ?? '(unpinned)'} · head ${head}`);
    report();
}

function report() {
    for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.check} — ${r.detail}`);
    const bad = results.filter((r) => !r.ok).length;
    console.log(bad ? `\nFAIL: ${bad}/${results.length} check(s) failed.` : `\nPASS: ${results.length}/${results.length} checks.`);
    process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
