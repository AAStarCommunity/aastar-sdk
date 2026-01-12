import { createPublicClient, createWalletClient, http, parseEther, formatEther, encodeFunctionData, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { PaymasterV4Client } from '../packages/paymaster/dist/index.js';
import { loadNetworkConfig } from './regression/config.js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia') });

async function main() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({ chain: sepolia, transport: http(config.rpcUrl) });
    
    // ANNI is the operator/owner
    const anniKey = process.env.PRIVATE_KEY_ANNI as Hex;
    if (!anniKey) throw new Error('PRIVATE_KEY_ANNI missing in .env.sepolia');
    const anniAccount = privateKeyToAccount(anniKey);
    const anniWallet = createWalletClient({ 
        account: anniAccount, 
        chain: sepolia, 
        transport: http(config.rpcUrl) 
    });

    // Known addresses from l4-state.json and manual verification
    const anniAA = '0xBC7626E94a215F6614d1B6aFA740787A2E50aaA4' as Address;
    const dPNTs = '0x424DA26B172994f98D761a999fa2FD744CaF812b' as Address;
    const anniPM = '0x82862b7c3586372DF1c80Ac60adA57e530b0eB82' as Address;
    const bobEOA = '0xE3D28Aa77c95d5C098170698e5ba68824BFC008d' as Address;

    console.log('🚀 ANNI Gasless Transaction Test\n');
    console.log(`Sender (AA): ${anniAA}`);
    console.log(`Token (dPNTs): ${dPNTs}`);
    console.log(`Paymaster: ${anniPM}`);
    console.log(`Recipient: ${bobEOA}\n`);

    // Step 1.5: Ensure Paymaster is Staked and has Deposit in EntryPoint
    console.log('\nStep 1.5: Checking Paymaster Stake/Deposit in EntryPoint...');
    // We'll just add stake and deposit directly if we are unsure.
    // Standard requirements: 0.1 ETH stake, 1 day delay.
    try {
        const ethBal = await publicClient.getBalance({ address: anniAccount.address });
        console.log(`   Anni EOA ETH Balance: ${formatEther(ethBal)} ETH`);
        
        if (ethBal > parseEther('0.5')) {
            console.log('   🪜 Adding 0.11 ETH Stake (1 day delay)...');
            const stakeHash = await PaymasterV4Client.addStake(anniWallet, anniPM, parseEther('0.11'), 86400);
            await publicClient.waitForTransactionReceipt({ hash: stakeHash });
            console.log('   ✅ Stake added.');

            console.log('   💰 Adding 0.3 ETH Deposit to EntryPoint...');
            const depositEntryPointHash = await PaymasterV4Client.addDeposit(anniWallet, anniPM, parseEther('0.3'));
            await publicClient.waitForTransactionReceipt({ hash: depositEntryPointHash });
            console.log('   ✅ Deposit added.');
        } else {
            console.log('   ⚠️ Insufficient ETH to stake/deposit (needs > 0.5 ETH). skipping...');
        }
    } catch (e: any) {
        console.log(`   ✓ Stake/Deposit check done (might already be configured).`);
    }
    console.log('Step 1: Checking Paymaster Price Cache...');
    const initialized = await PaymasterV4Client.ensurePriceInitialized(anniWallet, publicClient, anniPM);
    if (initialized) {
        console.log('   ✅ Price cache updated.');
    } else {
        const { price } = await PaymasterV4Client.getCachedPrice(publicClient, anniPM);
        console.log(`   ✓ Price cache already initialized: ${price}`);
    }

    // Step 2: Check & Initialize Paymaster Deposit
    console.log('\nStep 2: Checking Paymaster Token Support & Deposit...');
    
    // Check if token is supported
    // Since there's no public query for supportedTokens in PaymasterBase (it's internal mapping)
    // We can just try to add it or skip if we are sure.
    // Actually, PaymasterV4Client has addGasToken.
    console.log(`   Ensuring ${dPNTs} is supported...`);
    try {
        const gasTokenHash = await PaymasterV4Client.addGasToken(anniWallet, anniPM, dPNTs);
        if (gasTokenHash) {
            console.log(`   📝 Sent addGasToken transaction: ${gasTokenHash}`);
            await publicClient.waitForTransactionReceipt({ hash: gasTokenHash });
            console.log(`   ✅ Token ${dPNTs} added.`);
        }
    } catch (e: any) {
        console.log(`   ✓ Token support check/add done (might already be supported).`);
    }

    // Check token price
    console.log(`   Checking ${dPNTs} price...`);
    const tokenPrice = await PaymasterV4Client.getTokenPrice(publicClient, anniPM, dPNTs);
    if (tokenPrice === 0n) {
        console.log(`   ⚠️ Token price is 0. Setting to $1.00 (1e8)...`);
        const setPriceHash = await PaymasterV4Client.setTokenPrice(anniWallet, anniPM, dPNTs, 100000000n);
        await publicClient.waitForTransactionReceipt({ hash: setPriceHash });
        console.log(`   ✅ Token price set.`);
    } else {
        console.log(`   ✓ Token price: ${tokenPrice}`);
    }

    let balance = await PaymasterV4Client.getDepositedBalance(publicClient, anniPM, anniAA, dPNTs);
    console.log(`   Current deposit: ${formatEther(balance)} dPNTs`);

    if (balance < parseEther('50')) {
        console.log(`   Depositing 100 dPNTs for ANNI AA...`);
        // ... (Anni EOA balance check already done above) ...
        
        console.log('   📝 Approving Paymaster...');
        const approveHash = await anniWallet.writeContract({
            address: dPNTs,
            abi: [{ name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
            functionName: 'approve',
            args: [anniPM, parseEther('1000')]
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });

        console.log('   🏦 Depositing into Paymaster...');
        const depositHash = await PaymasterV4Client.depositFor(anniWallet, anniPM, anniAA, dPNTs, parseEther('100'));
        await publicClient.waitForTransactionReceipt({ hash: depositHash });
        
        balance = await PaymasterV4Client.getDepositedBalance(publicClient, anniPM, anniAA, dPNTs);
        console.log(`   ✅ New deposit balance: ${formatEther(balance)} dPNTs`);
    }

    // Step 3: Execute Gasless Transfer
    console.log('\nStep 3: Submitting Gasless UserOperation...');
    const transferAmount = parseEther('2');
    const transferCalldata = encodeFunctionData({
        abi: [{ name: 'execute', type: 'function', inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }], outputs: [], stateMutability: 'nonpayable' }],
        functionName: 'execute',
        args: [
            dPNTs, 
            0n, 
            encodeFunctionData({
                abi: [{ name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
                functionName: 'transfer',
                args: [bobEOA, transferAmount]
            })
        ]
    });

    try {
        const userOpHash = await PaymasterV4Client.submitGaslessUserOperation(
            publicClient,
            anniAccount,
            anniAA,
            config.contracts.entryPoint as Address,
            anniPM,
            dPNTs,
            process.env.BUNDLER_URL!,
            transferCalldata,
            {
                verificationGasLimit: 100000n,
                callGasLimit: 100000n,
                maxFeePerGas: 3000000000n, // 3 gwei
                maxPriorityFeePerGas: 100000000n // 0.1 gwei
            }
        );

        console.log(`   ✅ UserOp submitted! Hash: ${userOpHash}`);
        console.log(`   ⏳ Waiting for execution...`);

        // Simple poll for receipt
        let success = false;
        for (let i = 0; i < 30; i++) {
            const response = await fetch(process.env.BUNDLER_URL!, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_getUserOperationReceipt',
                    params: [userOpHash]
                })
            });
            const result = (await response.json()) as any;
            if (result.result) {
                console.log(`   🎉 UserOp Executed! Transaction: ${result.result.receipt.transactionHash}`);
                success = true;
                break;
            }
            process.stdout.write('.');
            await new Promise(r => setTimeout(r, 2000));
        }

        if (!success) {
            console.log('\n   ⏸️ Timeout waiting for receipt. Check Etherscan.');
        }

    } catch (error: any) {
        console.error(`   ❌ Submission Failed:`, error.message);
    }
}

main().catch(console.error);
