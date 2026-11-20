import { describe, it, expect } from 'vitest';
import { getAddress, type Address } from 'viem';
import { DEPLOYLIVE_EXTERNAL_KEYS, forkAddressSetFromDeployLive, forkAddressSetProblems, isAnvilClient } from './sp550-deploylive-fork.js';
import { SP550_ADDRESS_OWNER } from '../packages/core/src/sp550Deployments.js';

const A = (n: number) => getAddress('0x' + n.toString(16).padStart(40, '0')) as Address;
// The shape of a DeployLive config (keys as SP's DeployLive writes them; addresses are fixtures).
const CONFIG: Record<string, unknown> = {
    registry: A(0x101), gToken: A(0x102), staking: A(0x103), sbt: A(0x104), reputationSystem: A(0x105), superPaymaster: A(0x106),
    paymasterFactory: A(0x107), paymasterV4Impl: A(0x108), blsAggregator: A(0x109), dvtValidator: A(0x10a), aPNTs: A(0x10b),
    agentIdentityRegistry: A(0x10c), agentReputationRegistry: A(0x10d), agentValidationRegistry: A(0x10e), policyRegistry: A(0x10f),
    x402Facilitator: A(0x110), timelockController: A(0x111), aPNTsPaymasterV4: A(0x112), pnts: A(0x113), xPNTsFactory: A(0x114),
    xPNTsFactoryV2: A(0x115), microPaymentChannel: A(0x116), entryPoint: A(0x117), priceFeed: A(0x118), simpleAccountFactory: A(0x119),
    srcHash: '', deploymentStartBlock: 1, updateTime: 'N/A',
};
const SHIPPED = Object.fromEntries(Object.keys(SP550_ADDRESS_OWNER).map((k, i) => [k, A(0x900 + i)]));

