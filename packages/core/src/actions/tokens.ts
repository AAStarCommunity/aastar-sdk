import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { GTokenABI, xPNTsTokenABI } from '../abis/index.js';

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
    transferTokenOwnership: (args: { token: Address, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    
    // xPNTs/aPNTs specific
    updateExchangeRate: (args: { token: Address, newRate: bigint, account?: Account | Address }) => Promise<Hash>;
    getDebt: (args: { token: Address, user: Address }) => Promise<bigint>;
    repayDebt: (args: { token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    transferAndCall: (args: { token: Address, to: Address, amount: bigint, data?: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // aPNTs/xPNTs - Auto Approval
    addAutoApprovedSpender: (args: { token: Address, spender: Address, account?: Account | Address }) => Promise<Hash>;
    removeAutoApprovedSpender: (args: { token: Address, spender: Address, account?: Account | Address }) => Promise<Hash>;
    isAutoApprovedSpender: (args: { token: Address, spender: Address }) => Promise<boolean>;
    
    // Constants (aPNTs/xPNTs)
    SUPERPAYMASTER_ADDRESS: (args: { token: Address }) => Promise<Address>;
    FACTORY: (args: { token: Address }) => Promise<Address>;
    
    // Aliases & Missing
    transferOwnership: (args: { token: Address, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    transferCommunityOwnership: (args: { token: Address, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    
    // xPNTs Views
    communityName: (args: { token: Address }) => Promise<string>;
    communityENS: (args: { token: Address }) => Promise<string>;
    exchangeRate: (args: { token: Address }) => Promise<bigint>;
    spendingLimits: (args: { token: Address, user: Address }) => Promise<bigint>; // struct return shim
    defaultSpendingLimitXPNTs: (args: { token: Address }) => Promise<bigint>;
    cumulativeSpent: (args: { token: Address, user: Address }) => Promise<bigint>;
    debts: (args: { token: Address, user: Address }) => Promise<bigint>; // mapping
    usedOpHashes: (args: { token: Address, hash: Hex }) => Promise<boolean>;
    
    // EIP2612
    DOMAIN_SEPARATOR: (args: { token: Address }) => Promise<Hex>;
    nonces: (args: { token: Address, owner: Address }) => Promise<bigint>;
    permit: (args: { token: Address, owner: Address, spender: Address, value: bigint, deadline: bigint, v: number, r: Hex, s: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // xPNTs Additional
    autoApprovedSpenders: (args: { token: Address, spender: Address }) => Promise<boolean>;
    burnFromWithOpHash: (args: { token: Address, account: Address, amount: bigint, opHash: Hex, userOpAccount?: Account | Address }) => Promise<Hash>;
    communityOwner: (args: { token: Address }) => Promise<Address>;
    eip712Domain: (args: { token: Address }) => Promise<any>;
    getDefaultSpendingLimitXPNTs: (args: { token: Address }) => Promise<bigint>;
    getMetadata: (args: { token: Address }) => Promise<string>;
    needsApproval: (args: { token: Address, owner: Address, spender: Address, amount: bigint }) => Promise<boolean>;
    recordDebt: (args: { token: Address, user: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    DEFAULT_SPENDING_LIMIT_APNTS: (args: { token: Address }) => Promise<bigint>;
    
    // Admin
    setPaymasterLimit: (args: { token: Address, user: Address, limit: bigint, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymasterAddress: (args: { token: Address, superPaymaster: Address, account?: Account | Address }) => Promise<Hash>;
    version: (args: { token: Address }) => Promise<string>;
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
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'transfer', args: [to, amount], account: account as any, chain: (client as any).chain });
    },
    async transferFrom({ token, from, to, amount, account }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'transferFrom', args: [from, to, amount], account: account as any, chain: (client as any).chain });
    },
    async approve({ token, spender, amount, account }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'approve', args: [spender, amount], account: account as any, chain: (client as any).chain });
    },
    async allowance({ token, owner, spender }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'allowance', args: [owner, spender] }) as Promise<bigint>;
    },
    async mint({ token, to, amount, account }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'mint', args: [to, amount], account: account as any, chain: (client as any).chain });
    },
    async burn({ token, amount, account }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'burn', args: [amount], account: account as any, chain: (client as any).chain });
    },
    async burnFrom({ token, from, amount, account }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'burnFrom', args: [from, amount], account: account as any, chain: (client as any).chain });
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
    async transferTokenOwnership({ token, newOwner, account }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'transferOwnership', args: [newOwner], account: account as any, chain: (client as any).chain });
    },
    async renounceOwnership({ token, account }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'renounceOwnership', args: [], account: account as any, chain: (client as any).chain });
    },
});

