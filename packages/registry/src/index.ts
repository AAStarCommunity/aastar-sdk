import { REGISTRY_ABI } from '@aastar/core';
import { type Address, type PublicClient, type WalletClient, type Hex, keccak256, encodeAbiParameters, parseAbi } from 'viem';

export const ROLES = {
    COMMUNITY: keccak256(new TextEncoder().encode("COMMUNITY")),
    ENDUSER: keccak256(new TextEncoder().encode("ENDUSER")),
    PAYMASTER_AOA: keccak256(new TextEncoder().encode("PAYMASTER_AOA")),
    PAYMASTER_SUPER: keccak256(new TextEncoder().encode("PAYMASTER_SUPER")),
    KMS: keccak256(new TextEncoder().encode("KMS")),
    ANODE: keccak256(new TextEncoder().encode("ANODE"))
} as const;

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

    async getGlobalReputation(user: Address): Promise<bigint> {
        return this.client.readContract({
            address: this.registryAddress,
            abi: parseAbi(['function globalReputation(address) view returns (uint256)']),
            functionName: 'globalReputation',
            args: [user]
        });
    }

    async getSBTTokenId(role: Hex, user: Address): Promise<bigint> {
        return this.client.readContract({
            address: this.registryAddress,
            abi: parseAbi(['function roleSBTTokenIds(bytes32, address) view returns (uint256)']),
            functionName: 'roleSBTTokenIds',
            args: [role, user]
        });
    }

    // Write methods
    static async registerRole(wallet: WalletClient, registry: Address, role: Hex, user: Address, roleData: Hex) {
        return wallet.writeContract({
            address: registry,
            abi: REGISTRY_ABI,
            functionName: 'registerRole',
            args: [role, user, roleData],
            chain: wallet.chain
        } as any);
    }

    /**
     * @notice One-stop Community Registration
     */
    static async registerCommunity(wallet: WalletClient, registry: Address, data: { name: string, ensName: string, website: string, description: string, logoURI: string, stakeAmount: bigint }) {
        const encodedData = encodeAbiParameters(
            [{ type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'uint256' }],
            [data.name, data.ensName, data.website, data.description, data.logoURI, data.stakeAmount]
        );
        return this.registerRole(wallet, registry, ROLES.COMMUNITY, wallet.account!.address, encodedData);
    }

    /**
     * @notice One-stop EndUser Registration
     */
    static async registerEndUser(wallet: WalletClient, registry: Address, data: { account: Address, community: Address, avatarURI: string, ensName: string, stakeAmount: bigint }) {
        const encodedData = encodeAbiParameters(
            [{ type: 'address' }, { type: 'address' }, { type: 'string' }, { type: 'string' }, { type: 'uint256' }],
            [data.account, data.community, data.avatarURI, data.ensName, data.stakeAmount]
        );
        return this.registerRole(wallet, registry, ROLES.ENDUSER, wallet.account!.address, encodedData);
    }

    static async createNewRole(
        wallet: WalletClient, 
        registry: Address, 
        role: Hex, 
        config: { minStake: bigint; entryBurn: bigint; exitFeePercent: bigint; minExitFee: bigint; active: boolean; desc: string },
        owner: Address
    ) {
        return wallet.writeContract({
            address: registry,
            abi: REGISTRY_ABI,
            functionName: 'createNewRole',
            args: [role, [config.minStake, config.entryBurn, 0, 0, 0, 0, config.exitFeePercent, config.minExitFee, config.active, config.desc], owner],
            chain: wallet.chain
        } as any);
    }

    static async batchUpdateReputation(wallet: WalletClient, registry: Address, users: Address[], scores: bigint[], epoch: bigint, proof: Hex = '0x') {
        return wallet.writeContract({
            address: registry,
            abi: parseAbi(['function batchUpdateGlobalReputation(address[], uint256[], uint256, bytes)']),
            functionName: 'batchUpdateGlobalReputation',
            args: [users, scores, epoch, proof],
            chain: wallet.chain
        } as any);
    }
}
