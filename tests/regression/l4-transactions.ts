import { createPublicClient, createWalletClient, http, type WalletClient, type PublicClient, type Hex, parseEther, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { type NetworkConfig } from './config';
import { tokenActions, accountActions } from '../../packages/core/dist/index.js';
import { UserClient } from '../../packages/enduser/dist/UserClient.js';

/**
 * Transaction Verification Tests
 * Performs actual on-chain transactions to verify write functionality.
 * Outputs Etherscan links for verification.
 */
export async function runTransactionTests(config: NetworkConfig) {
    console.log('\n═══════════════════════════════════════════════');
    console.log('🔗 Running Transaction Verification Tests');
    console.log('═══════════════════════════════════════════════\n');

    const account = privateKeyToAccount(config.testAccount.privateKey);
    
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    const walletClient = createWalletClient({
        account,
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    let passedTests = 0;
    let totalTests = 0;

    // Helper to log Etherscan link
    const logEtherscan = (hash: Hash, description: string) => {
        const baseUrl = config.name === 'sepolia' ? 'https://sepolia.etherscan.io/tx/' : 'https://etherscan.io/tx/'; // Default to Sepolia for now
        
        console.log(`    📝 ${description}`);
        console.log(`    #️⃣  Hash: ${hash}`);
        console.log(`    🔗 Link: ${baseUrl}${hash}\n`);
    };

    const balance = await publicClient.getBalance({ address: account.address });
    const balanceEth = parseEther(balance.toString()) / parseEther('1') ; 
    // Wait, let's just use formatEther
    const { formatEther } = await import('viem');
    console.log(`    💰 Account: ${account.address}`);
    console.log(`    💰 Balance: ${formatEther(balance)} ETH`);

    if (balance === 0n) {
        console.log(`    🔍 Debug: Supplier Configured? ${!!config.supplierAccount}`);
        if (config.supplierAccount) {
            console.log('\n    ⚠️  WARNING: No ETH balance on Sepolia.');
            console.log('    ⛽ Auto-funding from Supplier Account...');
            
            const supplier = privateKeyToAccount(config.supplierAccount.privateKey);
            const supplierClient = createWalletClient({
                account: supplier,
                chain: config.chain,
                transport: http(config.rpcUrl)
            });

            try {
                const fundingHash = await supplierClient.sendTransaction({
                    to: account.address,
                    value: parseEther('0.01'),
                    account: supplier
                });
                
                logEtherscan(fundingHash, 'Funding Transaction');
                console.log('    ⏳ Waiting for funding confirmation...');
                const receipt = await publicClient.waitForTransactionReceipt({ hash: fundingHash });
                console.log(`    ✅ Funding Confirmed (Status: ${receipt.status}). Waiting for balance update...`);
                
                // Poll for balance update
                let attempts = 0;
                let newBalance = 0n;
                while (attempts < 30) {
                    newBalance = await publicClient.getBalance({ address: account.address });
                    if (newBalance > 0n) break;
                    await new Promise(r => setTimeout(r, 5000)); // Wait 5s
                    process.stdout.write('.');
                    attempts++;
                }
                console.log('\n');

                if (newBalance === 0n) {
                    throw new Error('Balance mismatch: Funds confirmed but balance is still 0. Possible node latency.');
                }

                console.log(`    💰 New Balance: ${formatEther(newBalance)} ETH`);
                
                const gasPrice = await publicClient.getGasPrice();
                console.log(`    ⛽ Current Gas Price: ${formatEther(gasPrice, 'gwei')} gwei`);

            } catch (error) {
                console.log(`    ❌ Funding Failed: ${(error as Error).message}`);
                console.log('    ⏭️  Skipping write tests due to lack of funds.\n');
                return;
            }
        } else {
            console.log('\n    ⚠️  WARNING: No ETH balance on Sepolia.');
            console.log('    ⏭️  Skipping write tests. Please fund this address or configure PRIVATE_KEY_SUPPLIER.');
            console.log('    Faucet: https://sepoliafaucet.com/\n');
            return;
        }
    }

    // ========================================
    // 1. Standard Transaction: Approve GToken
    // ========================================
    console.log('💳 === Standard Transaction: GToken Approve ===');
    totalTests++;
    try {
        console.log('  Action: Approving GTokenStaking to spend GToken...');
        
        const fees = await publicClient.estimateFeesPerGas();
        const maxFeePerGas = fees.maxFeePerGas || parseEther('20', 'gwei'); // Fallback to 20 gwei
        const maxPriorityFeePerGas = fees.maxPriorityFeePerGas || parseEther('2', 'gwei');

        console.log(`    ⛽ Fees: Max ${formatEther(maxFeePerGas, 'gwei')} gwei, Priority ${formatEther(maxPriorityFeePerGas, 'gwei')} gwei`);

        // Use direct writeContract to control gas
        const { request } = await publicClient.simulateContract({
            address: config.contracts.gToken,
            abi: parseAbi(['function approve(address spender, uint256 value) returns (bool)']),
            functionName: 'approve',
            args: [config.contracts.gTokenStaking, parseEther('100')],
            account,
            maxFeePerGas,
            maxPriorityFeePerGas
        });

        const hash = await walletClient.writeContract(request);

        logEtherscan(hash, 'Approve Transaction');
        
        // Wait for confirmation
        console.log('    ⏳ Waiting for confirmation...');
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('    ✅ Transaction Confirmed\n');
        passedTests++;
    } catch (e) {
        console.error(e);
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 2. Account Execution: Self-Transfer (Simple)
    // ========================================
    console.log('👤 === Account Execution: Simple Execute ===');
    totalTests++;
    try {
        console.log('  Action: Executing simple 0 value transfer to self...');
        
        const fees = await publicClient.estimateFeesPerGas();
        const maxFeePerGas = fees.maxFeePerGas || parseEther('20', 'gwei');
        const maxPriorityFeePerGas = fees.maxPriorityFeePerGas || parseEther('2', 'gwei');

        // Simple self-transfer of GToken (0 amount)
        const { request } = await publicClient.simulateContract({
            address: config.contracts.gToken,
            abi: parseAbi(['function transfer(address to, uint256 value) returns (bool)']),
            functionName: 'transfer',
            args: [account.address, 0n],
            account,
            maxFeePerGas,
            maxPriorityFeePerGas
        });

        const hash = await walletClient.writeContract(request);

        logEtherscan(hash, 'Self Transfer Transaction');
        
        console.log('    ⏳ Waiting for confirmation...');
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('    ✅ Transaction Confirmed\n');
        passedTests++;
    } catch (e) {
        console.log(`    ❌ FAIL: ${(e as Error).message}\n`);
    }

    // ========================================
    // 3. Implied Gasless Transaction (Placeholder)
    // ========================================
    // Note: Real gasless requires a full Bundler + Paymaster setup which might not be configured in this EOA-based test suite.
    // We will verify the standard transactions first.
    
    console.log(`\n📊 Transaction Results: ${passedTests}/${totalTests} txs submitted & confirmed\n`);
}

import { type Hash } from 'viem';
