
import { REGISTRY_ABI } from '@aastar/core';
import { type Address, type PublicClient, type WalletClient, type Hex } from 'viem';

export class RegistryClient {
    constructor(private client: PublicClient, private registryAddress: Address) {}

    async hasRole(role: Hex, user: Address): Promise<boolean> {
        return this.client.readContract({
            address: this.registryAddress,
            abi: REGISTRY_ABI,
            functionName: 'hasRole',
            args: [role, user]
        });
    }

    async getCreditLimit(user: Address): Promise<bigint> {
        return this.client.readContract({
            address: this.registryAddress,
            abi: REGISTRY_ABI,
            functionName: 'getCreditLimit',
            args: [user]
        });
    }

    // Write methods would require a WalletClient
    static async registerRole(wallet: WalletClient, registry: Address, role: Hex, user: Address, proof: Hex) {
        return wallet.writeContract({
            address: registry,
            abi: REGISTRY_ABI,
            functionName: 'registerRole',
            args: [role, user, proof],
            chain: wallet.chain
        } as any);
    }

    static async createNewRole(
        wallet: WalletClient, 
        registry: Address, 
        role: Hex, 
        config: { minStake: bigint; exitFeeBps: bigint; roleOwner: Address; isActive: boolean },
        owner: Address
    ) {
        return wallet.writeContract({
            address: registry,
            abi: REGISTRY_ABI,
            functionName: 'createNewRole',
            args: [role, [config.minStake, config.exitFeeBps, config.roleOwner, config.isActive], owner],
            chain: wallet.chain
        } as any);
    }
}
