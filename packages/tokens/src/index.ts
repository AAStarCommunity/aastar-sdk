
import { type Address, type WalletClient, parseAbi } from 'viem';

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
}
