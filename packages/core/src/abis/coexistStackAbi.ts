/**
 * The functions and events the rc.8 live cells (S1, S1r, S3b, C12) and the read-back gate call on SuperPaymaster-
 * deployed contracts OUTSIDE the seven vendored 5.5.0 files (scripts/check-sp550-abis.ts). The SDK keeps these ABIs at
 * the deployed 5.4.2 generation; DSR (2026-11-19) asked for proof that, entry by entry, they equal the v5.5.0-rc.8
 * compiled artifacts (commit 5a150f6a) before not replacing them, and where they do not, a coexist set (rc8/) for that
 * stack only. scripts/coexist-stack-abi-pin.ts records the compiled side into fixtures/coexist-stack-abi.json;
 * coexistStackAbi.test.ts holds the vendored files to it.
 *
 * Two sources of entries per file: the explicit calls (gate comparisons, live-cell reads), and — for every ABI the
 * gate's exhaustive scan reads — every no-argument view whose outputs carry an address (the same rule the gate uses).
 */
import type { Abi } from 'viem';

type Want = { type: 'function' | 'event'; name: string };
const fns = (...names: string[]): Want[] => names.map((name) => ({ type: 'function', name }));

export const COEXIST_STACK_ENTRIES: Record<string, { artifact: string; explicit: Want[]; scanned: boolean }> = {
    // The rc.8 stack's gate reads Registry and the gToken through the coexist set (rc8/, SP550_COEXIST_SCAN_ABI): a
    // first run of this proof found the SDK-wide Registry.json without `pendingOwner()` and GToken.json without
    // GTokenAuthorization's `factory()` / `mySBT()`, so the scan would not have read them.
    'rc8/Registry.json': { artifact: 'Registry.sol/Registry.json', explicit: fns('blsAggregator', 'SUPER_PAYMASTER', 'GTOKEN_STAKING', 'MYSBT', 'version'), scanned: true },
    'rc8/GTokenAuthorization.json': { artifact: 'GTokenAuthorization.sol/GTokenAuthorization.json', explicit: fns('version'), scanned: true },
    // Code outside the gate (the live cells' role check) still reads Registry through the SDK-wide file.
    'Registry.json': { artifact: 'Registry.sol/Registry.json', explicit: fns('hasRole'), scanned: false },
    'GTokenStaking.json': { artifact: 'GTokenStaking.sol/GTokenStaking.json', explicit: fns('REGISTRY', 'GTOKEN', 'version'), scanned: true },
    'MySBT.json': { artifact: 'MySBT.sol/MySBT.json', explicit: fns('REGISTRY', 'GTOKEN_STAKING', 'GTOKEN', 'balanceOf'), scanned: true },
    'ReputationSystem.json': { artifact: 'ReputationSystem.sol/ReputationSystem.json', explicit: fns('REGISTRY'), scanned: true },
    'PaymasterFactory.json': { artifact: 'PaymasterFactory.sol/PaymasterFactory.json', explicit: fns('registry'), scanned: true },
    'Paymaster.json': { artifact: 'Paymaster.sol/Paymaster.json', explicit: fns('registry', 'entryPoint', 'ethUsdPriceFeed'), scanned: true },
    'BLSAggregator.json': { artifact: 'BLSAggregator.sol/BLSAggregator.json', explicit: fns('DVT_VALIDATOR', 'REGISTRY', 'SUPERPAYMASTER'), scanned: true },
    'DVTValidator.json': { artifact: 'DVTValidator.sol/DVTValidator.json', explicit: fns('BLS_AGGREGATOR', 'REGISTRY'), scanned: true },
    'PolicyRegistry.json': { artifact: 'PolicyRegistry.sol/PolicyRegistry.json', explicit: [], scanned: true },
    'X402Facilitator.json': { artifact: 'X402Facilitator.sol/X402Facilitator.json', explicit: fns('REGISTRY', 'XPNTS_FACTORY'), scanned: true },
    // The 3.x factory a fresh stack keeps (X402Facilitator.XPNTS_FACTORY, GTokenAuthorization.factory): DSR 2026-11-21.
    'xPNTsFactory.json': { artifact: 'xPNTsFactory.sol/xPNTsFactory.json', explicit: fns('REGISTRY', 'SUPERPAYMASTER'), scanned: true },
    'TimelockController.json': { artifact: 'TimelockController.sol/TimelockController.default.json', explicit: [], scanned: true },
    'MicroPaymentChannel.json': { artifact: 'MicroPaymentChannel.sol/MicroPaymentChannel.json', explicit: [], scanned: true },
};

/** The rule the gate's exhaustive scan uses: a no-argument view / pure whose outputs carry an address anywhere. */
const carries = (o: any): boolean => String(o.type).startsWith('address') || (String(o.type).startsWith('tuple') && (o.components ?? []).some(carries));
export const scannedGetters = (abi: Abi | any[]): Want[] => (abi as any[])
    .filter((e) => e.type === 'function' && (e.inputs ?? []).length === 0 && ['view', 'pure'].includes(e.stateMutability) && (e.outputs ?? []).some(carries))
    .map((e) => ({ type: 'function' as const, name: e.name as string }));

/** Every entry the proof covers for one file: explicit ∪ scanned getters, by name, once. */
export function coexistEntriesFor(file: string, sdkAbi: any[]): Want[] {
    const spec = COEXIST_STACK_ENTRIES[file];
    const all = [...spec.explicit, ...(spec.scanned ? scannedGetters(sdkAbi) : [])];
    const seen = new Set<string>();
    return all.filter((w) => { const k = `${w.type}:${w.name}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
