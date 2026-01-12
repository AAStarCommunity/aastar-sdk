import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { GTokenABI } from '../abis/index.js';

// GToken 扩展功能 (补充完整的 ERC20 + Ownable + Pausable)
export type GTokenExtendedActions = {
    // 已有的标准 ERC20 在 tokens.ts 中
    
    // Minting & Burning
    mint: (args: { to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    burn: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    burnFrom: (args: { from: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Cap & Minter
    cap: () => Promise<bigint>;
    minter: () => Promise<Address>;
    setMinter: (args: { minter: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Pause
    pause: (args: { account?: Account | Address }) => Promise<Hash>;
    unpause: (args: { account?: Account | Address }) => Promise<Hash>;
    paused: () => Promise<boolean>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
};

export const gTokenExtendedActions = (address: Address) => (client: PublicClient | WalletClient): GTokenExtendedActions => ({
    async mint({ to, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenABI,
            functionName: 'mint',
            args: [to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async burn({ amount, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenABI,
            functionName: 'burn',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async burnFrom({ from, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenABI,
            functionName: 'burnFrom',
            args: [from, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async cap() {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenABI,
            functionName: 'cap',
            args: []
        }) as Promise<bigint>;
    },

    async minter() {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenABI,
            functionName: 'minter',
            args: []
        }) as Promise<Address>;
    },

    async setMinter({ minter, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenABI,
            functionName: 'setMinter',
            args: [minter],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async pause({ account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenABI,
            functionName: 'pause',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async unpause({ account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenABI,
            functionName: 'unpause',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paused() {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenABI,
            functionName: 'paused',
            args: []
        }) as Promise<boolean>;
    },

    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: GTokenABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async transferOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async renounceOwnership({ account }) {
        return (client as any).writeContract({
            address,
            abi: GTokenABI,
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    }
});
