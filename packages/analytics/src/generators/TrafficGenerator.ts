
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    parseEther, 
    type Hex, 
    type Account, 
    type Chain 
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { 
    ENTRY_POINT_ADDRESS, 
    getNetwork,
    APNTS_ADDRESS
} from '@aastar/core';
import { UserClient } from '@aastar/enduser';

export interface TrafficConfig {
    network: string;
    rpcUrl: string;
    bundlerUrl?: string;
    pimlicoKey?: string;
    privateKey: Hex; // The "funder" or "operator" key
}

export class TrafficGenerator {
    private client: any;
    private wallet: any;
    private chain: Chain;
    private config: TrafficConfig;

    constructor(config: TrafficConfig) {
        this.config = config;
        const chain = getNetwork(config.network as any);
        if (!chain) throw new Error(`Unsupported network: ${config.network}`);
        this.chain = chain as unknown as Chain;
        
        this.client = createPublicClient({
            chain,
            transport: http(config.rpcUrl)
        } as any);

        this.wallet = createWalletClient({
            chain,
            transport: http(config.rpcUrl),
            account: privateKeyToAccount(config.privateKey)
        } as any);
    }

    private getBundlerClient() {
        if (!this.config.bundlerUrl) return undefined;
        return createPublicClient({
             chain: this.chain,
             transport: http(this.config.bundlerUrl)
        });
    }

    /**
     * Debug: Check account status
     */
    async checkAccount(address: Hex) {
        console.log(`   🔍 Checking account ${address}...`);
        const code = await this.client.getBytecode({ address });
        console.log(`      Code Size: ${code ? code.length : 0}`);
        if (!code) console.warn(`      ⚠️  Warning: Account not deployed!`);
        
        try {
            const nonce = await this.client.readContract({
                address: ENTRY_POINT_ADDRESS,
                abi: [{ name: 'getNonce', type: 'function', inputs: [{ name: 'sender', type: 'address' }, { name: 'key', type: 'uint192' }], outputs: [{ name: 'nonce', type: 'uint256' }] }],
                functionName: 'getNonce',
                args: [address, 0n]
            });
            console.log(`      Nonce: ${nonce}`);
        } catch (e: any) {
            console.error(`      ❌ Failed to fetch nonce: ${e.message}`);
        }
    }

    /**
     * Group 1: EOA (Baseline)
     * Simple native transfer
     */
    async runEOA(runs: number) {
        console.log(`\n🚗 Starting EOA Traffic Generation (${runs} runs)...`);
        const account = privateKeyToAccount(this.config.privateKey);
        
        for (let i = 0; i < runs; i++) {
            try {
                // Send to self to minimize setup, just measuring gas
                const hash = await (this.wallet as any).sendTransaction({
                    to: account.address,
                    value: parseEther('0.0001'),
                    account,
                    chain: this.chain
                } as any);
                console.log(`   [${i+1}/${runs}] EOA Tx: ${hash}`);
                await this.client.waitForTransactionReceipt({ hash });
            } catch (e: any) {
                console.error(`   ❌ Run ${i+1} failed: ${e.message}`);
            }
        }
    }

    /**
     * Helper: Delay for rate limiting
     */
    private async delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Group 2: Standard AA (Pimlico/Alchemy)
     * Requires UserClient initialized with Bundler
     */
    async runStandardAA(runs: number, smartAccountAddress: Hex) {
        console.log(`\n🚕 Starting Standard AA Traffic (${runs} runs)...`);
        
        if (!this.config.bundlerUrl) {
            console.warn("   ⚠️ Missing Bundler URL. Skipping.");
            return;
        }
        
        const userClient = new UserClient({
            accountAddress: smartAccountAddress,
            client: this.wallet as any,
            publicClient: this.client as any,
            bundlerClient: this.getBundlerClient() as any,
            entryPointAddress: ENTRY_POINT_ADDRESS
        });

        console.log(`   Target SA: ${smartAccountAddress}`);

        for (let i = 0; i < runs; i++) {
            try {
                // Send to self to minimize setup, just measuring gas
                // Note: user must have gas or paymaster
                // Standard Paymaster usage not explicitly configured here yet, 
                // assuming account has native balance or bundler endpoint handles sponsorship
                const hash = await userClient.execute(
                    smartAccountAddress, 
                    0n,
                    "0x"
                );
                
                console.log(`   [${i+1}/${runs}] AA Tx: ${hash}`);
                await this.client.waitForTransactionReceipt({ hash });
                if (i < runs - 1) await this.delay(20000); 
            } catch (e: any) {
                console.error(`   ❌ Run ${i+1} failed: ${e.message}`);
                if (i < runs - 1) await this.delay(5000);
            }
        }
    }

