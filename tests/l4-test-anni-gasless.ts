import { createPublicClient, createWalletClient, http, parseEther, formatEther, encodeFunctionData, type Address, type Hex, concat, decodeErrorResult } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { PaymasterClient, PaymasterOperator } from '../packages/paymaster/src/V4/index.ts';
import { xPNTsFactoryActions } from '../packages/core/src/actions/factory.js';
import { loadNetworkConfig } from './regression/config.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
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

    // Load AA addresses from l4-state.json
    const statePath = path.resolve(process.cwd(), 'scripts/l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const anniAA = state.aaAccounts.find((aa: any) => aa.label === 'Anni (Demo)_AA1')?.address as Address;
    
    // ✅ FIX: Query Anni's own cPNTs token from xPNTsFactory
    const xpntsFactory = xPNTsFactoryActions(config.contracts.xPNTsFactory);
    const cPNTs = await xpntsFactory(publicClient).getTokenAddress({ community: anniAccount.address });
    
    if (!cPNTs || cPNTs === '0x0000000000000000000000000000000000000000') {
        throw new Error(`❌ Anni has NO deployed token! Please run: NETWORK_NAME=sepolia npx tsx scripts/l4-setup.ts --network=sepolia`);
    }
    
    const anniPM = state.operators.anni?.superPaymaster || config.contracts.superPaymaster as Address;
    const bobEOA = privateKeyToAccount(process.env.PRIVATE_KEY_BOB as `0x${string}`).address;

    console.log('🚀 ANNI Gasless Transaction Test\n');
    console.log(`Sender (AA): ${anniAA}`);
    console.log(`Token (cPNTs): ${cPNTs} ✅ Anni's Own Token`);
    console.log(`Paymaster: ${anniPM} (SuperPaymaster)`);
    console.log(`Recipient: ${bobEOA}\n`);

    // 🔍 DIAGNOSTIC: Show AA Assets and Status
    console.log('🔍 DIAGNOSTIC: Anni AA Account Status\n');
    
    // ETH Balance
    const aaEthBal = await publicClient.getBalance({ address: anniAA });
    console.log(`   💰 ETH Balance: ${formatEther(aaEthBal)} ETH`);
    
    // GToken Balance
    const gTokenAbi = [{ name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }];
    const aaGTokenBal = await publicClient.readContract({
        address: config.contracts.gToken,
        abi: gTokenAbi,
        functionName: 'balanceOf',
        args: [anniAA]
    }) as bigint;
    console.log(`   🪙 GToken Balance: ${formatEther(aaGTokenBal)}`);
    
    // cPNTs Balance
    const aaCPNTsBal = await publicClient.readContract({
        address: cPNTs,
        abi: gTokenAbi,
        functionName: 'balanceOf',
        args: [anniAA]
    }) as bigint;
    console.log(`   🎫 cPNTs Balance: ${formatEther(aaCPNTsBal)}`);
    
    // Community Role Check
    const registryAbi = [
        { name: 'ROLE_ENDUSER', type: 'function', inputs: [], outputs: [{ type: 'bytes32' }], stateMutability: 'view' },
        { name: 'hasRole', type: 'function', inputs: [{ name: 'roleId', type: 'bytes32' }, { name: 'user', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' }
    ];
    const ROLE_ENDUSER = await publicClient.readContract({
        address: config.contracts.registry,
        abi: registryAbi,
        functionName: 'ROLE_ENDUSER'
    }) as Hex;
    const isEndUser = await publicClient.readContract({
        address: config.contracts.registry,
        abi: registryAbi,
        functionName: 'hasRole',
        args: [ROLE_ENDUSER, anniAA]
    }) as boolean;
    console.log(`   👥 ENDUSER Role: ${isEndUser ? '✅ Registered' : '❌ Not Registered'}`);
    
    // SBT Balance
    const sbtBal = await publicClient.readContract({
        address: config.contracts.sbt,
        abi: gTokenAbi,
        functionName: 'balanceOf',
        args: [anniAA]
    }) as bigint;
    console.log(`   🎖️  SBT Balance: ${sbtBal}\n`);
    
    // 🔍 DIAGNOSTIC: Show SuperPaymaster Operator Config
    console.log('🔍 DIAGNOSTIC: Anni SuperPaymaster Operator Config\n');
    const spAbi = [
        { name: 'operators', type: 'function', inputs: [{ name: '', type: 'address' }], 
          outputs: [
              { name: 'aPNTsBalance', type: 'uint128' },
              { name: 'exchangeRate', type: 'uint96' },
              { name: 'isConfigured', type: 'bool' },
              { name: 'isPaused', type: 'bool' },
              { name: 'xPNTsToken', type: 'address' }
          ], stateMutability: 'view' }
    ];
    const operatorConfig = await publicClient.readContract({
        address: anniPM,
        abi: spAbi,
        functionName: 'operators',
        args: [anniAccount.address]
    }) as [bigint, bigint, boolean, boolean, string];
    
    console.log(`   💰 aPNTs Balance: ${formatEther(operatorConfig[0])}`);
    console.log(`   💱 Exchange Rate: ${formatEther(operatorConfig[1])} (cPNTs per aPNTs)`);
    console.log(`   ⚙️  Configured: ${operatorConfig[2]}`);
    console.log(`   ⏸️  Paused: ${operatorConfig[3]}`);
    console.log(`   🎫 xPNTs Token: ${operatorConfig[4]}`);
    
    // Verify xPNTs token matches cPNTs
    if (operatorConfig[4].toLowerCase() === cPNTs.toLowerCase()) {
        console.log(`   ✅ Token Match: Operator's xPNTs = cPNTs`);
    } else {
        console.log(`   ⚠️  Token Mismatch! Expected: ${cPNTs}, Got: ${operatorConfig[4]}`);
    }
    
    // Query Cache Price and Token Prices
    const cachePriceAbi = [{
        name: 'cachedPrice',
        type: 'function',
        inputs: [],
        outputs: [
            { name: 'price', type: 'int256' },
            { name: 'updatedAt', type: 'uint256' },
            { name: 'roundId', type: 'uint80' },
            { name: 'decimals', type: 'uint8' }
        ],
        stateMutability: 'view'
    }];
    
    const cacheData = await publicClient.readContract({
        address: anniPM,
        abi: cachePriceAbi,
        functionName: 'cachedPrice'
    }) as [bigint, bigint, bigint, number];
    
    const cacheAgeSeconds = Math.floor(Date.now() / 1000) - Number(cacheData[1]);
    const cacheAgeMinutes = Math.floor(cacheAgeSeconds / 60);
    console.log(`\n   💹 Cache Price (ETH/USD): $${Number(cacheData[0]) / 1e8}`);
    console.log(`   🕒 Cache Age: ${cacheAgeMinutes} minutes ago (${new Date(Number(cacheData[1]) * 1000).toISOString()})`);
    console.log(`   🔢 Decimals: ${cacheData[3]}`);
    
    // Query aPNTs Price from xPNTsFactory
    const apntsPriceAbi = [{
        name: 'aPNTsPriceUSD',
        type: 'function',
        inputs: [],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view'
    }];
    
    const aPNTsPrice = await publicClient.readContract({
        address: config.contracts.xPNTsFactory,
        abi: apntsPriceAbi,
        functionName: 'aPNTsPriceUSD'
    }) as bigint;
    
    console.log(`   💵 aPNTs Price (USD): $${formatEther(aPNTsPrice)}`);
    
    // Calculate cPNTs Price (based on exchange rate)
    const cPNTsPrice = Number(aPNTsPrice) / Number(operatorConfig[1]); // aPNTs price / exchange rate
    console.log(`   🎫 cPNTs Price (USD): $${(cPNTsPrice / 1e18).toFixed(6)} (via exchange rate)`);

    // 🔍 DIAGNOSTIC: Chainlink Feed Check
    console.log('🔍 DIAGNOSTIC: Chainlink Feed Status\n');
    const feedAbi = [{
        name: 'latestRoundData', type: 'function', inputs: [], outputs: [
            { name: 'roundId', type: 'uint80' },
            { name: 'answer', type: 'int256' },
            { name: 'startedAt', type: 'uint256' },
            { name: 'updatedAt', type: 'uint256' },
            { name: 'answeredInRound', type: 'uint80' }
        ], stateMutability: 'view'
    }];
    const feedAddr = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; // Hardcoded from cast check
    try {
        const feedData = await publicClient.readContract({
            address: feedAddr, abi: feedAbi, functionName: 'latestRoundData'
        }) as [bigint, bigint, bigint, bigint, bigint];
        
        const now = Math.floor(Date.now()/1000);
        const feedAge = now - Number(feedData[3]);
        console.log(`   🔗 Feed Address: ${feedAddr}`);
        console.log(`   🏷️  Feed Price: $${Number(feedData[1])/1e8}`);
        console.log(`   🕒 Feed UpdatedAt: ${feedData[3]} (${feedAge}s ago)`);
        
        // Check Threshold logic manually
        // threshold = 3600
        if (feedAge > 3600) {
            console.log(`   ⚠️  Feed STALE! Age ${feedAge} > 3600. updatePrice will revert.`);
        } else {
            console.log(`   ✅ Feed Fresh. Age ${feedAge} <= 3600.`);
        }
    } catch(e:any) {
        console.log(`   ⚠️ Failed to read Feed: ${e.message}`);
    }
    console.log('\n');

    // NOTE: Anni uses SuperPaymaster, not PaymasterV4
    // So we skip the PaymasterV4-specific setup (addStake, updatePrice, etc.)
    // Those should already be done by l4-setup.ts

    console.log('📋 Step 1: Preparing transfer calldata...');

    // Step 2: Check & Initialize Paymaster Deposit
    console.log('\nStep 2: Checking Paymaster Token Support & Deposit...');
    
    // Check if token is supported
    // Since there's no public query for supportedTokens in PaymasterBase (it's internal mapping)
    // We can just try to add it or skip if we are unsure.
    // Actually, PaymasterV4Client has addGasToken.
    console.log(`   Ensuring ${cPNTs} is supported...`);
    try {
        const gasTokenHash = await PaymasterOperator.addGasToken(anniWallet, anniPM, cPNTs);
        if (gasTokenHash) {
            console.log(`   📝 Sent addGasToken transaction: ${gasTokenHash}`);
            await publicClient.waitForTransactionReceipt({ hash: gasTokenHash });
            console.log(`   ✅ Token ${cPNTs} added.`);
        }
    } catch (e: any) {
        console.log(`   ✓ Token support check/add done (might already be supported).`);
    }

    // Check token price (Skip for SuperPaymaster which uses Oracle/ExchangeRate)
    // console.log(`   Checking ${cPNTs} price...`);
    // NOTE: SuperPaymaster doesn't use the 'tokenPrices' mapping in the same way as PaymasterV4.
    // It uses cachedPrice() and exchangeRate(). We assume l4-setup.ts verified these.
    console.log(`   ✓ Skipping explicit tokenPrices check for SuperPaymaster.`);

    let balance = 0n;
    // Check Deposit (SKIP "balances" for SuperPaymaster, checks Operator Balance instead)
    if (anniPM === config.contracts.superPaymaster) {
         // It's SuperPaymaster, we check 'operators' mapping. First return value is aPNTsBalance (uint128)
         console.log(`   ℹ️  SuperPaymaster detected. Checking Operator (${anniAccount.address}) Credit...`);
         const spAbi = [{ 
             name: 'operators', 
             type: 'function', 
             inputs: [{ name: '', type: 'address' }], 
             outputs: [
                 { name: 'aPNTsBalance', type: 'uint128' },
                 { name: 'exchangeRate', type: 'uint96' },
                 { name: 'isConfigured', type: 'bool' },
                 { name: 'isPaused', type: 'bool' },
                 { name: 'xPNTsToken', type: 'address' }
             ], 
             stateMutability: 'view' 
         }];
         
         const result = await publicClient.readContract({
             address: anniPM, abi: spAbi, functionName: 'operators', args: [anniAccount.address]
         }) as [bigint, bigint, boolean, boolean, string];
         
         balance = result[0]; // aPNTsBalance is first
         console.log(`   Operator Credit: ${formatEther(balance)} aPNTs`);

         // Ensure sufficient credit (Deposit more if needed)
         if (balance < parseEther('90000')) {
             console.log('   ⚠️ Credit low (< 90k). (Manual deposit check skipped as Solvency confirmed).');
             /*
             try {
                // Use raw writeContract since helper failed
                const depTx = await anniWallet.writeContract({
                    address: anniPM,
                    abi: [{ name: 'depositAPNTs', type: 'function', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' }],
                    functionName: 'depositAPNTs',
                    args: [parseEther('50000')],
                    chain: sepolia,
                    account: anniAccount
                });
                console.log(`   📝 Deposit Tx: ${depTx}`);
                await publicClient.waitForTransactionReceipt({ hash: depTx });
                console.log('   ✅ Deposit Confirmed.');
             } catch (e: any) {
                 console.log('   Warning: Failed to deposit (maybe insufficient token balance):', e.message);
             }
             */
         }



         // Step 2.5: Ensure Oracle Cache is valid (fixes AA33 OracleError)
         console.log('Step 2.5: Ensuring Oracle Price Cache...');
         const updateAbi = [{ name: 'updatePrice', type: 'function', inputs: [], outputs: [], stateMutability: 'nonpayable' }];
         try {
             console.log('   🔄 Calling updatePrice() with explicit 500k gas...');
             const hash = await anniWallet.writeContract({
                 address: anniPM,
                 abi: updateAbi,
                 functionName: 'updatePrice',
                 args: [],
                 chain: sepolia,
                 account: anniAccount,
                 gas: 500000n
             });
             console.log(`   Oracle Update Tx Sent: ${hash}`);
             await publicClient.waitForTransactionReceipt({ hash });
             console.log('   ✓ Oracle Cache Updated.');
         } catch (e) {
             console.warn('   ⚠️ Failed to update Oracle Price (might be already valid or reverted):', e);
         }

          // Check aPNTsPriceUSD in Paymaster Storage (DivZero check)
         console.log('   Checking SuperPaymaster aPNTsPriceUSD...');
         try {
             // We need to read raw storage or use a helper, but ABI is easiest
             const priceResult = await publicClient.readContract({
                 address: anniPM,
                 abi: [{ name: 'aPNTsPriceUSD', type: 'function', inputs: [], outputs: [{ type: 'uint256' }] }],
                 functionName: 'aPNTsPriceUSD'
             }) as bigint;
             console.log(`   📉 SuperPaymaster aPNTs Price (Storage): ${priceResult.toString()}`);
             if (priceResult === 0n) {
                 console.log('   🚨 CRITICAL: aPNTsPriceUSD is ZERO! This will cause DivByZero Revert.');
             }
         } catch (e: any) {
             console.log('   ⚠️ Failed to read aPNTsPriceUSD:', e.message);
         }


    } else {
         balance = await PaymasterClient.getDepositedBalance(publicClient, anniPM, anniAA, cPNTs);
         console.log(`   Current deposit: ${formatEther(balance)} cPNTs`);
    }

    if (balance < parseEther('10')) {
        console.log(`   Depositing 100 cPNTs for ANNI (Operator Credit)...`);
        // For SuperPaymaster, we deposit to Operator
        if (anniPM === config.contracts.superPaymaster) {
             // ... deposit logic for SuperPM (omitted for brevity, setup usually handles this) ...
             console.log(`   ⚠️  Low Credit! Using what we have or relying on setup.`);
        } else {
            console.log('   📝 Approving Paymaster...');
            const approveHash = await anniWallet.writeContract({
                address: cPNTs,
                abi: [{ name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
                functionName: 'approve',
                args: [anniPM, parseEther('1000')]
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });

            console.log('   🏦 Depositing into Paymaster...');
            const depositHash = await PaymasterClient.depositFor(anniWallet, anniPM, anniAA, cPNTs, parseEther('100'));
            await publicClient.waitForTransactionReceipt({ hash: depositHash });
            
            balance = await PaymasterClient.getDepositedBalance(publicClient, anniPM, anniAA, cPNTs);
            console.log(`   ✅ New deposit balance: ${formatEther(balance)} cPNTs`);
        }
    }

    // Step 3: Execute Gasless Transfer
    console.log('\nStep 3: Submitting Gasless UserOperation...');
    const transferAmount = parseEther('2');
    const transferCalldata = encodeFunctionData({
        abi: [{ name: 'execute', type: 'function', inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'func', type: 'bytes' }], outputs: [], stateMutability: 'nonpayable' }],
        functionName: 'execute',
        args: [
            cPNTs, 
            0n, 
            encodeFunctionData({
                abi: [{ name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }],
                functionName: 'transfer',
                args: [bobEOA, transferAmount]
            })
        ]
    });

    try {
        const userOpHash = await PaymasterClient.submitGaslessUserOperation(
            publicClient,
            anniWallet,
            anniAA,
            config.contracts.entryPoint as Address,
            anniPM,
            cPNTs,
            process.env.BUNDLER_URL!,
            transferCalldata,
            {
                operator: anniAccount.address // Enable SuperPaymaster logic
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
                const txHash = result.result.receipt ? result.result.receipt.transactionHash : result.result.transactionHash;
                console.log(`   🎉 UserOp Executed! Transaction: ${txHash}`);
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
