import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account, parseEther, parseEventLogs, isAddressEqual, zeroAddress } from 'viem';
import { xPNTsFactoryABI, PaymasterFactoryABI, PaymasterABI } from '../abis/index.js';
import { validateAddress, validateRequired, validateAmount } from '../validators/index.js';
import { AAStarError, ErrorCode } from '../errors/index.js';

// xPNTs Factory Actions (基于地址调用的通用接口)
export type XPNTsFactoryActions = {
    // Token 部署
    deployxPNTsToken: (args: { name: string, symbol: string, communityName: string, communityENS: string, exchangeRate: bigint, paymasterAOA: Address, account?: Account | Address }) => Promise<Hash>;
    createToken: (args: { name: string, symbol: string, community: Address, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Removed in the v5.x contract refactor — xPNTsFactory has no `deployForCommunity` (it cannot derive token name/symbol from a community address). Throws {@link ErrorCode.NOT_IMPLEMENTED}; use {@link deployxPNTsToken} with full token params. */
    deployForCommunity: (args: { community: Address, account?: Account | Address }) => Promise<Hash>;

    // 查询
    getTokenAddress: (args: { community: Address }) => Promise<Address>;
    /** @deprecated Removed in the v5.x contract refactor — xPNTsFactory exposes no CREATE2 address predictor. Throws {@link ErrorCode.NOT_IMPLEMENTED}; read the deployed address via {@link getTokenAddress}/{@link communityToToken} after deploy. */
    predictAddress: (args: { community: Address, salt?: bigint }) => Promise<Address>;
    hasToken: (args: { community: Address }) => Promise<boolean>;
    isTokenDeployed: (args: { community: Address }) => Promise<boolean>;
    /** @deprecated Removed in the v5.x contract refactor — xPNTsFactory has no token->community reverse lookup (only community->token via {@link communityToToken}). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    getCommunityByToken: (args: { token: Address }) => Promise<Address>;
    getAllTokens: () => Promise<Address[]>;
    getDeployedCount: () => Promise<bigint>;
    getTokenCount: () => Promise<bigint>;
    deployedTokens: (args: { index: bigint }) => Promise<Address>;
    communityToToken: (args: { community: Address }) => Promise<Address>;

    // 配置
    /** @deprecated Removed in the v5.x contract refactor — xPNTsFactory.REGISTRY is immutable (no `setRegistry`). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    setRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymasterAddress: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymaster: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Removed in the v5.x contract refactor — xPNTsFactory has no implementation setter (the token `implementation()` is fixed). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    setImplementation: (args: { impl: Address, account?: Account | Address }) => Promise<Hash>;
    /** Token implementation address. On-chain fn: `implementation()` (the legacy `getImplementation` getter was removed). */
    getImplementation: () => Promise<Address>;

    // 常量
    REGISTRY: () => Promise<Address>;
    SUPERPAYMASTER: () => Promise<Address>;
    SUPER_PAYMASTER: () => Promise<Address>;
    /** Token implementation address. On-chain fn: `implementation()` (the legacy `tokenImplementation` getter was removed). */
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
    /** @deprecated Removed in the v5.x contract refactor — PaymasterFactory has no `ENTRY_POINT` constant. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
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

        async deployForCommunity({ community }) {
            // Removed in the v5.x contract refactor: xPNTsFactory has no `deployForCommunity`.
            // The only deploy entrypoint is deployxPNTsToken(name, symbol, communityName,
            // communityENS, exchangeRate, paymasterAOA), which cannot be derived from just a
            // community address. Validate then throw rather than revert on-chain.
            validateAddress(community, 'community');
            throw new AAStarError(
                ErrorCode.NOT_IMPLEMENTED,
                'deployForCommunity was removed in the v5.x contract refactor; use ' +
                'deployxPNTsToken({ name, symbol, communityName, communityENS, exchangeRate, paymasterAOA }).'
            );
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

        async predictAddress({ community }) {
            // Removed in the v5.x contract refactor: xPNTsFactory exposes no CREATE2 address
            // predictor. Validate then throw rather than revert on-chain.
            validateAddress(community, 'community');
            throw new AAStarError(
                ErrorCode.NOT_IMPLEMENTED,
                'predictAddress was removed in the v5.x contract refactor; xPNTsFactory has no ' +
                'address predictor. Read the deployed token via getTokenAddress({ community }) ' +
                'or communityToToken({ community }) after deployment.'
            );
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
            // Removed in the v5.x contract refactor: xPNTsFactory has no token->community
            // reverse lookup (only the forward communityToToken/getTokenAddress mappings).
            // NOTE: communityToToken is the INVERSE direction and is NOT a substitute here.
            validateAddress(token, 'token');
            throw new AAStarError(
                ErrorCode.NOT_IMPLEMENTED,
                'getCommunityByToken was removed in the v5.x contract refactor; xPNTsFactory only ' +
                'maps community->token (communityToToken/getTokenAddress). Use isXPNTs(token) to ' +
                'check whether an address is a factory-deployed token.'
            );
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

        async setRegistry({ registry }) {
            // Removed in the v5.x contract refactor: xPNTsFactory.REGISTRY is immutable
            // (no `setRegistry` in the deployed ABI). Validate then throw rather than revert.
            validateAddress(registry, 'registry');
            throw new AAStarError(
                ErrorCode.NOT_IMPLEMENTED,
                'setRegistry was removed in the v5.x contract refactor; xPNTsFactory.REGISTRY is ' +
                'immutable (set at construction) and cannot be changed on-chain.'
            );
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

        async setImplementation({ impl }) {
            // Removed in the v5.x contract refactor: xPNTsFactory has no implementation setter
            // (the token `implementation()` is fixed). Validate then throw rather than revert.
            validateAddress(impl, 'impl');
            throw new AAStarError(
                ErrorCode.NOT_IMPLEMENTED,
                'setImplementation was removed in the v5.x contract refactor; xPNTsFactory has no ' +
                'implementation setter (the token implementation() is fixed at deployment).'
            );
        },

        async getImplementation() {
            try {
                // On-chain fn: implementation() — the legacy `getImplementation` getter was removed.
                return await (client as PublicClient).readContract({
                    address,
                    abi: xPNTsFactoryABI,
                    functionName: 'implementation',
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
                // On-chain fn: implementation() — the legacy `tokenImplementation` getter was removed.
                return await (client as PublicClient).readContract({
                    address,
                    abi: xPNTsFactoryABI,
                    functionName: 'implementation',
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
                // On-chain fn: registry() (lowercase) — PaymasterFactory has no `REGISTRY` constant.
                return await (client as PublicClient).readContract({
                    address,
                    abi: PaymasterFactoryABI,
                    functionName: 'registry',
                    args: []
                }) as Address;
            } catch (error) {
                throw AAStarError.fromViemError(error as Error, 'REGISTRY');
            }
        },

        async ENTRY_POINT() {
            // Removed in the v5.x contract refactor: PaymasterFactory has no `ENTRY_POINT`
            // constant. Throw rather than issue a call that reverts on-chain.
            throw new AAStarError(
                ErrorCode.NOT_IMPLEMENTED,
                'ENTRY_POINT was removed in the v5.x contract refactor; PaymasterFactory no longer ' +
                'exposes the EntryPoint address as a constant.'
            );
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

/**
 * Resolve the paymaster a PaymasterFactory deploy produced and check that `operator` really owns it.
 * Call this before anything funds, deposits to or registers the paymaster.
 *
 * A simulate() or predict address is not evidence: the deploy can still revert, and before
 * PaymasterFactory-1.1.0 a copied CREATE2 salt let anyone land their own clone at the predicted
 * address first (SP Daybreak DB-d-M3). So the address comes only from the PaymasterDeployed log of a
 * successful receipt (or, with no `deployHash`, from the factory mapping of an earlier deploy), and
 * then all three must name `operator`: paymasterByOperator, operatorByPaymaster and the clone's owner().
 * The three are read at one block number (the receipt's, or the latest one read once), and the hash of
 * that block is read again afterwards and must still be the one the check started from; a reorg at that
 * height during the check throws. Reading at the receipt's block needs a node that still serves that
 * block's state; a read failure throws with the block and the deploy hash.
 *
 * This is a client-side check at that block, not a guarantee at a later transaction: ownership can
 * change afterwards, and a reorg deeper than `confirmations` after the check can replace the deploy.
 * Callers that need more should raise `confirmations` and check again right before they send.
 */
export async function verifyPaymasterDeployment(
    client: PublicClient,
    args: { factory: Address; operator: Address; deployHash?: Hash; confirmations?: number }
): Promise<Address> {
    const { factory, operator, deployHash, confirmations } = args;
    validateAddress(factory, 'factory');
    validateAddress(operator, 'operator');
    const fail = (code: ErrorCode, msg: string): never => {
        throw new AAStarError(code, `verifyPaymasterDeployment: ${msg}; do not fund or register this paymaster`);
    };

    let paymaster: Address;
    let blockNumber: bigint;
    let blockHash: Hash;
    if (deployHash) {
        const receipt = await client.waitForTransactionReceipt({ hash: deployHash, confirmations });
        if (receipt.status !== 'success') fail(ErrorCode.CONTRACT_REVERT, `deploy tx ${deployHash} reverted`);
        const deployed = parseEventLogs({
            abi: PaymasterFactoryABI,
            eventName: 'PaymasterDeployed',
            logs: receipt.logs.filter((l) => isAddressEqual(l.address, factory)),
        }) as unknown as Array<{ args: { operator: Address; paymaster: Address } }>;
        const mine = deployed.filter((l) => isAddressEqual(l.args.operator, operator));
        if (mine.length !== 1) {
            fail(ErrorCode.CONTRACT_REVERT, `expected one PaymasterDeployed for ${operator} from ${factory} in ${deployHash}, found ${mine.length}`);
        }
        paymaster = mine[0].args.paymaster;
        blockNumber = receipt.blockNumber;
        blockHash = receipt.blockHash;
    } else {
        const latest = await client.getBlock();
        blockNumber = latest.number;
        blockHash = latest.hash;
    }
    const where = `at block ${blockNumber}${deployHash ? ` (deploy tx ${deployHash})` : ''}`;

    let byOperator: Address, byPaymaster: Address, owner: Address;
    try {
        if (!deployHash) {
            paymaster = await client.readContract({ address: factory, abi: PaymasterFactoryABI, functionName: 'getPaymasterByOperator', args: [operator], blockNumber }) as Address;
            if (isAddressEqual(paymaster, zeroAddress)) fail(ErrorCode.CONTRACT_REVERT, `factory ${factory} has no paymaster for ${operator}`);
        }
        [byOperator, byPaymaster, owner] = await Promise.all([
            client.readContract({ address: factory, abi: PaymasterFactoryABI, functionName: 'getPaymasterByOperator', args: [operator], blockNumber }) as Promise<Address>,
            client.readContract({ address: factory, abi: PaymasterFactoryABI, functionName: 'getOperatorByPaymaster', args: [paymaster!], blockNumber }) as Promise<Address>,
            client.readContract({ address: paymaster!, abi: PaymasterABI, functionName: 'owner', args: [], blockNumber }) as Promise<Address>,
        ]);
        const after = await client.getBlock({ blockNumber });
        if (after.hash !== blockHash) fail(ErrorCode.RPC_ERROR, `block ${blockNumber} changed from ${blockHash} to ${after.hash} during the check (reorg)`);
    } catch (error) {
        if (error instanceof AAStarError) throw error;
        return fail(ErrorCode.RPC_ERROR, `could not read the factory mapping or owner() ${where}; the node may not serve that block's state (${(error as Error).message})`);
    }
    paymaster = paymaster!;
    if (!isAddressEqual(byOperator, paymaster)) fail(ErrorCode.UNAUTHORIZED, `factory maps ${operator} to ${byOperator}, not ${paymaster}`);
    if (!isAddressEqual(byPaymaster, operator)) fail(ErrorCode.UNAUTHORIZED, `factory maps ${paymaster} to operator ${byPaymaster}, not ${operator}`);
    if (!isAddressEqual(owner, operator)) fail(ErrorCode.UNAUTHORIZED, `${paymaster}.owner() is ${owner}, not ${operator}`);
    return paymaster;
}
