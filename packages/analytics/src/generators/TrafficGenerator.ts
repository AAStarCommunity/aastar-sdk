
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
import { getNetworkConfig, ENTRY_POINT_V07 } from '../../../../scripts/00_utils.js';
import { UserClient } from '@aastar/enduser';

export interface TrafficConfig {
    network: string;
    rpcUrl: string;
    bundlerUrl?: string;
    pimlicoKey?: string;
    privateKey: Hex; // The "funder" or "operator" key
}

export class TrafficGenerator {
    private client;
    private wallet;
    private chain: Chain;
    private config: TrafficConfig;

    constructor(config: TrafficConfig) {
        this.config = config;
        const { chain } = getNetworkConfig(config.network);
        this.chain = chain;
        
        this.client = createPublicClient({
            chain,
            transport: http(config.rpcUrl)
        });

        this.wallet = createWalletClient({
            chain,
            transport: http(config.rpcUrl),
            account: privateKeyToAccount(config.privateKey)
        });
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
                address: ENTRY_POINT_V07,
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
                const hash = await this.wallet.sendTransaction({
                    to: account.address,
                    value: parseEther('0.0001'),
                    account
                });
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
            client: this.wallet,
            publicClient: this.client,
            bundlerClient: this.getBundlerClient(),
            entryPointAddress: ENTRY_POINT_V07
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
    async runSuperPaymaster(runs: number, smartAccountAddress: Hex, operatorAddress: Hex) {
        console.log(`\n🏎️  Starting SuperPaymaster Traffic (${runs} runs)...`);
        
        const userClient = new UserClient({
            accountAddress: smartAccountAddress,
            client: this.wallet,
            publicClient: this.client,
            bundlerClient: this.getBundlerClient(),
            entryPointAddress: ENTRY_POINT_V07
        });

        console.log(`   Target SA: ${smartAccountAddress}`);
        console.log(`   Operator: ${operatorAddress}`);

        for (let i = 0; i < runs; i++) {
            try {
                const hash = await userClient.executeGasless({
                    target: smartAccountAddress,
                    value: 0n,
                    data: '0x',
                    paymaster: operatorAddress, 
                    paymasterType: 'Super'
                });

                console.log(`   [${i+1}/${runs}] SPM Tx: ${hash}`);
                await this.client.waitForTransactionReceipt({ hash });
                if (i < runs - 1) await this.delay(20000);
            } catch (e: any) {
                console.error(`   ❌ Run ${i+1} failed: ${e.message}`);
                if (i < runs - 1) await this.delay(5000);
            }
        }
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
