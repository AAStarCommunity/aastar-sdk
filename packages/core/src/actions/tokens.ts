import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { GTokenABI, xPNTsTokenABI } from '../abis/index.js';
import { validateAddress, validateAmount, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

// Universal Token Actions for GToken, aPNTs, xPNTs
export type TokenActions = {
    // ERC20 Standard (all tokens)
    totalSupply: (args: { token: Address }) => Promise<bigint>;
    balanceOf: (args: { token: Address, account: Address }) => Promise<bigint>;
    transfer: (args: { token: Address, to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    transferFrom: (args: { token: Address, from: Address, to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    approve: (args: { token: Address, spender: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    allowance: (args: { token: Address, owner: Address, spender: Address }) => Promise<bigint>;
    
    // Mintable/Burnable
    mint: (args: { token: Address, to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    burn: (args: { token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    burnFrom: (args: { token: Address, from: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // ERC20 Metadata
    name: (args: { token: Address }) => Promise<string>;
    symbol: (args: { token: Address }) => Promise<string>;
    decimals: (args: { token: Address }) => Promise<number>;
    
    // Ownable
    owner: (args: { token: Address }) => Promise<Address>;
    transferOwnership: (args: { token: Address, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    
    // xPNTs/aPNTs specific
    exchangeRate: (args: { token: Address }) => Promise<bigint>;
    debts: (args: { token: Address, user: Address }) => Promise<bigint>;
    recordDebt: (args: { token: Address, user: Address, amountXPNTs: bigint, account?: Account | Address }) => Promise<Hash>;
    burnFromWithOpHash: (args: { token: Address, from: Address, amount: bigint, userOpHash: Hex, account?: Account | Address }) => Promise<Hash>;
    usedOpHashes: (args: { token: Address, opHash: Hex }) => Promise<boolean>;
    communityOwner: (args: { token: Address }) => Promise<Address>;
    transferCommunityOwnership: (args: { token: Address, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymasterAddress: (args: { token: Address, spAddress: Address, account?: Account | Address }) => Promise<Hash>;
    updateExchangeRate: (args: { token: Address, newRate: bigint, account?: Account | Address }) => Promise<Hash>;
    getDebt: (args: { token: Address, user: Address }) => Promise<bigint>;
    repayDebt: (args: { token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    transferAndCall: (args: { token: Address, to: Address, amount: bigint, data?: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // xPNTsToken - Spending Limits
    spendingLimits: (args: { token: Address, owner: Address, spender: Address }) => Promise<bigint>;
    cumulativeSpent: (args: { token: Address, owner: Address, spender: Address }) => Promise<bigint>;
    setPaymasterLimit: (args: { token: Address, spender: Address, limit: bigint, account?: Account | Address }) => Promise<Hash>;
    DEFAULT_SPENDING_LIMIT_APNTS: (args: { token: Address }) => Promise<bigint>;
    getDefaultSpendingLimitXPNTs: (args: { token: Address }) => Promise<bigint>;
    
    // Community Metadata
    communityENS: (args: { token: Address }) => Promise<string>;
    communityName: (args: { token: Address }) => Promise<string>;
    getMetadata: (args: { token: Address }) => Promise<{ name: string, symbol: string, ens: string, logo: string, owner: Address }>;
    version: (args: { token: Address }) => Promise<string>;
    
    // EIP-712 / EIP-2612
    DOMAIN_SEPARATOR: (args: { token: Address }) => Promise<Hex>;
    nonces: (args: { token: Address, owner: Address }) => Promise<bigint>;
    autoApprovedSpenders: (args: { token: Address, spender: Address }) => Promise<boolean>;
    needsApproval: (args: { token: Address, owner: Address, spender: Address, amount: bigint }) => Promise<boolean>;
    eip712Domain: (args: { token: Address }) => Promise<any>;
    permit: (args: { token: Address, owner: Address, spender: Address, value: bigint, deadline: bigint, v: number, r: Hex, s: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // aPNTs/xPNTs - Auto Approval
    addAutoApprovedSpender: (args: { token: Address, spender: Address, account?: Account | Address }) => Promise<Hash>;
    removeAutoApprovedSpender: (args: { token: Address, spender: Address, account?: Account | Address }) => Promise<Hash>;
    isAutoApprovedSpender: (args: { token: Address, spender: Address }) => Promise<boolean>;
    
    // Constants (aPNTs/xPNTs)
    SUPERPAYMASTER_ADDRESS: (args: { token: Address }) => Promise<Address>;
    FACTORY: (args: { token: Address }) => Promise<Address>;
};

function getTokenABI(token: Address): any {
    // Auto-detect ABI based on token type or use generic xPNTsTokenABI
    return xPNTsTokenABI;
}

export const gTokenActions = () => (client: PublicClient | WalletClient): TokenActions => ({
    // Use GTokenABI for everything
    ...tokenActions()(client),
    async totalSupply({ token }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'totalSupply', args: [] }) as Promise<bigint>;
    },
    async balanceOf({ token, account }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'balanceOf', args: [account] }) as Promise<bigint>;
    },
    async transfer({ token, to, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(to, 'to');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'transfer', args: [to, amount], account: account as any, chain: (client as any).chain });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transfer');
        }
    },
    async transferFrom({ token, from, to, amount, account }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'transferFrom', args: [from, to, amount], account: account as any, chain: (client as any).chain });
    },
    async approve({ token, spender, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(spender, 'spender');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'approve', args: [spender, amount], account: account as any, chain: (client as any).chain });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'approve');
        }
    },
    async allowance({ token, owner, spender }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'allowance', args: [owner, spender] }) as Promise<bigint>;
    },
    async mint({ token, to, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(to, 'to');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'mint', args: [to, amount], account: account as any, chain: (client as any).chain });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'mint');
        }
    },
    async burn({ token, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'burn', args: [amount], account: account as any, chain: (client as any).chain });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'burn');
        }
    },
    async burnFrom({ token, from, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(from, 'from');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'burnFrom', args: [from, amount], account: account as any, chain: (client as any).chain });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'burnFrom');
        }
    },
    async name({ token }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'name', args: [] }) as Promise<string>;
    },
    async symbol({ token }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'symbol', args: [] }) as Promise<string>;
    },
    async decimals({ token }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'decimals', args: [] }) as Promise<number>;
    },
    async owner({ token }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'owner', args: [] }) as Promise<Address>;
    },
    async transferOwnership({ token, newOwner, account }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'transferOwnership', args: [newOwner], account: account as any, chain: (client as any).chain });
    },
    async renounceOwnership({ token, account }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'renounceOwnership', args: [], account: account as any, chain: (client as any).chain });
    },
});

