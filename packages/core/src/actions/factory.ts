import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account, parseEther } from 'viem';
import { xPNTsFactoryABI, PaymasterFactoryABI } from '../abis/index.js';
import { validateAddress, validateRequired, validateAmount } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

// xPNTs Factory Actions (基于地址调用的通用接口)
export type XPNTsFactoryActions = {
    // Token 部署
    deployxPNTsToken: (args: { name: string, symbol: string, communityName: string, communityENS: string, exchangeRate: bigint, paymasterAOA: Address, account?: Account | Address }) => Promise<Hash>;
    createToken: (args: { name: string, symbol: string, community: Address, account?: Account | Address }) => Promise<Hash>;
    deployForCommunity: (args: { community: Address, account?: Account | Address }) => Promise<Hash>;
    
    // 查询
    getTokenAddress: (args: { community: Address }) => Promise<Address>;
    predictAddress: (args: { community: Address, salt?: bigint }) => Promise<Address>;
    hasToken: (args: { community: Address }) => Promise<boolean>;
    isTokenDeployed: (args: { community: Address }) => Promise<boolean>;
    getCommunityByToken: (args: { token: Address }) => Promise<Address>;
    getAllTokens: () => Promise<Address[]>;
    getDeployedCount: () => Promise<bigint>;
    getTokenCount: () => Promise<bigint>;
    deployedTokens: (args: { index: bigint }) => Promise<Address>;
    communityToToken: (args: { community: Address }) => Promise<Address>;
    
    // 配置
    setRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymasterAddress: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymaster: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    setImplementation: (args: { impl: Address, account?: Account | Address }) => Promise<Hash>;
    getImplementation: () => Promise<Address>;
    
    // 常量
    REGISTRY: () => Promise<Address>;
    SUPERPAYMASTER: () => Promise<Address>;
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
    deployPaymaster: (args: { version?: string, initData?: Hex, account?: Account | Address }) => Promise<Hash>;
    deployPaymasterDeterministic: (args: { version: string, salt: Hex, initData: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // Query
    calculateAddress: (args: { owner: Address }) => Promise<Address>;
    getPaymaster: (args: { owner: Address }) => Promise<Address>;
    getPaymasterByOperator: (args: { operator: Address }) => Promise<Address>;
    getOperatorByPaymaster: (args: { paymaster: Address }) => Promise<Address>;
    getPaymasterCount: () => Promise<bigint>;
    getAllPaymasters: () => Promise<Address[]>;
    hasPaymaster: (args: { owner: Address }) => Promise<boolean>;
    isPaymasterDeployed: (args: { owner: Address }) => Promise<boolean>;
    
    // Config
    addImplementation: (args: { version: string, impl: Address, account?: Account | Address }) => Promise<Hash>;
    upgradeImplementation: (args: { version: string, impl: Address, account?: Account | Address }) => Promise<Hash>;
    setDefaultVersion: (args: { version: string, account?: Account | Address }) => Promise<Hash>;
    setImplementationV4: (args: { impl: Address, account?: Account | Address }) => Promise<Hash>;
    getImplementation: (args: { version: string }) => Promise<Address>;
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
    totalDeployed: () => Promise<bigint>;
    version: () => Promise<string>;
};

export const xPNTsFactoryActions = (address: Address) => (client: PublicClient | WalletClient): XPNTsFactoryActions => {
    const actions: XPNTsFactoryActions = {
        async deployxPNTsToken({ name, symbol, communityName, communityENS, exchangeRate, paymasterAOA, account }) {
            try {
                validateRequired(name, 'name');
                validateRequired(symbol, 'symbol');
                validateRequired(communityName, 'communityName');
                validateRequired(communityENS, 'communityENS');
                validateAmount(exchangeRate, 'exchangeRate');
                validateAddress(paymasterAOA, 'paymasterAOA');
                return await (client as any).writeContract({
                    address,
                    abi: xPNTsFactoryABI,
                    functionName: 'deployxPNTsToken',
                    args: [name, symbol, communityName, communityENS, exchangeRate, paymasterAOA],
                    account: account as any,
                    chain: (client as any).chain
                });
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'deployxPNTsToken');
            }
        },

        async createToken({ name, symbol, community, account }) {
            return this.deployxPNTsToken({
                name,
                symbol,
                communityName: name,
                communityENS: symbol,
                exchangeRate: parseEther('1'),
                paymasterAOA: '0x0000000000000000000000000000000000000000',
                account
            });
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

        async hasToken({ community }) {
            try {
                validateAddress(community, 'community');
                return await (client as PublicClient).readContract({
                    address,
                    abi: xPNTsFactoryABI,
                    functionName: 'hasToken',
                    args: [community]
                }) as boolean;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'hasToken');
            }
        },

        async isTokenDeployed({ community }) {
            return this.hasToken({ community });
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

        async getDeployedCount() {
            try {
                return await (client as PublicClient).readContract({
                    address,
                    abi: xPNTsFactoryABI,
                    functionName: 'getDeployedCount',
                    args: []
                }) as bigint;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'getDeployedCount');
            }
        },

        async getTokenCount() {
            return this.getDeployedCount();
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

        async setSuperPaymasterAddress({ paymaster, account }) {
            try {
                validateAddress(paymaster, 'paymaster');
                return await (client as any).writeContract({
                    address,
                    abi: xPNTsFactoryABI,
                    functionName: 'setSuperPaymasterAddress',
                    args: [paymaster],
                    account: account as any,
                    chain: (client as any).chain
                });
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'setSuperPaymasterAddress');
            }
        },

        async setSuperPaymaster({ paymaster, account }) {
            return this.setSuperPaymasterAddress({ paymaster, account });
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

        async SUPERPAYMASTER() {
            try {
                return await (client as PublicClient).readContract({
                    address,
                    abi: xPNTsFactoryABI,
                    functionName: 'SUPERPAYMASTER',
                    args: []
                }) as Address;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'SUPERPAYMASTER');
            }
        },

        async SUPER_PAYMASTER() {
            return this.SUPERPAYMASTER();
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
    };
    return actions;
};

export const paymasterFactoryActions = (address: Address) => (client: PublicClient | WalletClient): PaymasterFactoryActions => {
    const actions: PaymasterFactoryActions = {
        async deployPaymaster({ version, initData, account }) {
            try {
                const defaultVer = 'v4.2'; 
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

        async deployPaymasterDeterministic({ version, salt, initData, account }) {
            try {
                validateRequired(version, 'version');
                validateRequired(salt, 'salt');
                return await (client as any).writeContract({
                    address,
                    abi: PaymasterFactoryABI,
                    functionName: 'deployPaymasterDeterministic',
                    args: [version, salt, initData || '0x'],
                    account: account as any,
                    chain: (client as any).chain
                });
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'deployPaymasterDeterministic');
            }
        },

        async calculateAddress({ owner }) {
            throw new Error('Predicting address not supported for standard deploy. Use getPaymaster after deploy.');
        },

        async getPaymaster({ owner }) {
            return this.getPaymasterByOperator({ operator: owner });
        },

        async getPaymasterByOperator({ operator }) {
            try {
                validateAddress(operator, 'operator');
                return await (client as PublicClient).readContract({
                    address,
                    abi: PaymasterFactoryABI,
                    functionName: 'getPaymasterByOperator',
                    args: [operator]
                }) as Address;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'getPaymasterByOperator');
            }
        },

        async getOperatorByPaymaster({ paymaster }) {
            try {
                validateAddress(paymaster, 'paymaster');
                return await (client as PublicClient).readContract({
                    address,
                    abi: PaymasterFactoryABI,
                    functionName: 'getOperatorByPaymaster',
                    args: [paymaster]
                }) as Address;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'getOperatorByPaymaster');
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
                const count = await this.getPaymasterCount();
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

        async hasPaymaster({ owner }) {
            try {
                validateAddress(owner, 'owner');
                return await (client as PublicClient).readContract({
                    address,
                    abi: PaymasterFactoryABI,
                    functionName: 'hasPaymaster',
                    args: [owner]
                }) as boolean;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'hasPaymaster');
            }
        },

        async isPaymasterDeployed({ owner }) {
            return this.hasPaymaster({ owner });
        },

        async addImplementation({ version, impl, account }) {
            try {
                validateRequired(version, 'version');
                validateAddress(impl, 'impl');
                return await (client as any).writeContract({
                    address,
                    abi: PaymasterFactoryABI,
                    functionName: 'addImplementation',
                    args: [version, impl],
                    account: account as any,
                    chain: (client as any).chain
                });
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'addImplementation');
            }
        },

        async upgradeImplementation({ version, impl, account }) {
            try {
                validateRequired(version, 'version');
                validateAddress(impl, 'impl');
                return await (client as any).writeContract({
                    address,
                    abi: PaymasterFactoryABI,
                    functionName: 'upgradeImplementation',
                    args: [version, impl],
                    account: account as any,
                    chain: (client as any).chain
                });
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'upgradeImplementation');
            }
        },

        async setDefaultVersion({ version, account }) {
            try {
                validateRequired(version, 'version');
                return await (client as any).writeContract({
                    address,
                    abi: PaymasterFactoryABI,
                    functionName: 'setDefaultVersion',
                    args: [version],
                    account: account as any,
                    chain: (client as any).chain
                });
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'setDefaultVersion');
            }
        },

        async getImplementation({ version }) {
            try {
                validateRequired(version, 'version');
                return await (client as PublicClient).readContract({
                    address,
                    abi: PaymasterFactoryABI,
                    functionName: 'getImplementation',
                    args: [version]
                }) as Address;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'getImplementation');
            }
        },

        async setImplementationV4({ impl, account }) {
            return this.upgradeImplementation({ version: 'v4', impl, account });
        },

        async getImplementationV4() {
            try {
                return await (client as PublicClient).readContract({
                    address,
                    abi: PaymasterFactoryABI,
                    functionName: 'getImplementation', 
                    args: ['v4'] 
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

        async totalDeployed() {
            try {
                return await (client as PublicClient).readContract({
                    address,
                    abi: PaymasterFactoryABI,
                    functionName: 'totalDeployed',
                    args: []
                }) as bigint;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'totalDeployed');
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
    };
    return actions;
};
