import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account, parseEther } from 'viem';
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
    transferXPNTsFactoryOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>; // Alias
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // Aliases
    deployxPNTsToken: (args: { name: string, symbol: string, community: Address, account?: Account | Address }) => Promise<Hash>; // Alias
    
    // Prediction & Economics
    predictDepositAmount: (args: { community: Address, userCount: bigint }) => Promise<bigint>;
    getPredictionParams: (args: { community: Address }) => Promise<any>;
    getDepositBreakdown: (args: { community: Address }) => Promise<any>;
    getAPNTsPrice: () => Promise<bigint>;
    aPNTsPriceUSD: () => Promise<bigint>;
    
    // Admin & Config
    setIndustryMultiplier: (args: { industry: string, multiplier: bigint, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymasterAddress: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    updateAPNTsPrice: (args: { newPrice: bigint, account?: Account | Address }) => Promise<Hash>;
    updatePrediction: (args: { community: Address, userCount: bigint, account?: Account | Address }) => Promise<Hash>;
    updatePredictionCustom: (args: { community: Address, params: any, account?: Account | Address }) => Promise<Hash>;
    
    // Views
    hasToken: (args: { token: Address }) => Promise<boolean>;
    getDeployedCount: () => Promise<bigint>;
    industryMultipliers: (args: { industry: string }) => Promise<bigint>;
    predictions: (args: { community: Address }) => Promise<any>;
    
    // Constants
    DEFAULT_SAFETY_FACTOR: () => Promise<bigint>;
    MIN_SUGGESTED_AMOUNT: () => Promise<bigint>;
    
    // Version
    version: () => Promise<string>;
};

// Paymaster Factory Actions
export type PaymasterFactoryActions = {
    // Deployment
    // Deployment
    deployPaymaster: (args: { owner: Address, version?: string, initData?: Hex, account?: Account | Address }) => Promise<Hash>; // initData 支持
    deployPaymasterDeterministic: (args: { owner: Address, version?: string, initData?: Hex, salt: Hex, account?: Account | Address }) => Promise<Hash>;
    predictPaymasterAddress: (args: { owner: Address, salt: Hex }) => Promise<Address>;
    
    // Query
    calculateAddress: (args: { owner: Address }) => Promise<Address>;
    getPaymaster: (args: { owner: Address }) => Promise<Address>; // 使用 msg.sender mapping，不支持 salt
    getPaymasterCount: () => Promise<bigint>;
    getAllPaymasters: () => Promise<Address[]>;
    isPaymasterDeployed: (args: { owner: Address }) => Promise<boolean>;
    
    hasPaymaster: (args: { owner: Address }) => Promise<boolean>;
    getPaymasterList: (args: { offset: bigint, limit: bigint }) => Promise<Address[]>;
    paymasterList: (args: { index: bigint }) => Promise<Address>;
    totalDeployed: () => Promise<bigint>;
    
    getOperatorByPaymaster: (args: { paymaster: Address }) => Promise<Address>;
    operatorByPaymaster: (args: { paymaster: Address }) => Promise<Address>;
    getPaymasterByOperator: (args: { operator: Address }) => Promise<Address>;
    paymasterByOperator: (args: { operator: Address }) => Promise<Address>;
    getPaymasterInfo: (args: { paymaster: Address }) => Promise<any>;
    
    hasImplementation: (args: { version: string }) => Promise<boolean>;
    implementations: (args: { version: string }) => Promise<Address>;
    
    // Config
    setImplementationV4: (args: { impl: Address, account?: Account | Address }) => Promise<Hash>;
    getImplementationV4: () => Promise<Address>;
    setRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;
    
    addImplementation: (args: { version: string, implementation: Address, account?: Account | Address }) => Promise<Hash>;
    upgradeImplementation: (args: { version: string, newImplementation: Address, account?: Account | Address }) => Promise<Hash>;
    setDefaultVersion: (args: { version: string, account?: Account | Address }) => Promise<Hash>;
    
    // Constants
    REGISTRY: () => Promise<Address>;
    ENTRY_POINT: () => Promise<Address>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferPaymasterFactoryOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>; // Alias
    
    // Version
    defaultVersion: () => Promise<string>;
    version: () => Promise<string>;
};

export const xPNTsFactoryActions = (address: Address) => (client: PublicClient | WalletClient): XPNTsFactoryActions => ({
    async createToken({ name, symbol, community, account }) {
        // Map to deployxPNTsToken
        // Args: name, symbol, communityName, communityENS, exchangeRate, paymasterAOA
        // We use name/symbol as community name/ens placeholder if not provided
        // We assume msg.sender (account) is the community owner
        return (client as any).writeContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'deployxPNTsToken',
            args: [
                name, 
                symbol, 
                name, // communityName
                symbol, // communityENS
                parseEther('1'), // exchangeRate: 1:1 with 18 decimals (1e18)
                '0x0000000000000000000000000000000000000000' // paymasterAOA
            ],
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

    async transferXPNTsFactoryOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: xPNTsFactoryABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async transferOwnership(args) {
        return this.transferXPNTsFactoryOwnership(args);
    },

    async deployxPNTsToken(args) {
        return this.createToken(args);
    },

    // Prediction & Economics
    async predictDepositAmount({ community, userCount }) {
        return (client as PublicClient).readContract({ address, abi: xPNTsFactoryABI, functionName: 'predictDepositAmount', args: [community, userCount] }) as Promise<bigint>;
    },
    async getPredictionParams({ community }) {
        return (client as PublicClient).readContract({ address, abi: xPNTsFactoryABI, functionName: 'getPredictionParams', args: [community] });
    },
    async getDepositBreakdown({ community }) {
        return (client as PublicClient).readContract({ address, abi: xPNTsFactoryABI, functionName: 'getDepositBreakdown', args: [community] });
    },
    async getAPNTsPrice() {
        return (client as PublicClient).readContract({ address, abi: xPNTsFactoryABI, functionName: 'getAPNTsPrice', args: [] }) as Promise<bigint>;
    },
    async aPNTsPriceUSD() {
        return (client as PublicClient).readContract({ address, abi: xPNTsFactoryABI, functionName: 'aPNTsPriceUSD', args: [] }) as Promise<bigint>;
    },

    // Admin & Config
    async setIndustryMultiplier({ industry, multiplier, account }) {
        return (client as any).writeContract({ address, abi: xPNTsFactoryABI, functionName: 'setIndustryMultiplier', args: [industry, multiplier], account: account as any, chain: (client as any).chain });
    },
    async setSuperPaymasterAddress({ paymaster, account }) {
        return (client as any).writeContract({ address, abi: xPNTsFactoryABI, functionName: 'setSuperPaymasterAddress', args: [paymaster], account: account as any, chain: (client as any).chain });
    },
    async updateAPNTsPrice({ newPrice, account }) {
        return (client as any).writeContract({ address, abi: xPNTsFactoryABI, functionName: 'updateAPNTsPrice', args: [newPrice], account: account as any, chain: (client as any).chain });
    },
    async updatePrediction({ community, userCount, account }) {
        return (client as any).writeContract({ address, abi: xPNTsFactoryABI, functionName: 'updatePrediction', args: [community, userCount], account: account as any, chain: (client as any).chain });
    },
    async updatePredictionCustom({ community, params, account }) {
        return (client as any).writeContract({ address, abi: xPNTsFactoryABI, functionName: 'updatePredictionCustom', args: [community, params], account: account as any, chain: (client as any).chain });
    },

    // Views
    async hasToken({ token }) {
        return (client as PublicClient).readContract({ address, abi: xPNTsFactoryABI, functionName: 'hasToken', args: [token] }) as Promise<boolean>;
    },
    async getDeployedCount() {
        return (client as PublicClient).readContract({ address, abi: xPNTsFactoryABI, functionName: 'getDeployedCount', args: [] }) as Promise<bigint>;
    },
    async industryMultipliers({ industry }) {
        return (client as PublicClient).readContract({ address, abi: xPNTsFactoryABI, functionName: 'industryMultipliers', args: [industry] }) as Promise<bigint>;
    },
    async predictions({ community }) {
        return (client as PublicClient).readContract({ address, abi: xPNTsFactoryABI, functionName: 'predictions', args: [community] });
    },

    // Constants
    async DEFAULT_SAFETY_FACTOR() {
        return (client as PublicClient).readContract({ address, abi: xPNTsFactoryABI, functionName: 'DEFAULT_SAFETY_FACTOR', args: [] }) as Promise<bigint>;
    },
    async MIN_SUGGESTED_AMOUNT() {
        return (client as PublicClient).readContract({ address, abi: xPNTsFactoryABI, functionName: 'MIN_SUGGESTED_AMOUNT', args: [] }) as Promise<bigint>;
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
    async deployPaymaster({ owner, version, initData, account }: { owner: Address, version?: string, initData?: Hex, account?: Account | Address }) {
        // Factory.deployPaymaster(version, initData)
        const defaultVer = 'v4.2'; // 当前标准版本
        const useVer = version || defaultVer;
        
        return (client as any).writeContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'deployPaymaster',
            args: [useVer, initData || '0x'], 
            account: account as any,
            chain: (client as any).chain
        });
    },

    async deployPaymasterDeterministic({ owner, version, initData, salt, account }) {
         return (client as any).writeContract({ address, abi: PaymasterFactoryABI, functionName: 'deployPaymasterDeterministic', args: [version || 'v4.2', initData || '0x', salt], account: account as any, chain: (client as any).chain });
    },
    
    async predictPaymasterAddress({ owner, salt }) {
        // Note: Contract might not have this function exposed directly or it is separate logic
        // But ABI says it's missing, so let's try calling it if it exists in ABI
        return (client as PublicClient).readContract({ address, abi: PaymasterFactoryABI, functionName: 'predictPaymasterAddress', args: [owner, salt] }) as Promise<Address>;
    },

    async calculateAddress({ owner }) {
        // This function doesn't exist in V4 factory for non-deterministic deploy
        // We throw to avoid misleading usage
        throw new Error('Predicting address not supported for standard deploy. Use getPaymaster after deploy.');
    },

    async getPaymaster({ owner }) {
        // 使用 paymasterByOperator mapping（不支持 salt）
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'paymasterByOperator',
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
        // Not directly supported by contract as single call (it has list + pagination), using pagination shim
        const count = await (client as PublicClient).readContract({
            address, abi: PaymasterFactoryABI, functionName: 'getPaymasterCount', args: []
        }) as bigint;
        
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'getPaymasterList',
            args: [0n, count]
        }) as Promise<Address[]>;
    },

    async isPaymasterDeployed({ owner }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'hasPaymaster', // Corrected from isPaymasterDeployed
            args: [owner]
        }) as Promise<boolean>;
    },

    async hasPaymaster({ owner }) { return this.isPaymasterDeployed({ owner }); },
    async getPaymasterList({ offset, limit }) {
        return (client as PublicClient).readContract({ address, abi: PaymasterFactoryABI, functionName: 'getPaymasterList', args: [offset, limit] }) as Promise<Address[]>;
    },
    async paymasterList({ index }) {
        return (client as PublicClient).readContract({ address, abi: PaymasterFactoryABI, functionName: 'paymasterList', args: [index] }) as Promise<Address>;
    },
    async totalDeployed() {
         return (client as PublicClient).readContract({ address, abi: PaymasterFactoryABI, functionName: 'totalDeployed', args: [] }) as Promise<bigint>;
    },

    async getOperatorByPaymaster({ paymaster }) {
         return (client as PublicClient).readContract({ address, abi: PaymasterFactoryABI, functionName: 'getOperatorByPaymaster', args: [paymaster] }) as Promise<Address>;
    },
    async operatorByPaymaster({ paymaster }) { return this.getOperatorByPaymaster({ paymaster }); },
    
    async getPaymasterByOperator({ operator }) {
         return (client as PublicClient).readContract({ address, abi: PaymasterFactoryABI, functionName: 'getPaymasterByOperator', args: [operator] }) as Promise<Address>;
    },
    async paymasterByOperator({ operator }) { return this.getPaymasterByOperator({ operator }); },
    
    async getPaymasterInfo({ paymaster }) {
         return (client as PublicClient).readContract({ address, abi: PaymasterFactoryABI, functionName: 'getPaymasterInfo', args: [paymaster] });
    },
    
    async hasImplementation({ version }) {
         return (client as PublicClient).readContract({ address, abi: PaymasterFactoryABI, functionName: 'hasImplementation', args: [version] }) as Promise<boolean>;
    },
    async implementations({ version }) {
         return (client as PublicClient).readContract({ address, abi: PaymasterFactoryABI, functionName: 'implementations', args: [version] }) as Promise<Address>;
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

    async addImplementation({ version, implementation, account }) {
         return (client as any).writeContract({ address, abi: PaymasterFactoryABI, functionName: 'addImplementation', args: [version, implementation], account: account as any, chain: (client as any).chain });
    },
    async upgradeImplementation({ version, newImplementation, account }) {
         return (client as any).writeContract({ address, abi: PaymasterFactoryABI, functionName: 'upgradeImplementation', args: [version, newImplementation], account: account as any, chain: (client as any).chain });
    },
    async setDefaultVersion({ version, account }) {
         return (client as any).writeContract({ address, abi: PaymasterFactoryABI, functionName: 'setDefaultVersion', args: [version], account: account as any, chain: (client as any).chain });
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

    async transferPaymasterFactoryOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async transferOwnership(args) {
        return this.transferPaymasterFactoryOwnership(args);
    },

    async defaultVersion() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterFactoryABI,
            functionName: 'defaultVersion',
            args: []
        }) as Promise<string>;
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