export const tokenActions = () => (client: PublicClient | WalletClient): TokenActions => ({
    // ERC20 Standard
    async totalSupply({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'totalSupply',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'totalSupply');
        }
    },

    async balanceOf({ token, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(account, 'account');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'balanceOf',
                args: [account]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'balanceOf');
        }
    },

    async transfer({ token, to, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(to, 'to');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'transfer',
                args: [to, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transfer');
        }
    },

    async transferFrom({ token, from, to, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(from, 'from');
            validateAddress(to, 'to');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'transferFrom',
                args: [from, to, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transferFrom');
        }
    },

    async approve({ token, spender, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(spender, 'spender');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'approve',
                args: [spender, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'approve');
        }
    },

    async allowance({ token, owner, spender }) {
        try {
            validateAddress(token, 'token');
            validateAddress(owner, 'owner');
            validateAddress(spender, 'spender');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'allowance',
                args: [owner, spender]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'allowance');
        }
    },

    // Mintable/Burnable
    async mint({ token, to, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(to, 'to');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'mint',
                args: [to, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'mint');
        }
    },

    async burn({ token, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'burn',
                args: [amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'burn');
        }
    },

    async burnFrom({ token, from, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(from, 'from');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'burnFrom',
                args: [from, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'burnFrom');
        }
    },

    // ERC20 Metadata
    async name({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'name',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'name');
        }
    },

    async symbol({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'symbol',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'symbol');
        }
    },

    async decimals({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'decimals',
                args: []
            }) as Promise<number>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'decimals');
        }
    },

    // Ownable
    async owner({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'owner',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'owner');
        }
    },

    async transferOwnership({ token, newOwner, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(newOwner, 'newOwner');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'transferOwnership',
                args: [newOwner],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transferOwnership');
        }
    },

    async renounceOwnership({ token, account }) {
        try {
            validateAddress(token, 'token');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'renounceOwnership',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'renounceOwnership');
        }
    },

    // xPNTs/aPNTs specific
    async exchangeRate({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'exchangeRate',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'exchangeRate');
        }
    },

    async debts({ token, user }) {
        try {
            validateAddress(token, 'token');
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'debts',
                args: [user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'debts');
        }
    },

    async recordDebt({ token, user, amountXPNTs, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(user, 'user');
            validateAmount(amountXPNTs, 'amountXPNTs');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'recordDebt',
                args: [user, amountXPNTs],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'recordDebt');
        }
    },

    async repayDebt({ token, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'repayDebt',
                args: [amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'repayDebt');
        }
    },

    async transferAndCall({ token, to, amount, data = '0x', account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(to, 'to');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'transferAndCall',
                args: [to, amount, data],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transferAndCall');
        }
    },

    async updateExchangeRate({ token, newRate, account }) {
        try {
            validateAddress(token, 'token');
            validateAmount(newRate, 'newRate');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'updateExchangeRate',
                args: [newRate],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'updateExchangeRate');
        }
    },

    async getDebt({ token, user }) {
        try {
            validateAddress(token, 'token');
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'getDebt',
                args: [user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getDebt');
        }
    },



    async burnFromWithOpHash({ token, from, amount, userOpHash, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(from, 'from');
            validateAmount(amount, 'amount');
            validateRequired(userOpHash, 'userOpHash');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'burnFromWithOpHash',
                args: [from, amount, userOpHash],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'burnFromWithOpHash');
        }
    },

    async usedOpHashes({ token, opHash }) {
        try {
            validateAddress(token, 'token');
            validateRequired(opHash, 'opHash');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'usedOpHashes',
                args: [opHash]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'usedOpHashes');
        }
    },

    async communityOwner({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'communityOwner',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityOwner');
        }
    },

    async transferCommunityOwnership({ token, newOwner, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(newOwner, 'newOwner');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'transferCommunityOwnership',
                args: [newOwner],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transferCommunityOwnership');
        }
    },

    async setSuperPaymasterAddress({ token, spAddress, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(spAddress, 'spAddress');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'setSuperPaymasterAddress',
                args: [spAddress],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setSuperPaymasterAddress');
        }
    },

    // xPNTsToken - Spending Limits
    async spendingLimits({ token, owner, spender }) {
        try {
            validateAddress(token, 'token');
            validateAddress(owner, 'owner');
            validateAddress(spender, 'spender');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'spendingLimits',
                args: [owner, spender]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'spendingLimits');
        }
    },

    async cumulativeSpent({ token, owner, spender }) {
        try {
            validateAddress(token, 'token');
            validateAddress(owner, 'owner');
            validateAddress(spender, 'spender');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'cumulativeSpent',
                args: [owner, spender]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'cumulativeSpent');
        }
    },

    async setPaymasterLimit({ token, spender, limit, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(spender, 'spender');
            validateAmount(limit, 'limit');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'setPaymasterLimit',
                args: [spender, limit],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setPaymasterLimit');
        }
    },

    async DEFAULT_SPENDING_LIMIT_APNTS({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'DEFAULT_SPENDING_LIMIT_APNTS',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'DEFAULT_SPENDING_LIMIT_APNTS');
        }
    },

    async getDefaultSpendingLimitXPNTs({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'getDefaultSpendingLimitXPNTs',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getDefaultSpendingLimitXPNTs');
        }
    },

    // Community Metadata
    async communityENS({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'communityENS',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityENS');
        }
    },

    async communityName({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'communityName',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityName');
        }
    },

    async getMetadata({ token }) {
        try {
            validateAddress(token, 'token');
            const result = await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'getMetadata',
                args: []
            }) as any;
            return {
                name: result[0],
                symbol: result[1],
                ens: result[2],
                logo: result[3],
                owner: result[4]
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getMetadata');
        }
    },

    async version({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'version',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    },

    // aPNTs/xPNTs - Auto Approval
    async addAutoApprovedSpender({ token, spender, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(spender, 'spender');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'addAutoApprovedSpender',
                args: [spender],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'addAutoApprovedSpender');
        }
    },

    async removeAutoApprovedSpender({ token, spender, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(spender, 'spender');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'removeAutoApprovedSpender',
                args: [spender],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'removeAutoApprovedSpender');
        }
    },

    async isAutoApprovedSpender({ token, spender }) {
        try {
            validateAddress(token, 'token');
            validateAddress(spender, 'spender');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'isAutoApprovedSpender',
                args: [spender]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isAutoApprovedSpender');
        }
    },

    // EIP-712 / EIP-2612
    async DOMAIN_SEPARATOR({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'DOMAIN_SEPARATOR',
                args: []
            }) as Promise<Hex>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'DOMAIN_SEPARATOR');
        }
    },

    async nonces({ token, owner }) {
        try {
            validateAddress(token, 'token');
            validateAddress(owner, 'owner');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'nonces',
                args: [owner]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'nonces');
        }
    },

    async autoApprovedSpenders({ token, spender }) {
        try {
            validateAddress(token, 'token');
            validateAddress(spender, 'spender');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'autoApprovedSpenders',
                args: [spender]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'autoApprovedSpenders');
        }
    },

    async needsApproval({ token, owner, spender, amount }) {
        try {
            validateAddress(token, 'token');
            validateAddress(owner, 'owner');
            validateAddress(spender, 'spender');
            validateAmount(amount, 'amount');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'needsApproval',
                args: [owner, spender, amount]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'needsApproval');
        }
    },

    async eip712Domain({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'eip712Domain',
                args: []
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'eip712Domain');
        }
    },

    async permit({ token, owner, spender, value, deadline, v, r, s, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(owner, 'owner');
            validateAddress(spender, 'spender');
            validateAmount(value, 'value');
            return await (client as any).writeContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'permit',
                args: [owner, spender, value, deadline, v, r, s],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'permit');
        }
    },

    // Constants
    async SUPERPAYMASTER_ADDRESS({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'SUPERPAYMASTER_ADDRESS',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'SUPERPAYMASTER_ADDRESS');
        }
    },

    async FACTORY({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address: token,
                abi: getTokenABI(token),
                functionName: 'FACTORY',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'FACTORY');
        }
    }
});
