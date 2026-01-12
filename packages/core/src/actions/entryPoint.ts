import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';

export enum EntryPointVersion {
    V06 = '0.6',
    V07 = '0.7',
}

export type EntryPointActions = {
    balanceOf: (args: { account: Address }) => Promise<bigint>;
    depositTo: (args: { account: Address, amount: bigint, txAccount?: Account | Address }) => Promise<Hash>;
    getNonce: (args: { sender: Address, key: bigint }) => Promise<bigint>;
    getDepositInfo: (args: { account: Address }) => Promise<{ deposit: bigint, staked: boolean, stake: bigint, unstakeDelaySec: number, withdrawTime: number }>;
    version: EntryPointVersion;
};

export const entryPointActions = (address: Address, version: EntryPointVersion = EntryPointVersion.V07) => (client: PublicClient | WalletClient): EntryPointActions => ({
    version,
    async balanceOf({ account }) {
        // v0.6 and v0.7 both use balanceOf(address)
        return (client as PublicClient).readContract({
            address,
            abi: [{ name: 'balanceOf', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], type: 'function', stateMutability: 'view' }],
            functionName: 'balanceOf',
            args: [account]
        }) as Promise<bigint>;
    },

    async depositTo({ account, amount, txAccount }) {
        // v0.6 and v0.7 both use depositTo(address)
        return (client as any).writeContract({
            address,
            abi: [{ name: 'depositTo', type: 'function', inputs: [{ type: 'address' }], outputs: [], stateMutability: 'payable' }],
            functionName: 'depositTo',
            args: [account],
            value: amount,
            account: txAccount as any,
            chain: (client as any).chain
        });
    },

    async getNonce({ sender, key }) {
        if (version === EntryPointVersion.V06) {
            // v0.6: getNonce(address, uint192)
            return (client as PublicClient).readContract({
                address,
                abi: [{ name: 'getNonce', type: 'function', inputs: [{ type: 'address', name: 'sender' }, { type: 'uint256', name: 'key' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
                functionName: 'getNonce',
                args: [sender, key]
            }) as Promise<bigint>;
        } else {
            // v0.7: getNonce(address, uint192) - Note: v0.7 actually uses 192 bit key but in ABI it's uint192
            return (client as PublicClient).readContract({
                address,
                abi: [{ name: 'getNonce', type: 'function', inputs: [{ type: 'address', name: 'sender' }, { type: 'uint192', name: 'key' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
                functionName: 'getNonce',
                args: [sender, key]
            }) as Promise<bigint>;
        }
    },

    async getDepositInfo({ account }) {
        const result = await (client as PublicClient).readContract({
            address,
            abi: [{
                name: 'getDepositInfo',
                type: 'function',
                inputs: [{ type: 'address', name: 'account' }],
                outputs: [
                    { type: 'uint112', name: 'deposit' },
                    { type: 'bool', name: 'staked' },
                    { type: 'uint112', name: 'stake' },
                    { type: 'uint32', name: 'unstakeDelaySec' },
                    { type: 'uint48', name: 'withdrawTime' }
                ],
                stateMutability: 'view'
            }],
            functionName: 'getDepositInfo',
            args: [account]
        }) as [bigint, boolean, bigint, number, number];

        return {
            deposit: result[0],
            staked: result[1],
            stake: result[2],
            unstakeDelaySec: result[3],
            withdrawTime: result[4]
        };
    }
});
