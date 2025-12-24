
import { type Address, type WalletClient, parseAbi } from 'viem';

const PM_V4_ABI = parseAbi([
    'function setVerifyingSigner(address)',
    'function setUnaccountedGas(uint256)',
    'function deposit() payable',
    'function getDeposit() view returns (uint256)',
    'function owner() view returns (address)'
]);

const PM_FACTORY_ABI = parseAbi([
    'function deployPaymaster(string, bytes) returns (address)',
    'function getPaymaster(address, string, bytes) view returns (address)'
]);

export class StandalonePaymasterClient {
    /**
     * @notice Deploy a standalone V4 Paymaster
     */
    static async deployStandalone(wallet: WalletClient, factory: Address, version: string, initData: `0x${string}`) {
        return wallet.writeContract({
            address: factory,
            abi: PM_FACTORY_ABI,
            functionName: 'deployPaymaster',
            args: [version, initData],
            chain: wallet.chain
        } as any);
    }

    /**
     * @notice Configure a standalone Paymaster
     */
    static async setSigner(wallet: WalletClient, paymaster: Address, signer: Address) {
        return wallet.writeContract({
            address: paymaster,
            abi: PM_V4_ABI,
            functionName: 'setVerifyingSigner',
            args: [signer],
            chain: wallet.chain
        } as any);
    }
}
