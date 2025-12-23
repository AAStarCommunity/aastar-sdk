
import { type Address, parseAbi, type WalletClient } from 'viem';
import { SUPERPAYMASTER_ABI } from '@aastar/core';

const STAKING_ABI = parseAbi([
    'function stake(uint256)',
    'function withdraw(uint256)'
]);

export class FinanceClient {
    static async depositToPaymaster(wallet: WalletClient, paymaster: Address, amount: bigint) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'deposit',
            args: [amount],
            chain: wallet.chain
        } as any);
    }

    static async depositViaTransferAndCall(wallet: WalletClient, token: Address, paymaster: Address, amount: bigint) {
        const ERC1363_ABI = [{
            name: 'transferAndCall',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
            outputs: [{ type: 'bool' }]
        }] as const;

        return wallet.writeContract({
            address: token,
            abi: ERC1363_ABI,
            functionName: 'transferAndCall',
            args: [paymaster, amount],
            chain: wallet.chain
        } as any);
    }

    static async stakeGToken(wallet: WalletClient, stakingAddr: Address, amount: bigint) {
         return wallet.writeContract({
            address: stakingAddr,
            abi: STAKING_ABI,
            functionName: 'stake',
            args: [amount],
            chain: wallet.chain
        } as any);
    }

    static async withdrawProtocolRevenue(wallet: WalletClient, paymaster: Address, to: Address, amount: bigint) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'withdrawProtocolRevenue',
            args: [to, amount],
            chain: wallet.chain
        } as any);
    }

    /**
     * @notice Handle EntryPoint deposits for Paymasters
     */
    static async depositToEntryPoint(wallet: WalletClient, entryPoint: Address, paymaster: Address, amount: bigint) {
        return wallet.writeContract({
            address: entryPoint,
            abi: parseAbi(['function depositTo(address) payable']),
            functionName: 'depositTo',
            args: [paymaster],
            value: amount,
            chain: wallet.chain
        } as any);
    }

    static async getEntryPointBalance(client: any, entryPoint: Address, account: Address): Promise<bigint> {
        return client.readContract({
            address: entryPoint,
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [account]
        });
    }

    /**
     * @notice SuperPaymaster Operator Balance Management
     */
    static async operatorDeposit(wallet: WalletClient, paymaster: Address, amount: bigint) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'deposit',
            args: [amount],
            chain: wallet.chain
        } as any);
    }

    static async operatorNotifyDeposit(wallet: WalletClient, paymaster: Address, amount: bigint) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'notifyDeposit',
            args: [amount],
            chain: wallet.chain
        } as any);
    }

    /**
     * @notice Self-service GToken to xPNTs conversion
     * @dev Usually consumes GToken and mints xPNTs via a dedicated converter
     */
    static async wrapGTokenToXPNTs(wallet: WalletClient, converter: Address, gtoken: Address, amount: bigint) {
        return wallet.writeContract({
            address: converter,
            abi: parseAbi(['function wrap(address, uint256) returns (bool)']),
            functionName: 'wrap',
            args: [gtoken, amount],
            chain: wallet.chain
        } as any);
    }
}
