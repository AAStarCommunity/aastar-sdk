import { type Address, parseAbi, type WalletClient, type PublicClient, type Hash, formatEther } from 'viem';
import { SuperPaymasterABI as SUPERPAYMASTER_ABI, CONTRACTS } from '@aastar/core';

const STAKING_ABI = parseAbi([
    'function stake(uint256)',
    'function withdraw(uint256)'
]);

const ERC20_ABI = parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
    'function transfer(address,uint256) returns (bool)'
]);

export class FinanceClient {
    constructor(
        private publicClient: PublicClient,
        private walletClient: WalletClient
    ) {}

    // ========== Existing static methods (preserved for backward compatibility) ==========
    
    /** @deprecated Use instance methods instead */
    static async depositToPaymaster(wallet: WalletClient, paymaster: Address, amount: bigint) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'deposit',
            args: [amount],
            chain: wallet.chain
        } as any);
    }

    /** @deprecated Use instance methods instead */
    static async depositViaTransferAndCall(wallet: WalletClient, token: Address, paymaster: Address, amount: bigint) {
        const ERC1363_ABI = [{
            name: 'transferAndCall',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
            outputs: [{ type: 'bool' }]
        }] as const;

        return wallet.writeContract({
            address: token,
            abi: ERC1363_ABI,
            functionName: 'transferAndCall',
            args: [paymaster, amount],
            chain: wallet.chain
        } as any);
    }

    /** @deprecated Use instance methods instead */
    static async stakeGToken(wallet: WalletClient, stakingAddr: Address, amount: bigint) {
         return wallet.writeContract({
            address: stakingAddr,
            abi: STAKING_ABI,
            functionName: 'stake',
            args: [amount],
            chain: wallet.chain
        } as any);
    }

    /** @deprecated Use instance methods instead */
    static async withdrawProtocolRevenue(wallet: WalletClient, paymaster: Address, to: Address, amount: bigint) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'withdrawProtocolRevenue',
            args: [to, amount],
            chain: wallet.chain
        } as any);
    }

    /** @deprecated Use instance methods instead */
    static async depositToEntryPoint(wallet: WalletClient, entryPoint: Address, paymaster: Address, amount: bigint) {
        return wallet.writeContract({
            address: entryPoint,
            abi: parseAbi(['function depositTo(address) payable']),
            functionName: 'depositTo',
            args: [paymaster],
            value: amount,
            chain: wallet.chain
        } as any);
    }

    /** @deprecated Use instance methods instead */
    static async getEntryPointBalance(client: any, entryPoint: Address, account: Address): Promise<bigint> {
        return client.readContract({
            address: entryPoint,
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [account]
        });
    }

    /** @deprecated Use instance methods instead */
    static async operatorDeposit(wallet: WalletClient, paymaster: Address, amount: bigint) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'deposit',
            args: [amount],
            chain: wallet.chain
        } as any);
    }

    /** @deprecated Use instance methods instead */
    static async operatorNotifyDeposit(wallet: WalletClient, paymaster: Address, amount: bigint) {
        return wallet.writeContract({
            address: paymaster,
            abi: SUPERPAYMASTER_ABI,
            functionName: 'notifyDeposit',
            args: [amount],
            chain: wallet.chain
        } as any);
    }

    // ========== New instance methods (business primitives) ==========

    /**
     * Get GToken balance
     */
    async getGTokenBalance(address: Address): Promise<bigint> {
        const { CORE_ADDRESSES } = await import('@aastar/core');
        return this.publicClient.readContract({
            address: CORE_ADDRESSES.gToken,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address]
        }) as Promise<bigint>;
    }

    /**
     * Get aPNTs balance
     */
    async getAPNTsBalance(address: Address): Promise<bigint> {
        const { CORE_ADDRESSES } = await import('@aastar/core');
        return this.publicClient.readContract({
            address: CORE_ADDRESSES.aPNTs,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address]
        }) as Promise<bigint>;
    }

    /**
     * One-step stake: Approve (if needed) + Stake
     * 
     * @param amount Amount of GToken to stake
     * @returns Transaction hash of the stake action
     */
    async approveAndStake(amount: bigint): Promise<Hash> {
        const account = this.walletClient.account;
        if (!account) throw new Error("Account required");

        const { CORE_ADDRESSES } = await import('@aastar/core');
        const gTokenAddress = CORE_ADDRESSES.gToken;
        const stakingAddress = CORE_ADDRESSES.gTokenStaking;
        
        // 1. Check Allowance
        const allowance = await this.publicClient.readContract({
            address: gTokenAddress,
            abi: parseAbi(['function allowance(address owner, address spender) view returns (uint256)']),
            functionName: 'allowance',
            args: [account.address, stakingAddress]
        }); // as bigint

        if ((allowance as bigint) < amount) {
            console.log(`[FinanceClient] Approving ${formatEther(amount)} GToken...`);
            const approveTx = await this.walletClient.writeContract({
                address: gTokenAddress,
                abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']),
                functionName: 'approve',
                args: [stakingAddress, amount],
                chain: this.walletClient.chain,
                account
            });
            await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
            console.log(`[FinanceClient] Approved.`);
        }

        // 2. Stake
        console.log(`[FinanceClient] Staking...`);
        return FinanceClient.stakeGToken(this.walletClient, stakingAddress, amount);
    }

    /**
     * Get circulating supply (total - locked)
     */
    async getCirculatingSupply(): Promise<{
        total: bigint;
        locked: bigint;
        circulating: bigint;
    }> {
        const { CORE_ADDRESSES } = await import('@aastar/core');
        const gTokenAddress = CORE_ADDRESSES.gToken;

        const total = await this.publicClient.readContract({
            address: gTokenAddress,
            abi: ERC20_ABI,
            functionName: 'totalSupply'
        }) as bigint;

        // In a real scenario, we might query GTokenStaking's totalStaked
        const locked = 0n;

        return {
            total,
            locked,
            circulating: total - locked
        };
    }

    /**
     * Get comprehensive tokenomics data
     */
    async getTokenomicsOverview(): Promise<{
        totalSupply: bigint;
        totalStaked: bigint;
        totalBurned: bigint;
        circulatingSupply: bigint;
        stakingRatio: number;
    }> {
        const { CORE_ADDRESSES } = await import('@aastar/core');
        
        const [totalSupply, totalStaked, blackholeBalance] = await Promise.all([
            this.publicClient.readContract({
                address: CORE_ADDRESSES.gToken,
                abi: parseAbi(['function totalSupply() view returns (uint256)']),
                functionName: 'totalSupply'
            }) as Promise<bigint>,
            this.publicClient.readContract({
                address: CORE_ADDRESSES.gTokenStaking,
                abi: parseAbi(['function totalStaked() view returns (uint256)']),
                functionName: 'totalStaked'
            }) as Promise<bigint>,
            this.publicClient.readContract({
                address: CORE_ADDRESSES.gToken,
                abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
                functionName: 'balanceOf',
                args: ['0x000000000000000000000000000000000000dEaD']
            }) as Promise<bigint>
        ]);

        const circulating = totalSupply - totalStaked - blackholeBalance;
        const ratio = Number(formatEther(totalStaked)) / Number(formatEther(totalSupply)) * 100;

        return {
            totalSupply,
            totalStaked,
            totalBurned: blackholeBalance,
            circulatingSupply: circulating,
            stakingRatio: ratio
        };
    }
}