describe('a DeployLive config as the SDK address set (fork rehearsal only)', () => {
    it('maps every book key: SP entries from the config, xPNTsFactory = the V2 factory, undeployed = zero, aliases set', () => {
        const s = forkAddressSetFromDeployLive(CONFIG, SHIPPED);
        expect(s.missingRequired).toEqual([]);
        expect(s.addresses.registry).toBe(CONFIG.registry);
        expect(s.addresses.xPNTsFactory).toBe(CONFIG.xPNTsFactoryV2); // not the V1 factory
        expect(s.addresses.paymasterV4).toBe(CONFIG.aPNTsPaymasterV4); // the book's generic V4 = the aPNTs instance
        expect(s.addresses.PNTsPaymasterV4).toBe('0x0000000000000000000000000000000000000000');
        expect(s.addresses.blsValidator).toBe('0x0000000000000000000000000000000000000000');
        expect(s.notDeployed.sort()).toEqual(['PNTsPaymasterV4', 'blsValidator']);
        expect(s.addresses.gTokenStaking).toBe(CONFIG.staking);
        expect(s.addresses.mySBT).toBe(CONFIG.sbt);
        for (const k of DEPLOYLIVE_EXTERNAL_KEYS) expect(s.addresses[k]).toBe(CONFIG[k]);
        expect(s.addresses.aaStarValidator).toBe(SHIPPED.aaStarValidator); // an external the config does not carry
        expect(s.addresses.timelockControllerLegacy).toBe('0x0000000000000000000000000000000000000000');
        for (const k of Object.keys(SP550_ADDRESS_OWNER)) expect(s.addresses[k], k).toBeDefined();
    });

    it('a config without a required SP contract is unusable', async () => {
        const { sbt: _s, ...rest } = CONFIG;
        const s = forkAddressSetFromDeployLive(rest, SHIPPED);
        expect(s.missingRequired).toEqual(['sbt']);
        expect(await forkAddressSetProblems({ getCode: async () => '0x60', readContract: async () => A(0) }, s)).toEqual(['config has no sbt (a required SP contract)']);
    });

    it('agent registries at zero (ENABLE_AGENT_REGISTRIES=0, the Sepolia rc.8 release) are not deployed, not missing (DSR 2026-11-20)', () => {
        const Z = '0x0000000000000000000000000000000000000000';
        const s = forkAddressSetFromDeployLive({ ...CONFIG, agentIdentityRegistry: Z, agentReputationRegistry: Z, agentValidationRegistry: Z }, SHIPPED);
        expect(s.missingRequired).toEqual([]);
        expect(s.notDeployed.sort()).toEqual(['PNTsPaymasterV4', 'agentIdentityRegistry', 'agentReputationRegistry', 'agentValidationRegistry', 'blsValidator']);
        for (const k of ['agentIdentityRegistry', 'agentReputationRegistry', 'agentValidationRegistry']) expect(s.addresses[k]).toBe(Z);
    });

    it('checks on the fork: code at every mapped address, and SP / Registry wiring naming the config\'s contracts', async () => {
        const s = forkAddressSetFromDeployLive(CONFIG, SHIPPED);
        const wiring: Record<string, Address> = {
            [`${CONFIG.superPaymaster}.REGISTRY`]: CONFIG.registry as Address, [`${CONFIG.superPaymaster}.entryPoint`]: CONFIG.entryPoint as Address,
            [`${CONFIG.superPaymaster}.APNTS_TOKEN`]: CONFIG.aPNTs as Address, [`${CONFIG.superPaymaster}.xpntsFactory`]: CONFIG.xPNTsFactoryV2 as Address,
            [`${CONFIG.registry}.SUPER_PAYMASTER`]: CONFIG.superPaymaster as Address, [`${CONFIG.registry}.GTOKEN_STAKING`]: CONFIG.staking as Address,
            [`${CONFIG.registry}.MYSBT`]: CONFIG.sbt as Address,
            [`${CONFIG.superPaymaster}.agentIdentityRegistry`]: CONFIG.agentIdentityRegistry as Address,
            [`${CONFIG.superPaymaster}.agentReputationRegistry`]: CONFIG.agentReputationRegistry as Address,
        };
        const reader = (over: Record<string, unknown> = {}, noCode: string[] = []) => ({
            getCode: async ({ address }: { address: Address }) => (noCode.includes(address) ? '0x' : '0x6080'),
            readContract: async ({ address, functionName }: any) => ({ ...wiring, ...over })[`${address}.${functionName}`],
        });
        expect(await forkAddressSetProblems(reader(), s)).toEqual([]);
        expect(await forkAddressSetProblems(reader({ [`${CONFIG.registry}.GTOKEN_STAKING`]: A(0x555) }), s)).toEqual([expect.stringMatching(/^Registry.GTOKEN_STAKING\(\) = .* config says/)]);
        expect(await forkAddressSetProblems(reader({}, [CONFIG.policyRegistry as string]), s)).toEqual([`policyRegistry ${CONFIG.policyRegistry} has no code on the fork`]);
    });

    it('the ERC-8004 pointers on the fork: zero in the config holds SP to zero, and SP naming a registry then fails', async () => {
        const Z = '0x0000000000000000000000000000000000000000' as Address;
        const cfg = { ...CONFIG, agentIdentityRegistry: Z, agentReputationRegistry: Z, agentValidationRegistry: Z };
        const s = forkAddressSetFromDeployLive(cfg, SHIPPED);
        const sp = CONFIG.superPaymaster as Address;
        const wiring: Record<string, unknown> = {
            [`${sp}.REGISTRY`]: CONFIG.registry, [`${sp}.entryPoint`]: CONFIG.entryPoint, [`${sp}.APNTS_TOKEN`]: CONFIG.aPNTs,
            [`${sp}.xpntsFactory`]: CONFIG.xPNTsFactoryV2, [`${CONFIG.registry}.SUPER_PAYMASTER`]: sp,
            [`${CONFIG.registry}.GTOKEN_STAKING`]: CONFIG.staking, [`${CONFIG.registry}.MYSBT`]: CONFIG.sbt,
            [`${sp}.agentIdentityRegistry`]: Z, [`${sp}.agentReputationRegistry`]: Z,
        };
        const reader = (over: Record<string, unknown> = {}) => ({
            getCode: async () => '0x6080', readContract: async ({ address, functionName }: any) => ({ ...wiring, ...over })[`${address}.${functionName}`],
        });
        expect(await forkAddressSetProblems(reader(), s)).toEqual([]);
        expect(await forkAddressSetProblems(reader({ [`${sp}.agentIdentityRegistry`]: A(0x8004) }), s))
            .toEqual([`SP.agentIdentityRegistry() = ${A(0x8004)}, config says ${Z}`]);
        expect(await forkAddressSetProblems(reader({ [`${sp}.agentReputationRegistry`]: A(0x8005) }), s))
            .toEqual([`SP.agentReputationRegistry() = ${A(0x8005)}, config says ${Z}`]);
    });

    it('a non-loopback fork RPC is accepted only as an anvil client', () => {
        expect(isAnvilClient('anvil/v1.7.1')).toBe(true);
        expect(isAnvilClient('Geth/v1.14.0')).toBe(false);
        expect(isAnvilClient(undefined)).toBe(false);
    });
});
