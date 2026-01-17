import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account, parseEther } from 'viem';
import { xPNTsFactoryABI, PaymasterFactoryABI } from '../abis/index.js';
import { validateAddress, validateRequired, validateAmount } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

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
    // Deployment
    deployPaymaster: (args: { owner: Address, version?: string, initData?: Hex, account?: Account | Address }) => Promise<Hash>; // initData 支持
    
    // Query
    calculateAddress: (args: { owner: Address }) => Promise<Address>;
    getPaymaster: (args: { owner: Address }) => Promise<Address>; // 使用 msg.sender mapping，不支持 salt
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
    defaultVersion: () => Promise<string>;
    version: () => Promise<string>;
};

export const xPNTsFactoryActions = (address: Address) => (client: PublicClient | WalletClient): XPNTsFactoryActions => ({
    async createToken({ name, symbol, community, account }) {
        try {
            validateRequired(name, 'name');
            validateRequired(symbol, 'symbol');
            validateAddress(community, 'community');
            return await (client as any).writeContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'deployxPNTsToken',
                args: [
                    name, 
                    symbol, 
                    name,
                    symbol,
                    parseEther('1'),
                    '0x0000000000000000000000000000000000000000'
                ],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'createToken');
        }
    },

    async deployForCommunity({ community, account }) {
        try {
            validateAddress(community, 'community');
            return await (client as any).writeContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'deployForCommunity',
                args: [community],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'deployForCommunity');
        }
    },

    async getTokenAddress({ community }) {
        try {
            validateAddress(community, 'community');
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'getTokenAddress',
                args: [community]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getTokenAddress');
        }
    },

    async predictAddress({ community, salt }) {
        try {
            validateAddress(community, 'community');
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'predictAddress',
                args: salt !== undefined ? [community, salt] : [community]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'predictAddress');
        }
    },

    async isTokenDeployed({ community }) {
        try {
            validateAddress(community, 'community');
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'isTokenDeployed',
                args: [community]
            }) as boolean;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isTokenDeployed');
        }
    },

    async getCommunityByToken({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'getCommunityByToken',
                args: [token]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getCommunityByToken');
        }
    },

    async getAllTokens() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'getAllTokens',
                args: []
            }) as Address[];
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAllTokens');
        }
    },

    async getTokenCount() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'getTokenCount',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getTokenCount');
        }
    },

    async deployedTokens({ index }) {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'deployedTokens',
                args: [index]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'deployedTokens');
        }
    },

    async communityToToken({ community }) {
        try {
            validateAddress(community, 'community');
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'communityToToken',
                args: [community]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityToToken');
        }
    },

    async setRegistry({ registry, account }) {
        try {
            validateAddress(registry, 'registry');
            return await (client as any).writeContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'setRegistry',
                args: [registry],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setRegistry');
        }
    },

    async setSuperPaymaster({ paymaster, account }) {
        try {
            validateAddress(paymaster, 'paymaster');
            return await (client as any).writeContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'setSuperPaymaster',
                args: [paymaster],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setSuperPaymaster');
        }
    },

    async setImplementation({ impl, account }) {
        try {
            validateAddress(impl, 'impl');
            return await (client as any).writeContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'setImplementation',
                args: [impl],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setImplementation');
        }
    },

    async getImplementation() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'getImplementation',
                args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getImplementation');
        }
    },

    async REGISTRY() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'REGISTRY',
                args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'REGISTRY');
        }
    },

    async SUPER_PAYMASTER() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'SUPER_PAYMASTER',
                args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'SUPER_PAYMASTER');
        }
    },

    async tokenImplementation() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'tokenImplementation',
                args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'tokenImplementation');
        }
    },

    async owner() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'owner',
                args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'owner');
        }
    },

    async transferOwnership({ newOwner, account }) {
        try {
            validateAddress(newOwner, 'newOwner');
            return await (client as any).writeContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'transferOwnership',
                args: [newOwner],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transferOwnership');
        }
    },

    async renounceOwnership({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'renounceOwnership',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'renounceOwnership');
        }
    },

    async version() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: xPNTsFactoryABI,
                functionName: 'version',
                args: []
            }) as string;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    }
});

export const paymasterFactoryActions = (address: Address) => (client: PublicClient | WalletClient): PaymasterFactoryActions => ({
    async deployPaymaster({ owner, version, initData, account }: { owner: Address, version?: string, initData?: Hex, account?: Account | Address }) {
        try {
            validateAddress(owner, 'owner');
            // Factory.deployPaymaster(version, initData)
            const defaultVer = 'v4.2'; // 当前标准版本
            const useVer = version || defaultVer;
            
            return await (client as any).writeContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'deployPaymaster',
                args: [useVer, initData || '0x'], 
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'deployPaymaster');
        }
    },

    async calculateAddress({ owner }) {
        // This function doesn't exist in V4 factory for non-deterministic deploy
        // We throw to avoid misleading usage
        throw new Error('Predicting address not supported for standard deploy. Use getPaymaster after deploy.');
    },

    async getPaymaster({ owner }) {
        try {
            validateAddress(owner, 'owner');
            // 使用 paymasterByOperator mapping（不支持 salt）
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'paymasterByOperator',
                args: [owner]
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getPaymaster');
        }
    },

    async getPaymasterCount() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'getPaymasterCount',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getPaymasterCount');
        }
    },

    async getAllPaymasters() {
        try {
            // Not directly supported by contract as single call (it has list + pagination), using pagination shim
            const count = await (client as PublicClient).readContract({
                address, abi: PaymasterFactoryABI, functionName: 'getPaymasterCount', args: []
            }) as bigint;
            
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'getPaymasterList',
                args: [0n, count]
            }) as Address[];
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAllPaymasters');
        }
    },

    async isPaymasterDeployed({ owner }) {
        try {
            validateAddress(owner, 'owner');
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'hasPaymaster', // Corrected from isPaymasterDeployed
                args: [owner]
            }) as boolean;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isPaymasterDeployed');
        }
    },

    async setImplementationV4({ impl, account }) {
        try {
            validateAddress(impl, 'impl');
            return await (client as any).writeContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'setImplementationV4',
                args: [impl],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setImplementationV4');
        }
    },

    async getImplementationV4() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'getImplementationV4',
                args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getImplementationV4');
        }
    },

    async setRegistry({ registry, account }) {
        try {
            validateAddress(registry, 'registry');
            return await (client as any).writeContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'setRegistry',
                args: [registry],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setRegistry');
        }
    },

    async REGISTRY() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'REGISTRY',
                args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'REGISTRY');
        }
    },

    async ENTRY_POINT() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'ENTRY_POINT',
                args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ENTRY_POINT');
        }
    },

    async owner() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'owner',
                args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'owner');
        }
    },

    async transferOwnership({ newOwner, account }) {
        try {
            validateAddress(newOwner, 'newOwner');
            return await (client as any).writeContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'transferOwnership',
                args: [newOwner],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transferOwnership');
        }
    },

    async defaultVersion() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'defaultVersion',
                args: []
            }) as string;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'defaultVersion');
        }
    },

    async version() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterFactoryABI,
                functionName: 'version',
                args: []
            }) as string;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    }
});