export const tokenActions = () => (client: PublicClient | WalletClient): TokenActions => ({
    // ERC20 Standard
    async totalSupply({ token }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'totalSupply',
            args: []
        }) as Promise<bigint>;
    },

    async balanceOf({ token, account }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'balanceOf',
            args: [account]
        }) as Promise<bigint>;
    },

    async transfer({ token, to, amount, account }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'transfer',
            args: [to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async transferFrom({ token, from, to, amount, account }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'transferFrom',
            args: [from, to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async approve({ token, spender, amount, account }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'approve',
            args: [spender, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async allowance({ token, owner, spender }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'allowance',
            args: [owner, spender]
        }) as Promise<bigint>;
    },

    // Mintable/Burnable
    async mint({ token, to, amount, account }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'mint',
            args: [to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async burn({ token, amount, account }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'burn',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async burnFrom({ token, from, amount, account }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'burnFrom',
            args: [from, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // ERC20 Metadata
    async name({ token } = {} as any) {
        if (!token) throw new Error("Token address required");
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'name',
            args: []
        }) as Promise<string>;
    },

    async symbol({ token } = {} as any) {
        if (!token) throw new Error("Token address required");
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'symbol',
            args: []
        }) as Promise<string>;
    },

    async decimals({ token }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'decimals',
            args: []
        }) as Promise<number>;
    },

    // Ownable
    async owner({ token }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async transferTokenOwnership({ token, newOwner, account }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async renounceOwnership({ token, account }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // xPNTs/aPNTs specific
    async updateExchangeRate({ token, newRate, account }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'updateExchangeRate',
            args: [newRate],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getDebt({ token, user }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'getDebt',
            args: [user]
        }) as Promise<bigint>;
    },

    async repayDebt({ token, amount, account }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'repayDebt',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async transferAndCall({ token, to, amount, data = '0x', account }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'transferAndCall',
            args: [to, amount, data],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Auto Approval
    async addAutoApprovedSpender({ token, spender, account }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'addAutoApprovedSpender',
            args: [spender],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async removeAutoApprovedSpender({ token, spender, account }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'removeAutoApprovedSpender',
            args: [spender],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async isAutoApprovedSpender({ token, spender }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'isAutoApprovedSpender',
            args: [spender]
        }) as Promise<boolean>;
    },

    // Constants
    async SUPERPAYMASTER_ADDRESS({ token }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'SUPERPAYMASTER_ADDRESS',
            args: []
        }) as Promise<Address>;
    },

    async FACTORY({ token }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'FACTORY',
            args: []
        }) as Promise<Address>;
    },

    async transferOwnership(args) {
        return this.transferTokenOwnership(args);
    },

    async transferCommunityOwnership({ token, newOwner, account }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'transferCommunityOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // xPNTs Views
    async communityName({ token }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'communityName', args: [] }) as Promise<string>;
    },
    async communityENS({ token }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'communityENS', args: [] }) as Promise<string>;
    },
    async exchangeRate({ token }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'exchangeRate', args: [] }) as Promise<bigint>;
    },
    async spendingLimits({ token, user }) {
        // Struct return, usually returns tuple. We force basic type or handle tuple if needed.
        // For logic simplicity we return raw result, caller handles formatting if needs validation.
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'spendingLimits', args: [user] }) as Promise<bigint>; 
    },
    async defaultSpendingLimitXPNTs({ token }) {
        // Note: the ABI might name it differently, check audit report -> getDefaultSpendingLimitXPNTs
        // Actually audit report says "getDefaultSpendingLimitXPNTs" is missing.
        // Let's implement the getter if it effectively matches.
        // Wait, 'getDefaultSpendingLimitXPNTs' (function) vs 'defaultSpendingLimitXPNTs' (public var).
        // Let's try public var getter first.
        try {
             return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'defaultSpendingLimitXPNTs', args: [] }) as Promise<bigint>;
        } catch {
             return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'getDefaultSpendingLimitXPNTs', args: [] }) as Promise<bigint>;
        }
    },
    async cumulativeSpent({ token, user }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'cumulativeSpent', args: [user] }) as Promise<bigint>;
    },
    async debts({ token, user }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'debts', args: [user] }) as Promise<bigint>;
    },
    async usedOpHashes({ token, hash }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'usedOpHashes', args: [hash] }) as Promise<boolean>;
    },

    // EIP2612
    async DOMAIN_SEPARATOR({ token }) { // Fixed typo
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'DOMAIN_SEPARATOR', args: [] }) as Promise<Hex>;
    },
    async nonces({ token, owner }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'nonces', args: [owner] }) as Promise<bigint>;
    },
    async permit({ token, owner, spender, value, deadline, v, r, s, account }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'permit',
            args: [owner, spender, value, deadline, v, r, s],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // xPNTs Additional
    async autoApprovedSpenders({ token, spender }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'autoApprovedSpenders', args: [spender] }) as Promise<boolean>;
    },
    async burnFromWithOpHash({ token, account: user, amount, opHash, userOpAccount }) {
         return (client as any).writeContract({ address: token, abi: xPNTsTokenABI, functionName: 'burnFromWithOpHash', args: [user, amount, opHash], account: userOpAccount as any, chain: (client as any).chain });
    },
    async communityOwner({ token }) {
         return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'communityOwner', args: [] }) as Promise<Address>;
    },
    async eip712Domain({ token }) {
         return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'eip712Domain', args: [] }) as Promise<any>;
    },
    async getDefaultSpendingLimitXPNTs({ token }) {
         return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'getDefaultSpendingLimitXPNTs', args: [] }) as Promise<bigint>;
    },
    async getMetadata({ token }) {
         return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'getMetadata', args: [] }) as Promise<string>;
    },
    async needsApproval({ token, owner, spender, amount }) {
         return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'needsApproval', args: [owner, spender, amount] }) as Promise<boolean>;
    },
    async recordDebt({ token, user, amount, account }) {
         return (client as any).writeContract({ address: token, abi: xPNTsTokenABI, functionName: 'recordDebt', args: [user, amount], account: account as any, chain: (client as any).chain });
    },
    async DEFAULT_SPENDING_LIMIT_APNTS({ token }) {
         return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'DEFAULT_SPENDING_LIMIT_APNTS', args: [] }) as Promise<bigint>;
    },

    // Admin
    async setPaymasterLimit({ token, user, limit, account }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'setPaymasterLimit',
            args: [user, limit],
            account: account as any,
            chain: (client as any).chain
        });
    },
    async setSuperPaymasterAddress({ token, superPaymaster, account }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'setSuperPaymasterAddress',
            args: [superPaymaster],
            account: account as any,
            chain: (client as any).chain
        });
    },
    async version({ token }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'version', args: [] }) as Promise<string>;
    }
});
