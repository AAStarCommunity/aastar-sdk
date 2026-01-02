import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { xPNTsFactoryABI, PaymasterFactoryABI } from '../abis/index.js';

// xPNTs Factory Actions (基于地址调用的通用接口)
export type XPNTsFactoryActions = {
    // Token 部署
    createToken: (args: { name: string, symbol: string, community: Address, account?: Account | Address }) => Promise<Hash>;
    deployForCommunity: (args: { community: Address, account?: Account | Address }) => Promise<Hash>;
    
    // 查询
    getTokenAddress: (args: { community: Address }) => Promise<Address>;
    predictAddress: (args: { community: Address, salt?: bigint }) => Promise<Address>;
    isTokenDeployed: (args: { community: Address }) => Promise<boolean>;
    getCommunityByToken: (args: { token: Address }) => Promise<Address>;
    getAllTokens: () => Promise<Address[]>;
    getTokenCount: () => Promise<bigint>;
    deployedTokens: (args: { index: bigint }) => Promise<Address>;
    communityToToken: (args: { community: Address }) => Promise<Address>;
    
    // 配置
    setRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymaster: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    setImplementation: (args: { impl: Address, account?: Account | Address }) => Promise<Hash>;
    getImplementation: () => Promise<Address>;
    
    // 常量
    REGISTRY: () => Promise<Address>;
    SUPER_PAYMASTER: () => Promise<Address>;
    tokenImplementation: () => Promise<Address>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: () => Promise<string>;
};

// Paymaster Factory Actions
export type PaymasterFactoryActions = {
    // Deployment
    deployPaymaster: (args: { owner: Address, account?: Account | Address }) => Promise<Hash>;
    deployPaymasterV4: (args: { owner: Address, entryPoint: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Query
    calculateAddress: (args: { owner: Address }) => Promise<Address>;
    getPaymaster: (args: { owner: Address }) => Promise<Address>;
    getPaymasterCount: () => Promise<bigint>;
    getAllPaymasters: () => Promise<Address[]>;
    isPaymasterDeployed: (args: { owner: Address }) => Promise<boolean>;
    
    // Config
    setImplementationV4: (args: { impl: Address, account?: Account | Address }) => Promise<Hash>;
    getImplementationV4: () => Promise<Address>;
    setRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Constants
    REGISTRY: () => Promise<Address>;
    ENTRY_POINT: () => Promise<Address>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: () => Promise<string>;
};

export const xPNTsFactoryActions = (address: Address) => (client: PublicClient | WalletClient): XPNTsFactoryActions => ({
    async createToken({ name, symbol, community, account }) {
        return (client as any).writeContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'createToken',
            args: [name, symbol, community],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async deployForCommunity({ community, account }) {
        return (client as any).writeContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'deployForCommunity',
            args: [community],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getTokenAddress({ community }) {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'getTokenAddress',
            args: [community]
        }) as Promise<Address>;
    },

    async predictAddress({ community, salt }) {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'predictAddress',
            args: salt !== undefined ? [community, salt] : [community]
        }) as Promise<Address>;
    },

    async isTokenDeployed({ community }) {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'isTokenDeployed',
            args: [community]
        }) as Promise<boolean>;
    },

    async getCommunityByToken({ token }) {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'getCommunityByToken',
            args: [token]
        }) as Promise<Address>;
    },

    async getAllTokens() {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'getAllTokens',
            args: []
        }) as Promise<Address[]>;
    },

    async getTokenCount() {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'getTokenCount',
            args: []
        }) as Promise<bigint>;
    },

    async deployedTokens({ index }) {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'deployedTokens',
            args: [index]
        }) as Promise<Address>;
    },

    async communityToToken({ community }) {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'communityToToken',
            args: [community]
        }) as Promise<Address>;
    },

    async setRegistry({ registry, account }) {
        return (client as any).writeContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'setRegistry',
            args: [registry],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setSuperPaymaster({ paymaster, account }) {
        return (client as any).writeContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'setSuperPaymaster',
            args: [paymaster],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setImplementation({ impl, account }) {
        return (client as any).writeContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'setImplementation',
            args: [impl],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getImplementation() {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'getImplementation',
            args: []
        }) as Promise<Address>;
    },

    async REGISTRY() {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'REGISTRY',
            args: []
        }) as Promise<Address>;
    },

    async SUPER_PAYMASTER() {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'SUPER_PAYMASTER',
            args: []
        }) as Promise<Address>;
    },

    async tokenImplementation() {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'tokenImplementation',
            args: []
        }) as Promise<Address>;
    },

    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async transferOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async renounceOwnership({ account }) {
        return (client as any).writeContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async version() {
        return (client as PublicClient).readContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});

export const paymasterFactoryActions = (address: Address) => (client: PublicClient | WalletClient): PaymasterFactoryActions => ({
    async deployPaymaster({ owner, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'deployPaymaster',
            args: [owner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async deployPaymasterV4({ owner, entryPoint, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'deployPaymasterV4',
            args: [owner, entryPoint],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async calculateAddress({ owner }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'calculateAddress',
            args: [owner]
        }) as Promise<Address>;
    },

    async getPaymaster({ owner }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'getPaymaster',
            args: [owner]
        }) as Promise<Address>;
    },

    async getPaymasterCount() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'getPaymasterCount',
            args: []
        }) as Promise<bigint>;
    },

    async getAllPaymasters() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'getAllPaymasters',
            args: []
        }) as Promise<Address[]>;
    },

    async isPaymasterDeployed({ owner }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'isPaymasterDeployed',
            args: [owner]
        }) as Promise<boolean>;
    },

    async setImplementationV4({ impl, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'setImplementationV4',
            args: [impl],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getImplementationV4() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'getImplementationV4',
            args: []
        }) as Promise<Address>;
    },

    async setRegistry({ registry, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'setRegistry',
            args: [registry],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async REGISTRY() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'REGISTRY',
            args: []
        }) as Promise<Address>;
    },

    async ENTRY_POINT() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'ENTRY_POINT',
            args: []
        }) as Promise<Address>;
    },

    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async transferOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async version() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});
