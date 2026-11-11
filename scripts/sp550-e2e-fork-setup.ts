/**
 * `--fork-setup` for scripts/sp550-live-e2e.ts: on a LOCAL ANVIL FORK ONLY, put the user into the
 * state step 3 checks for, using anvil impersonation instead of any key. Live mode never calls it.
 *
 * Every address comes from the chain, starting at the SuperPaymaster the read-back gate passed:
 * the community is the operator token's communityOwner(), staking/GToken come from the Registry.
 * Each step runs only when its precondition is not met already, and step 3 of the E2E re-checks
 * everything afterwards, so this cannot make a run pass that the chain state would not.
 *
 *   account deployed     SimpleAccountFactory.createAccount(owner, salt), sent by the community
 *   ENDUSER role         Registry.safeMintForRole(ROLE_ENDUSER, account, (community, minStake)),
 *                        GToken approved to the staking contract by the community
 *   xPNTs balance        token.mint(account, amount), sent by the community
 *   renewalMode == SP_K  token.setRenewalMode(SP_K), sent by the account itself (impersonated)
 *
 * Not set up, and refused by step 3 if wrong: autoRenewUsed < K (only spending renewals moves it).
 */
import {
    type Address, type PublicClient, createWalletClient, encodeAbiParameters, getAddress, http, parseEther,
} from 'viem';
import { GTokenABI, GTokenStakingABI, RegistryABI, SimpleAccountFactoryABI, xPNTsTokenV2ABI } from '@aastar/core';

export type ForkSetupInput = {
    pub: PublicClient;
    rpcUrl: string;
    registry: Address;
    token: Address;
    account: Address;
    /** The key that owns `account` (anvil's public mnemonic in fork mode). */
    owner: Address;
    roleEnduser: `0x${string}`;
    modeSpK: number;
    /** SimpleAccountFactory, used only when `account` has no code; its getAddress(owner, salt) must equal `account`. */
    simpleAccountFactory?: Address;
    salt?: bigint;
    mintAmount?: bigint;
    log: (line: string) => void;
};

export async function forkSetup(i: ForkSetupInput): Promise<void> {
    const { pub } = i;
    const client = String(await pub.request({ method: 'web3_clientVersion' as any }));
    if (!/^anvil\//i.test(client)) throw new Error(`--fork-setup impersonates accounts and needs anvil; this RPC is "${client}"`);
    const fund = (a: Address) => pub.request({ method: 'anvil_setBalance' as any, params: [a, '0xDE0B6B3A7640000'] as any });
    const as = async (from: Address, req: { address: Address; abi: any; functionName: string; args: unknown[] }, step: string) => {
        await pub.request({ method: 'anvil_impersonateAccount' as any, params: [from] as any });
        await fund(from);
        const w = createWalletClient({ account: from, transport: http(i.rpcUrl) });
        const hash = await w.writeContract({ ...req, account: from, chain: pub.chain ?? null } as any);
        const rc = await pub.waitForTransactionReceipt({ hash });
        if (rc.status !== 'success') throw new Error(`fork setup "${step}" reverted (${hash})`);
        i.log(`fork setup: ${step} · tx ${hash}`);
    };
    const community = getAddress((await pub.readContract({ address: i.token, abi: xPNTsTokenV2ABI, functionName: 'communityOwner' })) as Address);

    if (((await pub.getCode({ address: i.account })) ?? '0x') === '0x') {
        const factory = i.simpleAccountFactory ?? (() => { throw new Error(`account ${i.account} has no code and no simpleAccountFactory was given`); })();
        const salt = i.salt ?? 0n;
        const predicted = getAddress((await pub.readContract({ address: factory, abi: SimpleAccountFactoryABI, functionName: 'getAddress', args: [i.owner, salt] })) as Address);
        if (predicted !== getAddress(i.account)) throw new Error(`factory ${factory} predicts ${predicted} for (${i.owner}, ${salt}), not the configured account ${i.account}`);
        await as(community, { address: factory, abi: SimpleAccountFactoryABI, functionName: 'createAccount', args: [i.owner, salt] }, 'createAccount');
    }

    if (!(await pub.readContract({ address: i.registry, abi: RegistryABI, functionName: 'hasRole', args: [i.roleEnduser, i.account] }))) {
        const staking = (await pub.readContract({ address: i.registry, abi: RegistryABI, functionName: 'GTOKEN_STAKING' })) as Address;
        const gToken = (await pub.readContract({ address: staking, abi: GTokenStakingABI, functionName: 'GTOKEN' })) as Address;
        const cfg = (await pub.readContract({ address: i.registry, abi: RegistryABI, functionName: 'getRoleConfig', args: [i.roleEnduser] })) as any;
        const minStake = BigInt(cfg.minStake), ticket = BigInt(cfg.ticketPrice);
        await as(community, { address: gToken, abi: GTokenABI, functionName: 'approve', args: [staking, minStake + ticket] }, `GToken.approve(staking, ${minStake + ticket})`);
        const data = encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [community, minStake]);
        await as(community, { address: i.registry, abi: RegistryABI, functionName: 'safeMintForRole', args: [i.roleEnduser, i.account, data] }, 'Registry.safeMintForRole(ENDUSER)');
    }

    if (((await pub.readContract({ address: i.token, abi: xPNTsTokenV2ABI, functionName: 'balanceOf', args: [i.account] })) as bigint) === 0n) {
        await as(community, { address: i.token, abi: xPNTsTokenV2ABI, functionName: 'mint', args: [i.account, i.mintAmount ?? parseEther('1000')] }, 'xPNTs.mint');
    }

    if (Number(await pub.readContract({ address: i.token, abi: xPNTsTokenV2ABI, functionName: 'renewalMode', args: [i.account] })) !== i.modeSpK) {
        await as(i.account, { address: i.token, abi: xPNTsTokenV2ABI, functionName: 'setRenewalMode', args: [i.modeSpK] }, 'xPNTs.setRenewalMode(SP_K) by the account');
    }
    await pub.request({ method: 'anvil_stopImpersonatingAccount' as any, params: [community] as any });
    await pub.request({ method: 'anvil_stopImpersonatingAccount' as any, params: [i.account] as any });
}
