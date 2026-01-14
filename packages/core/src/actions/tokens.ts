import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { GTokenABI, xPNTsTokenABI } from '../abis/index.js';

// Universal Token Actions for GToken, aPNTs, xPNTs
export type TokenActions = {
    // ERC20 Standard (all tokens)
    tokenTotalSupply: (args: { token: Address }) => Promise<bigint>;
    tokenBalanceOf: (args: { token: Address, account: Address }) => Promise<bigint>;
    tokenCap: (args: { token: Address }) => Promise<bigint>;
    tokenRemainingMintableSupply: (args: { token: Address }) => Promise<bigint>;
    tokenTransfer: (args: { token: Address, to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    tokenTransferFrom: (args: { token: Address, from: Address, to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    tokenApprove: (args: { token: Address, spender: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    tokenAllowance: (args: { token: Address, owner: Address, spender: Address }) => Promise<bigint>;
    
    // Mintable/Burnable
    tokenMint: (args: { token: Address, to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    tokenBurn: (args: { token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    tokenBurnFrom: (args: { token: Address, from: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // ERC20 Metadata
    tokenName: (args: { token: Address }) => Promise<string>;
    tokenSymbol: (args: { token: Address }) => Promise<string>;
    tokenDecimals: (args: { token: Address }) => Promise<number>;
    
    // Ownable
    tokenOwner: (args: { token: Address }) => Promise<Address>;
    tokenTransferTokenOwnership: (args: { token: Address, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    tokenRenounceOwnership: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    
    // xPNTs/aPNTs specific
    tokenUpdateExchangeRate: (args: { token: Address, newRate: bigint, account?: Account | Address }) => Promise<Hash>;
    tokenGetDebt: (args: { token: Address, user: Address }) => Promise<bigint>;
    tokenRepayDebt: (args: { token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    tokenTransferAndCall: (args: { token: Address, to: Address, amount: bigint, data?: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // aPNTs/xPNTs - Auto Approval
    tokenAddAutoApprovedSpender: (args: { token: Address, spender: Address, account?: Account | Address }) => Promise<Hash>;
    tokenRemoveAutoApprovedSpender: (args: { token: Address, spender: Address, account?: Account | Address }) => Promise<Hash>;
    tokenIsAutoApprovedSpender: (args: { token: Address, spender: Address }) => Promise<boolean>;
    
    // Constants (aPNTs/xPNTs)
    tokenSUPERPAYMASTER_ADDRESS: (args: { token: Address }) => Promise<Address>;
    tokenFACTORY: (args: { token: Address }) => Promise<Address>;
    
    // Aliases & Missing
    tokenTransferOwnership: (args: { token: Address, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    tokenTransferCommunityOwnership: (args: { token: Address, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    
    // xPNTs Views
    tokenCommunityName: (args: { token: Address }) => Promise<string>;
    tokenCommunityENS: (args: { token: Address }) => Promise<string>;
    tokenExchangeRate: (args: { token: Address }) => Promise<bigint>;
    tokenSpendingLimits: (args: { token: Address, user: Address }) => Promise<bigint>; // struct return shim
    tokenDefaultSpendingLimitXPNTs: (args: { token: Address }) => Promise<bigint>;
    tokenCumulativeSpent: (args: { token: Address, user: Address }) => Promise<bigint>;
    tokenDebts: (args: { token: Address, user: Address }) => Promise<bigint>; // mapping
    tokenUsedOpHashes: (args: { token: Address, hash: Hex }) => Promise<boolean>;
    
    // EIP2612
    tokenDOMAIN_SEPARATOR: (args: { token: Address }) => Promise<Hex>;
    tokenNonces: (args: { token: Address, owner: Address }) => Promise<bigint>;
    tokenPermit: (args: { token: Address, owner: Address, spender: Address, value: bigint, deadline: bigint, v: number, r: Hex, s: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // xPNTs Additional
    tokenAutoApprovedSpenders: (args: { token: Address, spender: Address }) => Promise<boolean>;
    tokenBurnFromWithOpHash: (args: { token: Address, account: Address, amount: bigint, opHash: Hex, userOpAccount?: Account | Address }) => Promise<Hash>;
    tokenCommunityOwner: (args: { token: Address }) => Promise<Address>;
    tokenEip712Domain: (args: { token: Address }) => Promise<any>;
    tokenGetDefaultSpendingLimitXPNTs: (args: { token: Address }) => Promise<bigint>;
    tokenGetMetadata: (args: { token: Address }) => Promise<string>;
    tokenNeedsApproval: (args: { token: Address, owner: Address, spender: Address, amount: bigint }) => Promise<boolean>;
    tokenRecordDebt: (args: { token: Address, user: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    tokenDEFAULT_SPENDING_LIMIT_APNTS: (args: { token: Address }) => Promise<bigint>;
    
    // Admin
    tokenSetPaymasterLimit: (args: { token: Address, user: Address, limit: bigint, account?: Account | Address }) => Promise<Hash>;
    tokenSetSuperPaymasterAddress: (args: { token: Address, superPaymaster: Address, account?: Account | Address }) => Promise<Hash>;
    tokenVersion: (args: { token: Address }) => Promise<string>;
};

function getTokenABI(token: Address): any {
    // Auto-detect ABI based on token type or use generic xPNTsTokenABI
    return xPNTsTokenABI;
}

export const gTokenActions = () => (client: PublicClient | WalletClient): TokenActions => ({
    // Use GTokenABI for everything
    ...tokenActions()(client),
    async tokenTotalSupply({ token }: { token: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'totalSupply', args: [] }) as Promise<bigint>;
    },
    async tokenBalanceOf({ token, account }: { token: Address, account: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'balanceOf', args: [account] }) as Promise<bigint>;
    },
    async tokenTransfer({ token, to, amount, account }: { token: Address, to: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'transfer', args: [to, amount], account: account as any, chain: (client as any).chain });
    },
    async tokenTransferFrom({ token, from, to, amount, account }: { token: Address, from: Address, to: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'transferFrom', args: [from, to, amount], account: account as any, chain: (client as any).chain });
    },
    async tokenApprove({ token, spender, amount, account }: { token: Address, spender: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'approve', args: [spender, amount], account: account as any, chain: (client as any).chain });
    },
    async tokenAllowance({ token, owner, spender }: { token: Address, owner: Address, spender: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'allowance', args: [owner, spender] }) as Promise<bigint>;
    },
    async tokenMint({ token, to, amount, account }: { token: Address, to: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'mint', args: [to, amount], account: account as any, chain: (client as any).chain });
    },
    async tokenBurn({ token, amount, account }: { token: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'burn', args: [amount], account: account as any, chain: (client as any).chain });
    },
    async tokenBurnFrom({ token, from, amount, account }: { token: Address, from: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'burnFrom', args: [from, amount], account: account as any, chain: (client as any).chain });
    },
    async tokenName({ token }: { token: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'name', args: [] }) as Promise<string>;
    },
    async tokenSymbol({ token }: { token: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'symbol', args: [] }) as Promise<string>;
    },
    async tokenDecimals({ token }: { token: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'decimals', args: [] }) as Promise<number>;
    },
    async tokenOwner({ token }: { token: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'owner', args: [] }) as Promise<Address>;
    },
    async tokenTransferTokenOwnership({ token, newOwner, account }: { token: Address, newOwner: Address, account?: Account | Address }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'transferOwnership', args: [newOwner], account: account as any, chain: (client as any).chain });
    },
    async tokenRenounceOwnership({ token, account }: { token: Address, account?: Account | Address }) {
        return (client as any).writeContract({ address: token, abi: GTokenABI, functionName: 'renounceOwnership', args: [], account: account as any, chain: (client as any).chain });
    },
    async tokenCap({ token }: { token: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'cap', args: [] }) as Promise<bigint>;
    },
    async tokenRemainingMintableSupply({ token }: { token: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: GTokenABI, functionName: 'remainingMintableSupply', args: [] }) as Promise<bigint>;
    },
});

export const tokenActions = () => (client: PublicClient | WalletClient): TokenActions => ({
    // ERC20 Standard
    async tokenTotalSupply({ token }: { token: Address }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'totalSupply',
            args: []
        }) as Promise<bigint>;
    },

    async tokenCap({ token }: { token: Address }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'cap',
            args: []
        }) as Promise<bigint>;
    },

    async tokenRemainingMintableSupply({ token }: { token: Address }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'remainingMintableSupply',
            args: []
        }) as Promise<bigint>;
    },

    async tokenBalanceOf({ token, account }: { token: Address, account: Address }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'balanceOf',
            args: [account]
        }) as Promise<bigint>;
    },

    async tokenTransfer({ token, to, amount, account }: { token: Address, to: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'transfer',
            args: [to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async tokenTransferFrom({ token, from, to, amount, account }: { token: Address, from: Address, to: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'transferFrom',
            args: [from, to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async tokenApprove({ token, spender, amount, account }: { token: Address, spender: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'approve',
            args: [spender, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async tokenAllowance({ token, owner, spender }: { token: Address, owner: Address, spender: Address }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'allowance',
            args: [owner, spender]
        }) as Promise<bigint>;
    },

    // Mintable/Burnable
    async tokenMint({ token, to, amount, account }: { token: Address, to: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'mint',
            args: [to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async tokenBurn({ token, amount, account }: { token: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'burn',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async tokenBurnFrom({ token, from, amount, account }: { token: Address, from: Address, amount: bigint, account?: Account | Address }) {
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
    async tokenName({ token }: { token: Address }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'name',
            args: []
        }) as Promise<string>;
    },

    async tokenSymbol({ token }: { token: Address }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'symbol',
            args: []
        }) as Promise<string>;
    },

    async tokenDecimals({ token }: { token: Address }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'decimals',
            args: []
        }) as Promise<number>;
    },

    // Ownable
    async tokenOwner({ token }: { token: Address }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async tokenTransferTokenOwnership({ token, newOwner, account }: { token: Address, newOwner: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async tokenRenounceOwnership({ token, account }: { token: Address, account?: Account | Address }) {
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
    async tokenUpdateExchangeRate({ token, newRate, account }: { token: Address, newRate: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'updateExchangeRate',
            args: [newRate],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async tokenGetDebt({ token, user }: { token: Address, user: Address }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'getDebt',
            args: [user]
        }) as Promise<bigint>;
    },

    async tokenRepayDebt({ token, amount, account }: { token: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address: token,
            abi: getTokenABI(token),
            functionName: 'repayDebt',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async tokenTransferAndCall({ token, to, amount, data = '0x', account }: { token: Address, to: Address, amount: bigint, data?: Hex, account?: Account | Address }) {
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
    async tokenAddAutoApprovedSpender({ token, spender, account }: { token: Address, spender: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'addAutoApprovedSpender',
            args: [spender],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async tokenRemoveAutoApprovedSpender({ token, spender, account }: { token: Address, spender: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'removeAutoApprovedSpender',
            args: [spender],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async tokenIsAutoApprovedSpender({ token, spender }: { token: Address, spender: Address }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'isAutoApprovedSpender',
            args: [spender]
        }) as Promise<boolean>;
    },

    // Constants
    async tokenSUPERPAYMASTER_ADDRESS({ token }: { token: Address }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'SUPERPAYMASTER_ADDRESS',
            args: []
        }) as Promise<Address>;
    },

    async tokenFACTORY({ token }: { token: Address }) {
        return (client as PublicClient).readContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'FACTORY',
            args: []
        }) as Promise<Address>;
    },

    async tokenTransferOwnership(args: { token: Address, newOwner: Address, account?: Account | Address }) {
        return this.tokenTransferTokenOwnership(args);
    },

    async tokenTransferCommunityOwnership({ token, newOwner, account }: { token: Address, newOwner: Address, account?: Account | Address }) {
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
    async tokenCommunityName({ token }: { token: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'communityName', args: [] }) as Promise<string>;
    },
    async tokenCommunityENS({ token }: { token: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'communityENS', args: [] }) as Promise<string>;
    },
    async tokenExchangeRate({ token }: { token: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'exchangeRate', args: [] }) as Promise<bigint>;
    },
    async tokenSpendingLimits({ token, user }: { token: Address, user: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'spendingLimits', args: [user] }) as Promise<bigint>; 
    },
    async tokenDefaultSpendingLimitXPNTs({ token }: { token: Address }) {
        try {
             return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'defaultSpendingLimitXPNTs', args: [] }) as Promise<bigint>;
        } catch {
             return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'getDefaultSpendingLimitXPNTs', args: [] }) as Promise<bigint>;
        }
    },
    async tokenCumulativeSpent({ token, user }: { token: Address, user: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'cumulativeSpent', args: [user] }) as Promise<bigint>;
    },
    async tokenDebts({ token, user }: { token: Address, user: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'debts', args: [user] }) as Promise<bigint>;
    },
    async tokenUsedOpHashes({ token, hash }: { token: Address, hash: Hex }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'usedOpHashes', args: [hash] }) as Promise<boolean>;
    },

    // EIP2612
    async tokenDOMAIN_SEPARATOR({ token }: { token: Address }) { 
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'DOMAIN_SEPARATOR', args: [] }) as Promise<Hex>;
    },
    async tokenNonces({ token, owner }: { token: Address, owner: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'nonces', args: [owner] }) as Promise<bigint>;
    },
    async tokenPermit({ token, owner, spender, value, deadline, v, r, s, account }: { token: Address, owner: Address, spender: Address, value: bigint, deadline: bigint, v: number, r: Hex, s: Hex, account?: Account | Address }) {
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
    async tokenAutoApprovedSpenders({ token, spender }: { token: Address, spender: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'autoApprovedSpenders', args: [spender] }) as Promise<boolean>;
    },
    async tokenBurnFromWithOpHash({ token, account: user, amount, opHash, userOpAccount }: { token: Address, account: Address, amount: bigint, opHash: Hex, userOpAccount?: Account | Address }) {
         return (client as any).writeContract({ address: token, abi: xPNTsTokenABI, functionName: 'burnFromWithOpHash', args: [user, amount, opHash], account: userOpAccount as any, chain: (client as any).chain });
    },
    async tokenCommunityOwner({ token }: { token: Address }) {
         return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'communityOwner', args: [] }) as Promise<Address>;
    },
    async tokenEip712Domain({ token }: { token: Address }) {
         return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'eip712Domain', args: [] }) as Promise<any>;
    },
    async tokenGetDefaultSpendingLimitXPNTs({ token }: { token: Address }) {
         return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'getDefaultSpendingLimitXPNTs', args: [] }) as Promise<bigint>;
    },
    async tokenGetMetadata({ token }: { token: Address }) {
         return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'getMetadata', args: [] }) as Promise<string>;
    },
    async tokenNeedsApproval({ token, owner, spender, amount }: { token: Address, owner: Address, spender: Address, amount: bigint }) {
         return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'needsApproval', args: [owner, spender, amount] }) as Promise<boolean>;
    },
    async tokenRecordDebt({ token, user, amount, account }: { token: Address, user: Address, amount: bigint, account?: Account | Address }) {
         return (client as any).writeContract({ address: token, abi: xPNTsTokenABI, functionName: 'recordDebt', args: [user, amount], account: account as any, chain: (client as any).chain });
    },
    async tokenDEFAULT_SPENDING_LIMIT_APNTS({ token }: { token: Address }) {
         return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'DEFAULT_SPENDING_LIMIT_APNTS', args: [] }) as Promise<bigint>;
    },

    // Admin
    async tokenSetPaymasterLimit({ token, user, limit, account }: { token: Address, user: Address, limit: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'setPaymasterLimit',
            args: [user, limit],
            account: account as any,
            chain: (client as any).chain
        });
    },
    async tokenSetSuperPaymasterAddress({ token, superPaymaster, account }: { token: Address, superPaymaster: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address: token,
            abi: xPNTsTokenABI,
            functionName: 'setSuperPaymasterAddress',
            args: [superPaymaster],
            account: account as any,
            chain: (client as any).chain
        });
    },
    async tokenVersion({ token }: { token: Address }) {
        return (client as PublicClient).readContract({ address: token, abi: xPNTsTokenABI, functionName: 'version', args: [] }) as Promise<string>;
    }
});
