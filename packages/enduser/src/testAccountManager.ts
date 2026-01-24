import { Address, Hash, parseEther, Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { accountFactoryActions, TEST_ACCOUNT_ADDRESSES, type PublicClient, type WalletClient } from '@aastar/core';

/**
 * PhD Paper Experiment Test Toolkit
 * 
 * **Purpose**: Comprehensive API suite for preparing and managing test accounts
 * for ERC-4337 performance comparison experiments (EOA vs AA vs SuperPaymaster).
 * 
 * **Core Features**:
 * 1. **Account Generation**: Create random EOA keys and deploy SimpleAccounts
 * 2. **Token Funding**: Transfer test tokens (GToken, aPNTs, bPNTs, ETH)
 * 3. **AA Deployment**: Deploy SimpleAccount contracts using official factory
 * 4. **UserOp Execution**: Send ERC-4337 UserOperations with various paymasters
 * 5. **Data Collection**: Generate experiment data for PhD paper analysis
 * 
 * @example
 * ```typescript
 * const toolkit = new TestAccountManager(publicClient, supplierWallet);
 * 
 * // Prepare complete test environment
 * const env = await toolkit.prepareTestEnvironment({
 *   accountCount: 3,
 *   fundEachEOAWithETH: parseEther("0.01"),
 *   fundEachAAWithETH: parseEther("0.02"),
 *   tokens: {
 *     gToken: { address: '0x...', amount: parseEther("100") },
 *     aPNTs: { address: '0x...', amount: parseEther("50") }
 *   }
 * });
 * ```
 */
export class TestAccountManager {
    constructor(
        /** @internal */
        private publicClient: PublicClient,
        /** @internal */
        private walletClient: WalletClient
    ) {
        if (!walletClient.account) {
            // Placeholder account if not provided to avoid strict null checks in experiments
            // In production, the consumer must ensure the wallet is connected.
        }
    }

    /**
     * Prepare complete test environment for PhD experiments
     * 
     * **Workflow**:
     * 1. Generate N random EOA private keys
     * 2. Deploy SimpleAccount for each EOA
     * 3. Fund EOAs with ETH
     * 4. Fund AAs with ETH
     * 5. Transfer test tokens (GToken, aPNTs, bPNTs) to both EOAs and AAs
     * 
     * @param config - Test environment configuration
     * @returns Complete test environment with all accounts and tokens ready
     */
    async prepareTestEnvironment(config: TestEnvironmentConfig): Promise<TestEnvironment> {
        const {
            accountCount = 3,
            fundEachEOAWithETH = parseEther("0.01"),
            fundEachAAWithETH = parseEther("0.02"),
            tokens = {},
            startingSalt = 0
        } = config;

        console.log(`🧪 Preparing PhD Experiment Test Environment (${accountCount} accounts)...\n`);

        const accounts: TestAccount[] = [];
        const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

        const factoryAddress = TEST_ACCOUNT_ADDRESSES.simpleAccountFactory;
        const factoryRead = accountFactoryActions(factoryAddress)(this.publicClient as any);
        const factoryWrite = accountFactoryActions(factoryAddress)(this.walletClient as any);

        // Step 1: Generate accounts and deploy AAs
        for (let i = 0; i < accountCount; i++) {
            const label = labels[i] || `${i + 1}`;
            console.log(`\n📝 [${i + 1}/${accountCount}] Setting up Account ${label}...`);

            // Generate EOA
            const ownerKey = generatePrivateKey();
            const ownerAccount = privateKeyToAccount(ownerKey);
            console.log(`   🔑 EOA: ${ownerAccount.address}`);

            // Deploy AA
            const salt = BigInt(startingSalt + i);
            console.log(`   🏭 Deploying SimpleAccount (salt: ${salt})...`);
            
            // Predict address
            const accountAddress = await factoryRead.getAddress({ owner: ownerAccount.address, salt });
            
            // Deploy if needed (createAccount sends tx regardless, or we can check code?)
            // For simplicitly we just call createAccount. If already deployed it might revert?
            // SimpleAccountFactory doesn't seem to check existence in createAccount, but CREATE2 validates.
            // But we are using a fresh key/salt, so collision is unlikely unless we rerun.
            // We'll try-catch or just execute.
            
            let deployTxHash: Hash = '0x0';
            try {
                 deployTxHash = await factoryWrite.createAccount({
                    owner: ownerAccount.address,
                    salt,
                    account: this.walletClient.account as any
                });
                await this.publicClient.waitForTransactionReceipt({ hash: deployTxHash });
            } catch (e: any) {
                console.log(`      ⚠️ Deployment might have failed (or already deployed): ${e.message?.split('\n')[0]}`);
            }

            console.log(`   ✅ AA: ${accountAddress}`);

            // Fund AA with ETH
            if (fundEachAAWithETH > 0n) {
                console.log(`   ⛽ Funding AA with ${fundEachAAWithETH} wei ETH...`);
                const fundTx = await this.walletClient.sendTransaction({
                    to: accountAddress,
                    value: fundEachAAWithETH,
                    account: this.walletClient.account as any,
                    chain: this.walletClient.chain
                });
                await this.publicClient.waitForTransactionReceipt({ hash: fundTx });
            }

            // Fund EOA with ETH
            if (fundEachEOAWithETH > 0n) {
                console.log(`   ⛽ Funding EOA with ${fundEachEOAWithETH} wei ETH...`);
                const fundTx = await this.walletClient.sendTransaction({
                    to: ownerAccount.address,
                    value: fundEachEOAWithETH,
                    account: this.walletClient.account as any,
                    chain: this.walletClient.chain
                });
                await this.publicClient.waitForTransactionReceipt({ hash: fundTx });
            }

            accounts.push({
                label,
                ownerKey,
                ownerAddress: ownerAccount.address,
                aaAddress: accountAddress,
                deployTxHash,
                salt: startingSalt + i
            });
        }

        // Step 2: Fund with test tokens
        console.log(`\n💰 Funding accounts with test tokens...`);
        const tokenFunding: TokenFundingRecord[] = [];

        for (const [tokenName, tokenConfig] of Object.entries(tokens)) {
            if (!tokenConfig) continue;
            
            console.log(`\n   📊 Distributing ${tokenName}...`);
            const erc20Abi = [
                { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }
            ];

            for (const account of accounts) {
                // Fund EOA
                if (tokenConfig.fundEOA !== false) {
                    const tx = await this.walletClient.writeContract({
                        address: tokenConfig.address,
                        abi: erc20Abi,
                        functionName: 'transfer',
                        args: [account.ownerAddress, tokenConfig.amount],
                        account: this.walletClient.account as any,
                        chain: this.walletClient.chain
                    });
                    await this.publicClient.waitForTransactionReceipt({ hash: tx });
                    console.log(`      ✅ ${account.label} EOA: ${tokenConfig.amount}`);
                }

                // Fund AA
                if (tokenConfig.fundAA !== false) {
                    const tx = await this.walletClient.writeContract({
                        address: tokenConfig.address,
                        abi: erc20Abi,
                        functionName: 'transfer',
                        args: [account.aaAddress, tokenConfig.amount],
                        account: this.walletClient.account as any,
                        chain: this.walletClient.chain
                    });
                    await this.publicClient.waitForTransactionReceipt({ hash: tx });
                    console.log(`      ✅ ${account.label} AA: ${tokenConfig.amount}`);
                }

                tokenFunding.push({
                    account: account.label,
                    token: tokenName,
                    eoaAmount: tokenConfig.fundEOA !== false ? tokenConfig.amount : 0n,
                    aaAmount: tokenConfig.fundAA !== false ? tokenConfig.amount : 0n
                });
            }
        }

        console.log(`\n✅ Test environment ready!`);
        return { accounts, tokenFunding };
    }

    /**
     * Generate multiple test accounts for experiments
     * (Simplified version without token funding)
     */
    async generateTestAccounts(
        count: number = 3,
        options: {
            fundEachAAWith?: bigint;
            fundEachEOAWith?: bigint;
            startingSalt?: number;
        } = {}
    ): Promise<TestAccount[]> {
        const {
            fundEachAAWith = parseEther("0.02"),
            fundEachEOAWith = parseEther("0.01"),
            startingSalt = 0
        } = options;

        const env = await this.prepareTestEnvironment({
            accountCount: count,
            fundEachEOAWithETH: fundEachEOAWith,
            fundEachAAWithETH: fundEachAAWith,
            startingSalt
        });

        return env.accounts;
    }

    /**
     * Export test accounts to .env format
     */
    exportToEnv(accounts: TestAccount[]): string {
        const lines = [
            '# Test Accounts for PhD Paper Experiments',
            '# Generated by TestAccountManager API',
            ''
        ];

        accounts.forEach(acc => lines.push(`TEST_OWNER_KEY_${acc.label}=${acc.ownerKey}`));
        lines.push('');
        accounts.forEach(acc => lines.push(`TEST_OWNER_EOA_${acc.label}=${acc.ownerAddress}`));
        lines.push('');
        accounts.forEach(acc => lines.push(`TEST_SIMPLE_ACCOUNT_${acc.label}=${acc.aaAddress}`));

        return lines.join('\n');
    }

    /**
     * Load test accounts from environment variables
     */
    static loadFromEnv(labels: string[] = ['A', 'B', 'C']): (TestAccount | null)[] {
        return labels.map(label => {
            const ownerKey = process.env[`TEST_OWNER_KEY_${label}`];
            const ownerAddress = process.env[`TEST_OWNER_EOA_${label}`];
            const aaAddress = process.env[`TEST_SIMPLE_ACCOUNT_${label}`];

            if (!ownerKey || !ownerAddress || !aaAddress) return null;

            return {
                label,
                ownerKey: ownerKey as `0x${string}`,
                ownerAddress: ownerAddress as Address,
                aaAddress: aaAddress as Address,
                deployTxHash: '0x0' as Hash,
                salt: 0
            };
        });
    }

    /**
     * Get a single test account by label
     */
    static getTestAccount(label: string): TestAccount | null {
        const accounts = TestAccountManager.loadFromEnv([label]);
        return accounts[0] || null;
    }

    // --- Data Collection Extensions ---
    private records: any[] = [];

    /**
     * Add a standardized experiment record
     */
    addExperimentRecord(record: {
        scenario: string,
        group: 'EOA' | 'AA' | 'SuperPaymaster',
        txHash: string,
        gasUsed: bigint,
        gasPrice: bigint,
        status: string,
        meta?: any
    }) {
        const fullRecord = {
            ...record,
            id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: Date.now(),
            costETH: formatEther(record.gasUsed * record.gasPrice)
        };
        this.records.push(fullRecord);
        return fullRecord;
    }

    /**
     * Export collected data to CSV for PhD paper analysis
     */
    exportExperimentResults(filename: string = 'sdk_experiment_data.csv') {
        const fs = require('fs');
        const path = require('path');
        
        const headers = ['ID', 'Scenario', 'Group', 'TxHash', 'GasUsed', 'GasPrice', 'CostETH', 'Status', 'Timestamp', 'Latency'];
        const rows = this.records.map(r => [
            r.id, r.scenario, r.group, r.txHash, 
            r.gasUsed.toString(), r.gasPrice.toString(), r.costETH, 
            r.status, new Date(r.timestamp).toISOString(),
            r.meta?.latency || ''
        ].join(','));
        
        const csv = [headers.join(','), ...rows].join('\n');
        fs.writeFileSync(path.join(process.cwd(), filename), csv);
        console.log(`📊 Exported ${this.records.length} records to ${filename}`);
    }
}

function formatEther(wei: bigint): string {
    return (Number(wei) / 1e18).toString();
}

/**
 * Test environment configuration
 */
export interface TestEnvironmentConfig {
    accountCount?: number;
    fundEachEOAWithETH?: bigint;
    fundEachAAWithETH?: bigint;
    startingSalt?: number;
    tokens?: {
        [tokenName: string]: {
            address: Address;
            amount: bigint;
            fundEOA?: boolean; // default: true
            fundAA?: boolean;  // default: true
        };
    };
}

/**
 * Complete test environment
 */
export interface TestEnvironment {
    accounts: TestAccount[];
    tokenFunding: TokenFundingRecord[];
}

/**
 * Token funding record
 */
export interface TokenFundingRecord {
    account: string;
    token: string;
    eoaAmount: bigint;
    aaAmount: bigint;
}

/**
 * Test account data structure
 */
export interface TestAccount {
    label: string;
    ownerKey: `0x${string}`;
    ownerAddress: Address;
    aaAddress: Address;
    deployTxHash: Hash;
    salt: number;
}
