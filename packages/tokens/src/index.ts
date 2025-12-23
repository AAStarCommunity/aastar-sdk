import { type Address, type WalletClient, type Hex, parseAbi } from 'viem';

const XPNTS_ABI = parseAbi([
    'function mint(address, uint256)',
    'function burn(address, uint256)',
    'function recordDebt(address, uint256)',
    'function getDebt(address) view returns (uint256)',
    'function setSuperPaymasterAddress(address)'
]);

const SBT_ABI = parseAbi([
    'function mint(address, bytes32, string)',
    'function burn(address)',
    'function isTokenActive(address) view returns (bool)'
]);

export class TokensClient {
    /**
     * @notice Handle xPNTs (Community tokens)
     */
    static async mintXPNTs(wallet: WalletClient, token: Address, to: Address, amount: bigint) {
        return wallet.writeContract({
            address: token,
            abi: XPNTS_ABI,
            functionName: 'mint',
            args: [to, amount],
            chain: wallet.chain
        } as any);
    }

    /**
     * @notice Handle MySBT (Identity tokens)
     * @dev In V3, MySBT is usually minted as part of Registry.registerRole
     */
    static async isSBTActive(client: any, sbt: Address, user: Address): Promise<boolean> {
        return client.readContract({
            address: sbt,
            abi: SBT_ABI,
            functionName: 'isTokenActive',
            args: [user]
        });
    }

    static async mintSBT(wallet: WalletClient, sbt: Address, to: Address, data: { role: Hex, metadataURI: string }) {
        return wallet.writeContract({
            address: sbt,
            abi: SBT_ABI,
            functionName: 'mint',
            args: [to, data.role, data.metadataURI],
            chain: wallet.chain
        } as any);
    }
}

/**
 * Generic ERC20 Client for PNTs and other assets
 */
export class ERC20Client {
    static async balanceOf(client: any, token: Address, user: Address): Promise<bigint> {
        return client.readContract({
            address: token,
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [user]
        });
    }

    static async transfer(wallet: any, token: Address, to: Address, amount: bigint) {
        return wallet.writeContract({
            address: token,
            abi: parseAbi(['function transfer(address, uint256) returns (bool)']),
            functionName: 'transfer',
            args: [to, amount],
            chain: wallet.chain
        } as any);
    }

    static async allowance(client: any, token: Address, owner: Address, spender: Address): Promise<bigint> {
        return client.readContract({
            address: token,
            abi: parseAbi(['function allowance(address, address) view returns (uint256)']),
            functionName: 'allowance',
            args: [owner, spender]
        });
    }

    static async approve(wallet: any, token: Address, spender: Address, amount: bigint) {
        return wallet.writeContract({
            address: token,
            abi: parseAbi(['function approve(address, uint256) returns (bool)']),
            functionName: 'approve',
            args: [spender, amount],
            chain: wallet.chain
        } as any);
    }
}
