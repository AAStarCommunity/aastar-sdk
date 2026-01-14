import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { EntryPointABI, SimpleAccountABI, SimpleAccountFactoryABI } from '../abis/index.js';

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
    
    // Missing
    initialize: (args: { owner: Address, account?: Account | Address }) => Promise<Hash>;
    upgradeToAndCall: (args: { newImplementation: Address, data: Hex, account?: Account | Address }) => Promise<Hash>;
    proxiableUUID: () => Promise<Hex>;
    supportsInterface: (args: { interfaceId: Hex }) => Promise<boolean>;
    UPGRADE_INTERFACE_VERSION: () => Promise<string>;
};

// SimpleAccountFactory Actions
export type AccountFactoryActions = {
    createAccount: (args: { owner: Address, salt: bigint, account?: Account | Address }) => Promise<Hash>;
    getAddress: (args: { owner: Address, salt: bigint }) => Promise<Address>;
    
    // Missing
    accountImplementation: () => Promise<Address>;
};

export const accountActions = (address: Address) => (client: PublicClient | WalletClient): AccountActions => ({
    async execute({ dest, value, func, account }) {
        return (client as any).writeContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'execute',
            args: [dest, value, func],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async executeBatch({ dest, value, func, account }) {
        // Zip arguments into Call[] struct format
        const calls = dest.map((t, i) => ({
            target: t,
            value: value[i],
            data: func[i]
        }));
        
        return (client as any).writeContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'executeBatch',
            args: [calls],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getNonce() {
        return (client as PublicClient).readContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'getNonce',
            args: []
        }) as Promise<bigint>;
    },

    async entryPoint() {
        return (client as PublicClient).readContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'entryPoint',
            args: []
        }) as Promise<Address>;
    },

    async addDeposit({ account }) {
        return (client as any).writeContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'addDeposit',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawDepositTo({ withdrawAddress, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'withdrawDepositTo',
            args: [withdrawAddress, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getDeposit() {
        return (client as PublicClient).readContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'getDeposit',
            args: []
        }) as Promise<bigint>;
    },

    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async initialize({ owner, account }) {
        return (client as any).writeContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'initialize',
            args: [owner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async upgradeToAndCall({ newImplementation, data, account }) {
        return (client as any).writeContract({
            address,
            abi: SimpleAccountABI,
            functionName: 'upgradeToAndCall',
            args: [newImplementation, data],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async proxiableUUID() {
        return (client as PublicClient).readContract({ address, abi: SimpleAccountABI, functionName: 'proxiableUUID', args: [] }) as Promise<Hex>;
    },

    async supportsInterface({ interfaceId }) {
         return (client as PublicClient).readContract({ address, abi: SimpleAccountABI, functionName: 'supportsInterface', args: [interfaceId] }) as Promise<boolean>;
    },
    
    async UPGRADE_INTERFACE_VERSION() {
         return (client as PublicClient).readContract({ address, abi: SimpleAccountABI, functionName: 'UPGRADE_INTERFACE_VERSION', args: [] }) as Promise<string>;
    }
});

export const accountFactoryActions = (address: Address) => (client: PublicClient | WalletClient): AccountFactoryActions => ({
    async createAccount({ owner, salt, account }) {
        return (client as any).writeContract({
            address,
            abi: SimpleAccountFactoryABI,
            functionName: 'createAccount',
            args: [owner, salt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getAddress({ owner, salt }) {
        return (client as PublicClient).readContract({
            address,
            abi: SimpleAccountFactoryABI,
            functionName: 'getAddress',
            args: [owner, salt]
        }) as Promise<Address>;
    },

    async accountImplementation() {
        return (client as PublicClient).readContract({ address, abi: SimpleAccountFactoryABI, functionName: 'accountImplementation', args: [] }) as Promise<Address>;
    }
});
