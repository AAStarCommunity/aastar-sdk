
import { type Address, parseAbi, type WalletClient, type Hex } from 'viem';

const DVT_ABI = parseAbi([
    'function registerValidator(bytes)',
    'function createProposal(address, uint8, string)',
    'function signProposal(uint256, bytes)'
]);

export class DVTClient {
    static async registerValidator(wallet: WalletClient, dvtAddr: Address, blsPublicKey: Hex) {
        return wallet.writeContract({
            address: dvtAddr,
            abi: DVT_ABI,
            functionName: 'registerValidator',
            args: [blsPublicKey]
        });
    }
    
    // Additional methods for proposal creation/signing would go here
}
