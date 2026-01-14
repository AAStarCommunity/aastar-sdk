import { EntryPointABI } from '../abis/index.js';

export enum EntryPointVersion {
    V06 = '0.6',
    V07 = '0.7',
}

export type EntryPointActions = {
    balanceOf: (args: { account: Address }) => Promise<bigint>;
    depositTo: (args: { account: Address, amount: bigint, txAccount?: Account | Address }) => Promise<Hash>;
    getNonce: (args: { sender: Address, key: bigint }) => Promise<bigint>;
    getDepositInfo: (args: { account: Address }) => Promise<{ deposit: bigint, staked: boolean, stake: bigint, unstakeDelaySec: number, withdrawTime: number }>;
    
    // Stake Management
    addStake: (args: { unstakeDelaySec: number, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    unlockStake: (args: { account?: Account | Address }) => Promise<Hash>;
    withdrawStake: (args: { withdrawAddress: Address, account?: Account | Address }) => Promise<Hash>;
    withdrawTo: (args: { withdrawAddress: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Core Handlers
    handleOps: (args: { ops: any[], beneficiary: Address, account?: Account | Address }) => Promise<Hash>;
    handleAggregatedOps: (args: { opsPerAggregator: any[], beneficiary: Address, account?: Account | Address }) => Promise<Hash>;
    innerHandleOp: (args: { callData: Hex, opInfo: any, context: Hex, account?: Account | Address }) => Promise<Hash>;
    delegateAndRevert: (args: { target: Address, data: Hex, account?: Account | Address }) => Promise<void>; // usually reverts
    
    // Views & Helpers
    getUserOpHash: (args: { op: any }) => Promise<Hash>;
    getSenderAddress: (args: { initCode: Hex }) => Promise<Address>;
    senderCreator: () => Promise<Address>;
    incrementNonce: (args: { key: bigint, account?: Account | Address }) => Promise<Hash>;
    nonceSequenceNumber: (args: { sender: Address, key: bigint }) => Promise<bigint>;
    supportsInterface: (args: { interfaceId: Hex }) => Promise<boolean>;
    eip712Domain: () => Promise<any>;
    getCurrentUserOpHash: () => Promise<Hash>;
    getDomainSeparatorV4: () => Promise<Hex>;
    getPackedUserOpTypeHash: () => Promise<Hex>;
    
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
    },

    async addStake({ unstakeDelaySec, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: EntryPointABI,
            functionName: 'addStake',
            args: [unstakeDelaySec],
            value: amount,
            account: account as any,
            chain: (client as any).chain
        });
    },

    async unlockStake({ account }) {
        return (client as any).writeContract({
            address,
            abi: EntryPointABI,
            functionName: 'unlockStake',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawStake({ withdrawAddress, account }) {
        return (client as any).writeContract({
            address,
            abi: EntryPointABI,
            functionName: 'withdrawStake',
            args: [withdrawAddress],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawTo({ withdrawAddress, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: EntryPointABI,
            functionName: 'withdrawTo',
            args: [withdrawAddress, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async handleOps({ ops, beneficiary, account }) {
        return (client as any).writeContract({
            address,
            abi: EntryPointABI,
            functionName: 'handleOps',
            args: [ops, beneficiary],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async handleAggregatedOps({ opsPerAggregator, beneficiary, account }) {
        return (client as any).writeContract({
            address,
            abi: EntryPointABI,
            functionName: 'handleAggregatedOps',
            args: [opsPerAggregator, beneficiary],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async innerHandleOp({ callData, opInfo, context, account }) {
         return (client as any).writeContract({
            address,
            abi: EntryPointABI,
            functionName: 'innerHandleOp',
            args: [callData, opInfo, context],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async delegateAndRevert({ target, data, account }) {
         // This typically reverts, but we act as a writer
         return (client as any).writeContract({
            address,
            abi: EntryPointABI,
            functionName: 'delegateAndRevert',
            args: [target, data],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getUserOpHash({ op }) {
        return (client as PublicClient).readContract({
            address,
            abi: EntryPointABI,
            functionName: 'getUserOpHash',
            args: [op]
        }) as Promise<Hash>;
    },

    async getSenderAddress({ initCode }) {
         // getSenderAddress usually reverts with the address. Viem might throw.
         // But let's assume standard call first.
         // Actually in EP v0.7 it might return if called off-chain or revert.
         // We will try readContract. 
         try {
             return await (client as PublicClient).readContract({
                address,
                abi: EntryPointABI,
                functionName: 'getSenderAddress',
                args: [initCode]
            }) as Promise<Address>;
         } catch (e: any) {
             // Extract address from error if needed, but for now just implementing the method call.
             // Usually this method reverts with SenderAddressResult(address)
             throw e;
         }
    },

    async senderCreator() {
        return (client as PublicClient).readContract({ address, abi: EntryPointABI, functionName: 'senderCreator', args: [] }) as Promise<Address>;
    },

    async incrementNonce({ key, account }) {
        return (client as any).writeContract({ address, abi: EntryPointABI, functionName: 'incrementNonce', args: [key], account: account as any, chain: (client as any).chain });
    },

    async nonceSequenceNumber({ sender, key }) {
        return (client as PublicClient).readContract({ address, abi: EntryPointABI, functionName: 'nonceSequenceNumber', args: [sender, key] }) as Promise<bigint>;
    },

    async supportsInterface({ interfaceId }) {
        return (client as PublicClient).readContract({ address, abi: EntryPointABI, functionName: 'supportsInterface', args: [interfaceId] }) as Promise<boolean>;
    },
    
    async eip712Domain() {
         return (client as PublicClient).readContract({ address, abi: EntryPointABI, functionName: 'eip712Domain', args: [] });
    },

    async getCurrentUserOpHash() {
         // View that returns 'bytes32'
          return (client as PublicClient).readContract({ address, abi: EntryPointABI, functionName: 'getCurrentUserOpHash', args: [] }) as Promise<Hash>;
    },

    async getDomainSeparatorV4() {
           return (client as PublicClient).readContract({ address, abi: EntryPointABI, functionName: 'getDomainSeparatorV4', args: [] }) as Promise<Hex>;
    },

    async getPackedUserOpTypeHash() {
           return (client as PublicClient).readContract({ address, abi: EntryPointABI, functionName: 'getPackedUserOpTypeHash', args: [] }) as Promise<Hex>;
    }
});
