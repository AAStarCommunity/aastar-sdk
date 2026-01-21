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
            return (client as PublicClient).readContract({ address: token!, abi, functionName: 'MAX_SINGLE_TX_LIMIT', args: [] }) as Promise<bigint>;
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
    };
    return actions as XPNTsTokenActions;
};

// Legacy compatibility
export const tokenActions = (address?: Address) => (client: PublicClient | WalletClient): TokenActions => {
    // This is essentially xPNTsTokenActions for now as it's the more complex one
    return xPNTsTokenActions(address)(client) as unknown as TokenActions;
};
