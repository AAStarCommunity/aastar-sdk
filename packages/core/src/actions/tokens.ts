import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { GTokenABI, xPNTsTokenABI } from '../abis/index.js';
import { validateAddress, validateAmount, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

// ERC20 Standard Actions
export type ERC20Actions = {
    totalSupply: (args: { token: Address }) => Promise<bigint>;
    balanceOf: (args: { token: Address, account: Address }) => Promise<bigint>;
    transfer: (args: { token: Address, to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    transferFrom: (args: { token: Address, from: Address, to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    approve: (args: { token: Address, spender: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    allowance: (args: { token: Address, owner: Address, spender: Address }) => Promise<bigint>;
    name: (args: { token: Address }) => Promise<string>;
    symbol: (args: { token: Address }) => Promise<string>;
    decimals: (args: { token: Address }) => Promise<number>;
};

// GToken Actions (extends ERC20)
export type GTokenActions = ERC20Actions & {
    mint: (args: { token: Address, to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    burn: (args: { token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    burnFrom: (args: { token: Address, from: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    cap: (args: { token: Address }) => Promise<bigint>;
    remainingMintableSupply: (args: { token: Address }) => Promise<bigint>;
    version: (args: { token: Address }) => Promise<string>;
    owner: (args: { token: Address }) => Promise<Address>;
    transferOwnership: (args: { token: Address, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
};

// XPNTsToken Actions (extends ERC20 + aPNTs features + Spending Limits)
export type XPNTsTokenActions = ERC20Actions & {
    // Mint/Burn
    mint: (args: { token: Address, to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    burn: (args: { token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    burnFrom: (args: { token: Address, from: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    burnFromWithOpHash: (args: { token: Address, from: Address, amount: bigint, userOpHash: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // aPNTs features
    exchangeRate: (args: { token: Address }) => Promise<bigint>;
    updateExchangeRate: (args: { token: Address, newRate: bigint, account?: Account | Address }) => Promise<Hash>;
    debts: (args: { token: Address, user: Address }) => Promise<bigint>;
    getDebt: (args: { token: Address, user: Address }) => Promise<bigint>;
    recordDebt: (args: { token: Address, user: Address, amountXPNTs: bigint, account?: Account | Address }) => Promise<Hash>;
    repayDebt: (args: { token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Auto Approval
    addAutoApprovedSpender: (args: { token: Address, spender: Address, account?: Account | Address }) => Promise<Hash>;
    removeAutoApprovedSpender: (args: { token: Address, spender: Address, account?: Account | Address }) => Promise<Hash>;
    autoApprovedSpenders: (args: { token: Address, spender: Address }) => Promise<boolean>;
    emergencyRevokePaymaster: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Constants & View
    /** @deprecated The deployed xPNTsToken ABI renamed this constant to `MAX_SINGLE_TX_LIMIT_CAP`; this wrapper now reads that. Prefer {@link MAX_SINGLE_TX_LIMIT_CAP}. */
    MAX_SINGLE_TX_LIMIT: (args: { token: Address }) => Promise<bigint>;
    needsApproval: (args: { token: Address, owner: Address, spender: Address, amount: bigint }) => Promise<boolean>;
    
    // EIP-712 / EIP-2612
    DOMAIN_SEPARATOR: (args: { token: Address }) => Promise<Hex>;
    nonces: (args: { token: Address, owner: Address }) => Promise<bigint>;
    permit: (args: { token: Address, owner: Address, spender: Address, value: bigint, deadline: bigint, v: number, r: Hex, s: Hex, account?: Account | Address }) => Promise<Hash>;
    eip712Domain: (args: { token: Address }) => Promise<any>;
    
    // ERC677
    transferAndCall: (args: { token: Address, to: Address, amount: bigint, data?: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // Metadata & Config
    communityENS: (args: { token: Address }) => Promise<string>;
    communityName: (args: { token: Address }) => Promise<string>;
    communityOwner: (args: { token: Address }) => Promise<Address>;
    getMetadata: (args: { token: Address }) => Promise<{ name: string, symbol: string, communityName: string, communityENS: string, communityOwner: Address }>;
    transferCommunityOwnership: (args: { token: Address, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymasterAddress: (args: { token: Address, spAddress: Address, account?: Account | Address }) => Promise<Hash>;
    SUPERPAYMASTER_ADDRESS: (args: { token: Address }) => Promise<Address>;
    FACTORY: (args: { token: Address }) => Promise<Address>;
    version: (args: { token: Address }) => Promise<string>;
    usedOpHashes: (args: { token: Address, opHash: Hex }) => Promise<boolean>;

    // Spending Limits (admin writes)
    /** Set the per-tx burn ceiling. State-changing tx → resolves to a tx `Hash`. */
    setMaxSingleTxLimit: (args: { token: Address, newLimit: bigint, account?: Account | Address }) => Promise<Hash>;
    /** Set the per-spender daily burn cap (in whole tokens). State-changing tx → resolves to a tx `Hash`. */
    setSpenderDailyCap: (args: { token: Address, newCap: bigint, account?: Account | Address }) => Promise<Hash>;
    /** Set a per-spender daily burn-cap OVERRIDE for a specific spender (admin). State-changing tx → resolves to a tx `Hash`. */
    setSpenderDailyCapFor: (args: { token: Address, spender: Address, newCap: bigint, account?: Account | Address }) => Promise<Hash>;
    maxSingleTxLimit: (args: { token: Address }) => Promise<bigint>;
    spenderDailyCapTokens: (args: { token: Address }) => Promise<bigint>;
    /** Read a spender's daily-cap override (0 = no override; the global `spenderDailyCapTokens` applies). */
    spenderDailyCapOverride: (args: { token: Address, spender: Address }) => Promise<bigint>;
    spenderRateLimit: (args: { token: Address, spender: Address }) => Promise<{ dailyBurnTotal: bigint, windowStart: bigint, reserved: bigint }>;

    // Debt with op-hash replay protection
    /**
     * Record APNTs-denominated debt for a user, guarded by a unique `opHash` to prevent replay.
     * ABI: recordDebtWithOpHash(address user, uint256 amountAPNTs, bytes32 opHash). This is a
     * state-changing tx, so it resolves to the transaction `Hash`; the function has no return value.
     */
    recordDebtWithOpHash: (args: { token: Address, user: Address, amountAPNTs: bigint, opHash: Hex, account?: Account | Address }) => Promise<Hash>;
    usedDebtHashes: (args: { token: Address, opHash: Hex }) => Promise<boolean>;

    // Facilitator allow-list (admin writes)
    /** Add an approved facilitator. State-changing tx → resolves to a tx `Hash`. */
    addApprovedFacilitator: (args: { token: Address, facilitator: Address, account?: Account | Address }) => Promise<Hash>;
    /** Remove an approved facilitator. State-changing tx → resolves to a tx `Hash`. */
    removeApprovedFacilitator: (args: { token: Address, facilitator: Address, account?: Account | Address }) => Promise<Hash>;
    approvedFacilitators: (args: { token: Address, facilitator: Address }) => Promise<boolean>;

    // Factory / Emergency lifecycle (admin writes)
    /** Permanently renounce the factory link. State-changing tx → resolves to a tx `Hash`. */
    renounceFactory: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    /** Clear the emergency-disabled flag. State-changing tx → resolves to a tx `Hash`. */
    unsetEmergencyDisabled: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    emergencyDisabled: (args: { token: Address }) => Promise<boolean>;
    emergencyRevokedAddress: (args: { token: Address }) => Promise<Address>;
    exchangeRateUpdatedAt: (args: { token: Address }) => Promise<bigint>;

    // Exchange-rate guard constants (views)
    EXCHANGE_RATE_COOLDOWN: (args: { token: Address }) => Promise<bigint>;
    EXCHANGE_RATE_DELTA_BPS: (args: { token: Address }) => Promise<bigint>;
    EXCHANGE_RATE_MAX: (args: { token: Address }) => Promise<bigint>;
    EXCHANGE_RATE_MIN: (args: { token: Address }) => Promise<bigint>;
    MAX_SINGLE_TX_LIMIT_CAP: (args: { token: Address }) => Promise<bigint>;
};

// Unified TokenActions (deprecated legacy support)
export type TokenActions = GTokenActions & XPNTsTokenActions;

export const gTokenActions = (address?: Address) => (client: PublicClient | WalletClient): GTokenActions => {
    const abi = GTokenABI;
    const actions = {
        async totalSupply({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'totalSupply', args: [] }) as Promise<bigint>;
        },
        async balanceOf({ token = address, account }: { token?: Address, account: Address }) {
            validateAddress(token!, 'token');
            validateAddress(account, 'account');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'balanceOf', args: [account] }) as Promise<bigint>;
        },
        async transfer({ token = address, to, amount, account }: { token?: Address, to: Address, amount: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(to, 'to');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'transfer', args: [to, amount], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'transfer'); }
        },
        async transferFrom({ token = address, from, to, amount, account }: { token?: Address, from: Address, to: Address, amount: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(from, 'from');
                validateAddress(to, 'to');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'transferFrom', args: [from, to, amount], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'transferFrom'); }
        },
        async approve({ token = address, spender, amount, account }: { token?: Address, spender: Address, amount: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(spender, 'spender');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'approve', args: [spender, amount], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'approve'); }
        },
        async allowance({ token = address, owner, spender }: { token?: Address, owner: Address, spender: Address }) {
            validateAddress(token!, 'token');
            validateAddress(owner, 'owner');
            validateAddress(spender, 'spender');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'allowance', args: [owner, spender] }) as Promise<bigint>;
        },
        async mint({ token = address, to, amount, account }: { token?: Address, to: Address, amount: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(to, 'to');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'mint', args: [to, amount], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'mint'); }
        },
        async burn({ token = address, amount, account }: { token?: Address, amount: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'burn', args: [amount], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'burn'); }
        },
        async burnFrom({ token = address, from, amount, account }: { token?: Address, from: Address, amount: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(from, 'from');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'burnFrom', args: [from, amount], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'burnFrom'); }
        },
        async cap({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'cap', args: [] }) as Promise<bigint>;
        },
        async remainingMintableSupply({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'remainingMintableSupply', args: [] }) as Promise<bigint>;
        },
        async name({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'name', args: [] }) as Promise<string>;
        },
        async symbol({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'symbol', args: [] }) as Promise<string>;
        },
        async decimals({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'decimals', args: [] }) as Promise<number>;
        },
        async version({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'version', args: [] }) as Promise<string>;
        },
        async owner({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'owner', args: [] }) as Promise<Address>;
        },
        async transferOwnership({ token = address, newOwner, account }: { token?: Address, newOwner: Address, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(newOwner, 'newOwner');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'transferOwnership', args: [newOwner], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'transferOwnership'); }
        },
        async renounceOwnership({ token = address, account }: { token?: Address, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'renounceOwnership', args: [], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'renounceOwnership'); }
        },
    };
    return actions as GTokenActions;
};

export const xPNTsTokenActions = (address?: Address) => (client: PublicClient | WalletClient): XPNTsTokenActions => {
    const abi = xPNTsTokenABI;
    const actions = {
        async totalSupply({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'totalSupply', args: [] }) as Promise<bigint>;
        },
        async balanceOf({ token = address, account }: { token?: Address, account: Address }) {
            validateAddress(token!, 'token');
            validateAddress(account, 'account');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'balanceOf', args: [account] }) as Promise<bigint>;
        },
        async transfer({ token = address, to, amount, account }: { token?: Address, to: Address, amount: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(to, 'to');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'transfer', args: [to, amount], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'transfer'); }
        },
        async transferFrom({ token = address, from, to, amount, account }: { token?: Address, from: Address, to: Address, amount: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(from, 'from');
                validateAddress(to, 'to');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'transferFrom', args: [from, to, amount], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'transferFrom'); }
        },
        async approve({ token = address, spender, amount, account }: { token?: Address, spender: Address, amount: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(spender, 'spender');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'approve', args: [spender, amount], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'approve'); }
        },
        async allowance({ token = address, owner, spender }: { token?: Address, owner: Address, spender: Address }) {
            validateAddress(token!, 'token');
            validateAddress(owner, 'owner');
            validateAddress(spender, 'spender');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'allowance', args: [owner, spender] }) as Promise<bigint>;
        },
        async mint({ token = address, to, amount, account }: { token?: Address, to: Address, amount: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(to, 'to');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'mint', args: [to, amount], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'mint'); }
        },
        async burn({ token = address, amount, account }: { token?: Address, amount: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'burn', args: [amount], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'burn'); }
        },
        async burnFrom({ token = address, from, amount, account }: { token?: Address, from: Address, amount: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(from, 'from');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'burn', args: [from, amount], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'burnFrom'); }
        },
        async burnFromWithOpHash({ token = address, from, amount, userOpHash, account }: { token?: Address, from: Address, amount: bigint, userOpHash: Hex, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(from, 'from');
                validateAmount(amount, 'amount');
                validateRequired(userOpHash, 'userOpHash');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'burnFromWithOpHash', args: [from, amount, userOpHash], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'burnFromWithOpHash'); }
        },
        async name({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'name', args: [] }) as Promise<string>;
        },
        async symbol({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'symbol', args: [] }) as Promise<string>;
        },
        async decimals({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'decimals', args: [] }) as Promise<number>;
        },
        async version({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'version', args: [] }) as Promise<string>;
        },
        async exchangeRate({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'exchangeRate', args: [] }) as Promise<bigint>;
        },
        async updateExchangeRate({ token = address, newRate, account }: { token?: Address, newRate: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAmount(newRate, 'newRate');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'updateExchangeRate', args: [newRate], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'updateExchangeRate'); }
        },
        async debts({ token = address, user }: { token?: Address, user: Address }) {
            validateAddress(token!, 'token');
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({ 
                address: token!, 
                abi, 
                functionName: 'debts', 
                args: [user] 
            }) as bigint;
        },
        async getDebt({ token = address, user }: { token?: Address, user: Address }) {
            validateAddress(token!, 'token');
            validateAddress(user, 'user');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'getDebt', args: [user] }) as Promise<bigint>;
        },
        async recordDebt({ token = address, user, amountXPNTs, account }: { token?: Address, user: Address, amountXPNTs: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(user, 'user');
                validateAmount(amountXPNTs, 'amountXPNTs');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'recordDebt', args: [user, amountXPNTs], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'recordDebt'); }
        },
        async repayDebt({ token = address, amount, account }: { token?: Address, amount: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'repayDebt', args: [amount], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'repayDebt'); }
        },
        async MAX_SINGLE_TX_LIMIT({ token = address } = {}) {
            validateAddress(token!, 'token');
            // On-chain fn: MAX_SINGLE_TX_LIMIT_CAP() — the bare MAX_SINGLE_TX_LIMIT constant was renamed.
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'MAX_SINGLE_TX_LIMIT_CAP', args: [] }) as Promise<bigint>;
        },
        async needsApproval({ token = address, owner, spender, amount }: { token?: Address, owner: Address, spender: Address, amount: bigint }) {
            validateAddress(token!, 'token');
            validateAddress(owner, 'owner');
            validateAddress(spender, 'spender');
            validateAmount(amount, 'amount');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'needsApproval', args: [owner, spender, amount] }) as Promise<boolean>;
        },
        async addAutoApprovedSpender({ token = address, spender, account }: { token?: Address, spender: Address, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(spender, 'spender');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'addAutoApprovedSpender', args: [spender], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'addAutoApprovedSpender'); }
        },
        async removeAutoApprovedSpender({ token = address, spender, account }: { token?: Address, spender: Address, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(spender, 'spender');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'removeAutoApprovedSpender', args: [spender], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'removeAutoApprovedSpender'); }
        },
        async autoApprovedSpenders({ token = address, spender }: { token?: Address, spender: Address }) {
            validateAddress(token!, 'token');
            validateAddress(spender, 'spender');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'autoApprovedSpenders', args: [spender] }) as Promise<boolean>;
        },
        async emergencyRevokePaymaster({ token = address, account }: { token?: Address, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'emergencyRevokePaymaster', args: [], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'emergencyRevokePaymaster'); }
        },
        async DOMAIN_SEPARATOR({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'DOMAIN_SEPARATOR', args: [] }) as Promise<Hex>;
        },
        async nonces({ token = address, owner }: { token?: Address, owner: Address }) {
            validateAddress(token!, 'token');
            validateAddress(owner, 'owner');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'nonces', args: [owner] }) as Promise<bigint>;
        },
        async permit({ token = address, owner, spender, value, deadline, v, r, s, account }: { token?: Address, owner: Address, spender: Address, value: bigint, deadline: bigint, v: number, r: Hex, s: Hex, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(owner, 'owner');
                validateAddress(spender, 'spender');
                validateAmount(value, 'value');
                validateRequired(deadline, 'deadline');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'permit', args: [owner, spender, value, deadline, v, r, s], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'permit'); }
        },
        async eip712Domain({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'eip712Domain', args: [] }) as Promise<any>;
        },
        async transferAndCall({ token = address, to, amount, data = '0x', account }: { token?: Address, to: Address, amount: bigint, data?: Hex, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(to, 'to');
                validateAmount(amount, 'amount');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'transferAndCall', args: [to, amount, data], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'transferAndCall'); }
        },
        async communityENS({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'communityENS', args: [] }) as Promise<string>;
        },
        async communityName({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'communityName', args: [] }) as Promise<string>;
        },
        async communityOwner({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'communityOwner', args: [] }) as Promise<Address>;
        },
        async getMetadata({ token = address } = {}) {
            const abi = xPNTsTokenABI;
            const res = await (client as PublicClient).readContract({ 
                address: token!, 
                abi, 
                functionName: 'getMetadata', 
                args: [] 
            }) as any;

            if (Array.isArray(res)) {
                return {
                    name: res[0],
                    symbol: res[1],
                    communityName: res[2],
                    communityENS: res[3],
                    communityOwner: res[4]
                };
            }
            return res as { name: string, symbol: string, communityName: string, communityENS: string, communityOwner: Address };
        },
        async transferCommunityOwnership({ token = address, newOwner, account }: { token?: Address, newOwner: Address, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(newOwner, 'newOwner');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'transferCommunityOwnership', args: [newOwner], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'transferCommunityOwnership'); }
        },
        async setSuperPaymasterAddress({ token = address, spAddress, account }: { token?: Address, spAddress: Address, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(spAddress, 'spAddress');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'setSuperPaymasterAddress', args: [spAddress], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'setSuperPaymasterAddress'); }
        },
        async SUPERPAYMASTER_ADDRESS({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'SUPERPAYMASTER_ADDRESS', args: [] }) as Promise<Address>;
        },
        async FACTORY({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'FACTORY', args: [] }) as Promise<Address>;
        },
        async usedOpHashes({ token = address, opHash }: { token?: Address, opHash: Hex }) {
            validateAddress(token!, 'token');
            validateRequired(opHash, 'opHash');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'usedOpHashes', args: [opHash] }) as Promise<boolean>;
        },
        // --- Spending Limits ---
        async setMaxSingleTxLimit({ token = address, newLimit, account }: { token?: Address, newLimit: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAmount(newLimit, 'newLimit');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'setMaxSingleTxLimit', args: [newLimit], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'setMaxSingleTxLimit'); }
        },
        async setSpenderDailyCap({ token = address, newCap, account }: { token?: Address, newCap: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAmount(newCap, 'newCap');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'setSpenderDailyCap', args: [newCap], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'setSpenderDailyCap'); }
        },
        async setSpenderDailyCapFor({ token = address, spender, newCap, account }: { token?: Address, spender: Address, newCap: bigint, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(spender, 'spender');
                validateAmount(newCap, 'newCap');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'setSpenderDailyCapFor', args: [spender, newCap], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'setSpenderDailyCapFor'); }
        },
        async maxSingleTxLimit({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'maxSingleTxLimit', args: [] }) as Promise<bigint>;
        },
        async spenderDailyCapTokens({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'spenderDailyCapTokens', args: [] }) as Promise<bigint>;
        },
        async spenderDailyCapOverride({ token = address, spender }: { token?: Address, spender: Address }) {
            validateAddress(token!, 'token');
            validateAddress(spender, 'spender');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'spenderDailyCapOverride', args: [spender] }) as Promise<bigint>;
        },
        async spenderRateLimit({ token = address, spender }: { token?: Address, spender: Address }) {
            validateAddress(token!, 'token');
            validateAddress(spender, 'spender');
            // ABI: spenderRateLimit(address) -> (uint128 dailyBurnTotal, uint64 windowStart, uint64 reserved)
            const res = await (client as PublicClient).readContract({ address: token!, abi, functionName: 'spenderRateLimit', args: [spender] }) as any;
            if (Array.isArray(res)) {
                return { dailyBurnTotal: res[0] as bigint, windowStart: res[1] as bigint, reserved: res[2] as bigint };
            }
            return res as { dailyBurnTotal: bigint, windowStart: bigint, reserved: bigint };
        },
        // --- Debt with op-hash replay protection ---
        async recordDebtWithOpHash({ token = address, user, amountAPNTs, opHash, account }: { token?: Address, user: Address, amountAPNTs: bigint, opHash: Hex, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(user, 'user');
                validateAmount(amountAPNTs, 'amountAPNTs');
                validateRequired(opHash, 'opHash');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'recordDebtWithOpHash', args: [user, amountAPNTs, opHash], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'recordDebtWithOpHash'); }
        },
        async usedDebtHashes({ token = address, opHash }: { token?: Address, opHash: Hex }) {
            validateAddress(token!, 'token');
            validateRequired(opHash, 'opHash');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'usedDebtHashes', args: [opHash] }) as Promise<boolean>;
        },
        // --- Facilitator allow-list ---
        async addApprovedFacilitator({ token = address, facilitator, account }: { token?: Address, facilitator: Address, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(facilitator, 'facilitator');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'addApprovedFacilitator', args: [facilitator], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'addApprovedFacilitator'); }
        },
        async removeApprovedFacilitator({ token = address, facilitator, account }: { token?: Address, facilitator: Address, account?: Account | Address }) {
            try {
                validateAddress(token!, 'token');
                validateAddress(facilitator, 'facilitator');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'removeApprovedFacilitator', args: [facilitator], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'removeApprovedFacilitator'); }
        },
        async approvedFacilitators({ token = address, facilitator }: { token?: Address, facilitator: Address }) {
            validateAddress(token!, 'token');
            validateAddress(facilitator, 'facilitator');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'approvedFacilitators', args: [facilitator] }) as Promise<boolean>;
        },
        // --- Factory / Emergency lifecycle ---
        async renounceFactory({ token = address, account }: { token?: Address, account?: Account | Address } = {}) {
            try {
                validateAddress(token!, 'token');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'renounceFactory', args: [], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'renounceFactory'); }
        },
        async unsetEmergencyDisabled({ token = address, account }: { token?: Address, account?: Account | Address } = {}) {
            try {
                validateAddress(token!, 'token');
                return await (client as any).writeContract({ address: token!, abi, functionName: 'unsetEmergencyDisabled', args: [], account: account as any, chain: (client as any).chain });
            } catch (error) { throw AAStarError.fromViemError(error as Error, 'unsetEmergencyDisabled'); }
        },
        async emergencyDisabled({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'emergencyDisabled', args: [] }) as Promise<boolean>;
        },
        async emergencyRevokedAddress({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'emergencyRevokedAddress', args: [] }) as Promise<Address>;
        },
        async exchangeRateUpdatedAt({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'exchangeRateUpdatedAt', args: [] }) as Promise<bigint>;
        },
        // --- Exchange-rate guard constants ---
        async EXCHANGE_RATE_COOLDOWN({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'EXCHANGE_RATE_COOLDOWN', args: [] }) as Promise<bigint>;
        },
        async EXCHANGE_RATE_DELTA_BPS({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'EXCHANGE_RATE_DELTA_BPS', args: [] }) as Promise<bigint>;
        },
        async EXCHANGE_RATE_MAX({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'EXCHANGE_RATE_MAX', args: [] }) as Promise<bigint>;
        },
        async EXCHANGE_RATE_MIN({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'EXCHANGE_RATE_MIN', args: [] }) as Promise<bigint>;
        },
        async MAX_SINGLE_TX_LIMIT_CAP({ token = address } = {}) {
            validateAddress(token!, 'token');
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'MAX_SINGLE_TX_LIMIT_CAP', args: [] }) as Promise<bigint>;
        },
    };
    return actions as XPNTsTokenActions;
};

// Legacy compatibility
export const tokenActions = (address?: Address) => (client: PublicClient | WalletClient): TokenActions => {
    // This is essentially xPNTsTokenActions for now as it's the more complex one
    return xPNTsTokenActions(address)(client) as unknown as TokenActions;
};
