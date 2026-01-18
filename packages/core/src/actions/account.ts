import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { SimpleAccountABI, SimpleAccountFactoryABI } from '../abis/index.js';
import { validateAddress, validateRequired, validateAmount } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

// SimpleAccount Actions (v0.7)
export type AccountActions = {
    execute: (args: { dest: Address, value: bigint, func: Hex, account?: Account | Address }) => Promise<Hash>;
    executeBatch: (args: { dest: Address[], value: bigint[], func: Hex[], account?: Account | Address }) => Promise<Hash>;
    getNonce: () => Promise<bigint>;
    entryPoint: () => Promise<Address>;
    addDeposit: (args: { account?: Account | Address }) => Promise<Hash>;
    withdrawDepositTo: (args: { withdrawAddress: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    getDeposit: () => Promise<bigint>;
    owner: () => Promise<Address>;
};

// SimpleAccountFactory Actions
export type AccountFactoryActions = {
    createAccount: (args: { owner: Address, salt: bigint, account?: Account | Address }) => Promise<Hash>;
    getAddress: (args: { owner: Address, salt: bigint }) => Promise<Address>;
};

export const accountActions = (address: Address) => (client: PublicClient | WalletClient): AccountActions => ({
    async execute({ dest, value, func, account }) {
        try {
            validateAddress(dest, 'dest');
            validateAmount(value, 'value');
            validateRequired(func, 'func');
            return await (client as any).writeContract({
                address,
                abi: SimpleAccountABI,
                functionName: 'execute',
                args: [dest, value, func],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'execute');
        }
    },

    async executeBatch({ dest, value, func, account }) {
        try {
            validateRequired(dest, 'dest');
            validateRequired(value, 'value');
            validateRequired(func, 'func');
            
            if (dest.length !== value.length || dest.length !== func.length) {
                throw new Error('executeBatch: Array lengths must match');
            }

            // Zip arguments into Call[] struct format
            const calls = dest.map((t, i) => ({
                target: t,
                value: value[i],
                data: func[i]
            }));
            
            return await (client as any).writeContract({
                address,
                abi: SimpleAccountABI,
                functionName: 'executeBatch',
                args: [calls],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'executeBatch');
        }
    },

    async getNonce() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SimpleAccountABI,
                functionName: 'getNonce',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getNonce');
        }
    },

    async entryPoint() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SimpleAccountABI,
                functionName: 'entryPoint',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'entryPoint');
        }
    },

    async addDeposit({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: SimpleAccountABI,
                functionName: 'addDeposit',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'addDeposit');
        }
    },

    async withdrawDepositTo({ withdrawAddress, amount, account }) {
        try {
            validateAddress(withdrawAddress, 'withdrawAddress');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: SimpleAccountABI,
                functionName: 'withdrawDepositTo',
                args: [withdrawAddress, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'withdrawDepositTo');
        }
    },

    async getDeposit() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SimpleAccountABI,
                functionName: 'getDeposit',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getDeposit');
        }
    },

    async owner() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SimpleAccountABI,
                functionName: 'owner',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'owner');
        }
    }
});

export const accountFactoryActions = (address: Address) => (client: PublicClient | WalletClient): AccountFactoryActions => ({
    async createAccount({ owner, salt, account }) {
        try {
            validateAddress(owner, 'owner');
            validateRequired(salt, 'salt');
            return await (client as any).writeContract({
                address,
                abi: SimpleAccountFactoryABI,
                functionName: 'createAccount',
                args: [owner, salt],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'createAccount');
        }
    },

    async getAddress({ owner, salt }) {
        try {
            validateAddress(owner, 'owner');
            validateRequired(salt, 'salt');
            return await (client as PublicClient).readContract({
                address,
                abi: SimpleAccountFactoryABI,
                functionName: 'getAddress',
                args: [owner, salt]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAddress');
        }
    }
});
