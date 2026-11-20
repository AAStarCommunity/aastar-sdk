/**
 * Fork rehearsal input (DSR 2026-11-19): a DeployLive deployment config read DIRECTLY, for mode fork only. A live run
 * is held against the read-back gate and the SDK's own pins; this path exists so the joint fork rehearsal (SP's
 * acceptance fork: a Sepolia fork, chain 11155111, with a production-path DeployLive deploy) can run the live cells
 * before any pin is filled.
 *
 * What it checks instead of the gate (all on the fork, all read-only): the RPC is an anvil fork reporting the
 * network's chain id, every mapped address has code, and SuperPaymaster's own wiring names the config's contracts.
 */
import { getAddress, isAddress, type Address } from 'viem';
import { SP550_ADDRESS_OWNER } from '../packages/core/src/sp550Deployments.js';
import { RegistryABI, SuperPaymasterV550ABI } from '../packages/core/src/abis/index.js';

const ZERO = '0x0000000000000000000000000000000000000000' as Address;

/**
 * Address-book key -> DeployLive config key. Same name unless listed. xPNTsFactory is the V2 factory (DSR
 * 2026-11-19: rc.8's SuperPaymaster refuses v1 tokens; the V1 factory stays in the deploy only for compatibility).
 */
export const DEPLOYLIVE_KEY_FOR: Readonly<Record<string, string>> = { xPNTsFactory: 'xPNTsFactoryV2' };
/** External entries a DeployLive config carries (the rest of the external book stays the shipped one). */
export const DEPLOYLIVE_EXTERNAL_KEYS = ['entryPoint', 'priceFeed', 'simpleAccountFactory'] as const;

export interface ForkAddressSet {
    addresses: Record<string, Address>;
    /** SP-owned book keys the config does not carry: set to the zero address (not deployed). */
    notDeployed: string[];
    /** Required ('sp') book keys the config does not carry: the set is unusable. */
    missingRequired: string[];
    /** The config's own provenance fields, printed with every RESULT. */
    provenance: { commit?: string; srcHash?: string; deploymentStartBlock?: unknown };
}

/** The complete address set a DeployLive config stands for, in the SDK's book keys (plus the client aliases). */
export function forkAddressSetFromDeployLive(config: Record<string, unknown>, shipped: Record<string, unknown>): ForkAddressSet {
    const addresses: Record<string, Address> = {};
    const notDeployed: string[] = [], missingRequired: string[] = [];
    const take = (k: string): Address | undefined => {
        const v = config[DEPLOYLIVE_KEY_FOR[k] ?? k];
        return typeof v === 'string' && isAddress(v, { strict: false }) && !/^0x0{40}$/i.test(v) ? getAddress(v) : undefined;
    };
    for (const [k, owner] of Object.entries(SP550_ADDRESS_OWNER)) {
        if (k === 'timelockControllerLegacy') { addresses[k] = ZERO; continue; } // the shipped stack's history, not this one's
        if (owner === 'external') {
            const v = (DEPLOYLIVE_EXTERNAL_KEYS as readonly string[]).includes(k) ? take(k) : undefined;
            const s = shipped[k];
            if (v) addresses[k] = v;
            else if (typeof s === 'string' && isAddress(s, { strict: false })) addresses[k] = getAddress(s);
            continue;
        }
        const v = take(k);
        if (v) addresses[k] = v;
        else { addresses[k] = ZERO; (owner === 'sp' ? missingRequired : notDeployed).push(k); }
    }
    // The book's generic V4 paymaster is the community aPNTs paymaster when the deploy names only that one.
    if (addresses.paymasterV4 === ZERO && addresses.aPNTsPaymasterV4 !== ZERO) {
        addresses.paymasterV4 = addresses.aPNTsPaymasterV4;
        notDeployed.splice(notDeployed.indexOf('paymasterV4'), 1);
    }
    addresses.gTokenStaking = addresses.staking;
    addresses.mySBT = addresses.sbt;
    const str = (x: unknown) => (typeof x === 'string' ? x : undefined);
    return { addresses, notDeployed, missingRequired, provenance: { commit: str(config.commit), srcHash: str(config.srcHash), deploymentStartBlock: config.deploymentStartBlock } };
}

type ForkReader = {
    getCode(a: { address: Address }): Promise<string | undefined>;
    readContract(a: { address: Address; abi: any; functionName: string; args?: unknown[] }): Promise<unknown>;
};

/** Everything that makes a DeployLive address set unusable on this fork (empty = usable for the rehearsal). */
export async function forkAddressSetProblems(read: ForkReader, set: ForkAddressSet): Promise<string[]> {
    const p: string[] = set.missingRequired.map((k) => `config has no ${k} (a required SP contract)`);
    if (p.length) return p;
    const a = set.addresses;
    for (const [k, v] of Object.entries(a)) {
        if (v === ZERO || k === 'gTokenStaking' || k === 'mySBT') continue;
        const code = await read.getCode({ address: v }).catch(() => undefined);
        if (!code || code === '0x') p.push(`${k} ${v} has no code on the fork`);
    }
    const eq = (x: unknown, y: string) => typeof x === 'string' && x.toLowerCase() === y.toLowerCase();
    const sp = a.superPaymaster;
    const r = (address: Address, abi: any, functionName: string) => read.readContract({ address, abi, functionName }).catch((e) => `ERR ${e?.shortMessage ?? e?.message}`);
    const legs: [string, unknown, string][] = [
        ['SP.REGISTRY()', await r(sp, SuperPaymasterV550ABI, 'REGISTRY'), a.registry],
        ['SP.entryPoint()', await r(sp, SuperPaymasterV550ABI, 'entryPoint'), a.entryPoint],
        ['SP.APNTS_TOKEN()', await r(sp, SuperPaymasterV550ABI, 'APNTS_TOKEN'), a.aPNTs],
        ['SP.xpntsFactory()', await r(sp, SuperPaymasterV550ABI, 'xpntsFactory'), a.xPNTsFactory],
        // The ERC-8004 pointers: the config's registry, or zero when it deploys none (SP has no validation getter).
        ['SP.agentIdentityRegistry()', await r(sp, SuperPaymasterV550ABI, 'agentIdentityRegistry'), a.agentIdentityRegistry],
        ['SP.agentReputationRegistry()', await r(sp, SuperPaymasterV550ABI, 'agentReputationRegistry'), a.agentReputationRegistry],
        ['Registry.SUPER_PAYMASTER()', await r(a.registry, RegistryABI, 'SUPER_PAYMASTER'), sp],
        ['Registry.GTOKEN_STAKING()', await r(a.registry, RegistryABI, 'GTOKEN_STAKING'), a.staking],
        ['Registry.MYSBT()', await r(a.registry, RegistryABI, 'MYSBT'), a.sbt],
    ];
    for (const [label, got, want] of legs) if (!eq(got, want)) p.push(`${label} = ${String(got)}, config says ${want}`);
    return p;
}

/** A fork RPC that is not loopback is accepted only when it reports an anvil client (never a real network). */
export function isAnvilClient(clientVersion: unknown): boolean {
    return typeof clientVersion === 'string' && /^anvil\//i.test(clientVersion);
}