    /**
     * Group 3: SuperPaymaster (Treatment A)
     * Logic: Gasless transfer via Credit system
     */
    async runSuperPaymaster(runs: number, smartAccountAddress: Hex, superPaymasterAddress: Hex, operatorAddress: Hex, operatorKey?: Hex) {
        console.log(`\n🏎️  Starting SuperPaymaster Traffic (${runs} runs)...`);
        
        // Use the specialized operator key if provided (to ensure valid Owner signature), 
        // otherwise fallback to the default wallet
        const signingWallet = operatorKey 
            ? createWalletClient({
                chain: this.chain,
                transport: http(this.config.rpcUrl),
                account: privateKeyToAccount(operatorKey)
              })
            : this.wallet;

        // For Phase 2, we skip the UserClient.executeGasless and use the high-level SuperPaymasterClient directly
        // to ensure we follow the proven success logic in l4-regression.ts
        const { SuperPaymasterClient: SDKSuperPaymasterClient } = await import('@aastar/paymaster');

        for (let i = 0; i < runs; i++) {
            try {
                // Use the provided wallet as both the owner/signer and the operator (sponsor) for these transactions
                // matching the demo flow
                const hash = await SDKSuperPaymasterClient.submitGaslessTransaction(
                    this.client as any,
                    signingWallet as any,
                    smartAccountAddress,
                    ENTRY_POINT_ADDRESS,
                    this.config.bundlerUrl || '',
                    {
                        token: await this.getTokenForOperator(operatorAddress), 
                        recipient: smartAccountAddress, // Send to self to preserve tokens
                        amount: parseEther('0.1'),
                        operator: operatorAddress,
                        paymasterAddress: superPaymasterAddress
                    }
                );

                console.log(`   [${i+1}/${runs}] SPM Tx: ${hash}`);
                
                // Wait for receipt using the bundler client with explicit actions
                const bundlerUrl = this.config.bundlerUrl;
                if (bundlerUrl) {
                    const { bundlerActions } = await import('viem/account-abstraction');
                    const bundler = createPublicClient({
                        chain: this.chain,
                        transport: http(bundlerUrl)
                    }).extend(bundlerActions);
                    await bundler.waitForUserOperationReceipt({ hash: hash as Hex });
                } else {
                    await this.client.waitForTransactionReceipt({ hash: hash as Hex });
                }
                
                if (i < runs - 1) await this.delay(20000);
            } catch (e: any) {
                console.error(`   ❌ Run ${i+1} failed: ${e.message}`);
                if (i < runs - 1) await this.delay(10000);
            }
        }
    }

    private async getTokenForOperator(operator: Hex): Promise<Hex> {
        // Simple mapping based on known state or defaulting to aPNTs
        return APNTS_ADDRESS; // aPNTs from core config
    }

    /**
     * Group 4: PaymasterV4 (Treatment B)
     * Logic: Deposit -> Transfer
     */
    async runPaymasterV4(runs: number, paymasterAddress: Hex) {
        console.log(`\n🚚 Starting PaymasterV4 Traffic (${runs} runs)...`);
        // Implementation for PaymasterV4 logic
    }
}
