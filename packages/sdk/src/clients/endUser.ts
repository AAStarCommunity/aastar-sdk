import { createClient, type Client, type Transport, type Chain, type Account, publicActions, walletActions, type PublicActions, type WalletActions, type Address, type Hex, type Hash, parseAbi } from 'viem';
import { 
    registryActions, 
    sbtActions,
    superPaymasterActions,
    paymasterV4Actions,
    type RegistryActions, 
    type SBTActions, 
    type SuperPaymasterActions, 
    type PaymasterV4Actions,
    CORE_ADDRESSES, 
    TOKEN_ADDRESSES,
    RegistryABI
} from '@aastar/core';

export type EndUserClient = Client<Transport, Chain, Account | undefined> & PublicActions<Transport, Chain, Account | undefined> & WalletActions<Chain, Account | undefined> & RegistryActions & SBTActions & SuperPaymasterActions & PaymasterV4Actions & {
    /**
     * High-level API: Onboard user to community with automatic funding
     */
    onboard: (args: {
        community: Address,
        roleId: Hex,
        roleData: Hex
    }) => Promise<{ tx: Hash, sbtId: bigint }>
    /**
     * Orchestrates the user joining a community and activating gas credit flow:
     * 1. Mint SBT for the community (Register ENDUSER role)
     * 2. Verify Credit is active (Reputation check)
     */
    joinAndActivate: (args: {
        community: Address,
        roleId: Hex,
        roleData?: Hex
    }) => Promise<{ tx: Hash, sbtId: bigint, initialCredit: bigint }>
    /**
     * Executes a gasless transaction via SuperPaymaster.
     */
    executeGasless: (args: {
        target: Address,
        data: Hex,
        value?: bigint,
        operator: Address
    }) => Promise<Hash>
};

export function createEndUserClient({
    chain,
    transport,
    account,
    addresses
}: {
    chain: Chain,
    transport: Transport,
    account?: Account,
    addresses?: { [key: string]: Address }
}): EndUserClient {
    const client = createClient({
        chain,
        transport,
        account
    })
    .extend(publicActions)
    .extend(walletActions);

    const usedAddresses = { ...CORE_ADDRESSES, ...TOKEN_ADDRESSES, ...addresses };

    const actions = {
        ...registryActions(usedAddresses.registry)(client as any),
        ...sbtActions(usedAddresses.mySBT)(client as any),
        ...superPaymasterActions(usedAddresses.superPaymaster)(client as any),
        ...paymasterV4Actions()(client as any)
    };

    return Object.assign(client, actions, {
        async onboard({ community, roleId, roleData }: {
            community: Address,
            roleId: Hex,
            roleData: Hex
        }) {
            console.log('👤 Onboarding user to community...');
            const result = await (this as any).joinAndActivate({ community, roleId, roleData });
            console.log(`✅ User onboarded! SBT ID: ${result.sbtId}`);
            return { tx: result.tx, sbtId: result.sbtId };
        },
        async joinAndActivate({ community, roleId, roleData }: { 
            community: Address, 
            roleId: Hex, 
            roleData?: Hex 
        }) {
            const accountToUse = account;
            if (!accountToUse) throw new Error("Account required for joinAndActivate");

            console.log(`   SDK: Joining community ${community}...`);
            
            // 1. SBT Mint / Role Registration
            // If roleData not provided, default to standard enduser data (usually user address or community reference)
            const finalData = roleData || `0x000000000000000000000000${community.slice(2)}` as Hex;

            const regTx = await (client as any).writeContract({
                address: usedAddresses.registry,
                abi: RegistryABI,
                functionName: 'registerRole',
                args: [roleId, accountToUse.address, finalData],
                account: accountToUse,
                chain
            });
            await (client as any).waitForTransactionReceipt({ hash: regTx });

            // 2. Fetch SBT ID
            const sbtId = await actions.getUserSBTId({ user: accountToUse.address });
            console.log(`   SDK: User joined. SBT ID: ${sbtId}`);

            // 3. Fetch Initial Credit for verification
            // Get the xPNTs token for this community from Factory first
            const factoryAbi = parseAbi(['function communityToToken(address) view returns (address)']);
            const tokenAddress = await (client as any).readContract({
                address: usedAddresses.xPNTsFactory,
                abi: factoryAbi,
                functionName: 'communityToToken',
                args: [community]
            }) as Address;

            const credit = await actions.getAvailableCredit({
                user: (client as any).aaAddress || accountToUse.address, // Use AA if context exists, else EOA
                token: tokenAddress
            });

            console.log(`   SDK: Activation complete. Current Credit: ${credit} points.`);

            return { tx: regTx, sbtId, initialCredit: credit };
        },
        async executeGasless({ target, data, value = 0n, operator }: { 
            target: Address, 
            data: Hex, 
            value?: bigint, 
            operator: Address 
        }) {
            console.log(`   SDK: Executing gasless transaction to ${target}...`);
            // This is a simplified wrapper for sending a UserOp.
            // In a real scenario, this would involve more setup (bundler, etc.)
            // For now, we simulate the SDK's high-level intent.
            throw new Error("executeGasless requires a configured Bundler/EP context (Work In Progress)");
        }
    }) as EndUserClient;
}
