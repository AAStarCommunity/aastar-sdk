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
    }
});
