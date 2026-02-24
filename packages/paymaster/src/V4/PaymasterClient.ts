import { type Address, type Hex, parseAbi, encodePacked, keccak256, toBytes, concat, pad, toHex, encodeFunctionData, encodeAbiParameters, parseAbiParameters } from 'viem';
import { type PublicClient } from '@aastar/core';
import { buildPaymasterData, buildSuperPaymasterData, formatUserOpV07, getUserOpHashV07, tuneGasLimit } from './PaymasterUtils.js';
import { detectBundlerType, BundlerType } from './BundlerCompat.js';

/**
 * PaymasterClient
 * Focus: Integration, Funding, Interaction.
 */
export class PaymasterClient {
    /**
     * @private
     * Static utility class, should not be instantiated.
     */
    private constructor() {}

    private static makePlaceholderSignature(byteLength: number): `0x${string}` {
        const clamped = Math.max(0, Math.min(byteLength, 10_000));
        return (`0x${'11'.repeat(clamped)}`) as `0x${string}`;
    }

    private static estimatePreVerificationGasV07(userOp: {
        sender: Address;
        nonce: bigint;
        initCode: Hex;
        callData: Hex;
        accountGasLimits: Hex;
        preVerificationGas: bigint;
        gasFees: Hex;
        paymasterAndData: Hex;
        signature: Hex;
    }): bigint {
        const encoded = encodeAbiParameters(
            parseAbiParameters('(address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes)'),
            [
                [
                    userOp.sender,
                    userOp.nonce,
                    userOp.initCode,
                    userOp.callData,
                    userOp.accountGasLimits,
                    userOp.preVerificationGas,
                    userOp.gasFees,
                    userOp.paymasterAndData,
                    userOp.signature
                ]
            ]
        );

        const bytes = toBytes(encoded);
        let calldataCost = 0n;
        for (const b of bytes) calldataCost += b === 0 ? 4n : 16n;

        return calldataCost + 26000n;
    }
    
    /**
     * Get user's deposited balance on the Paymaster.
     */
    static async getDepositedBalance(publicClient: any, address: Address, user: Address, token: Address): Promise<bigint> {
        return publicClient.readContract({
            address,
            abi: [{
                name: 'balances',
                type: 'function',
                inputs: [
                    { name: 'user', type: 'address' },
                    { name: 'token', type: 'address' }
                ],
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view'
            }],
            functionName: 'balances',
            args: [user, token]
        });
    }

    /**
     * Deposit tokens to Paymaster for a user (enables gasless transactions).
     */
    static async depositFor(wallet: any, address: Address, user: Address, token: Address, amount: bigint) {
        return wallet.writeContract({
            address,
            abi: parseAbi(['function depositFor(address user, address token, uint256 amount) external']),
            functionName: 'depositFor',
            args: [user, token, amount],
            chain: wallet.chain
        } as any);
    }

    /**
     * Approve the Paymaster (or any spender) to spend gas tokens.
     */
    static async approveGasToken(wallet: any, token: Address, spender: Address, amount: bigint) {
        return wallet.writeContract({
            address: token,
            abi: parseAbi(['function approve(address spender, uint256 amount) external returns (bool)']),
            functionName: 'approve',
            args: [spender, amount],
            chain: wallet.chain
        } as any);
    }

    /**
     * Estimate Gas for a UserOperation.
     */
    static async estimateUserOperationGas(
        client: any,
        wallet: any,
        aaAddress: Address,
        entryPoint: Address,
        paymasterAddress: Address,
        token: Address,
        bundlerUrl: string,
        callData: `0x${string}`,
        options?: {
            validityWindow?: number;
            operator?: Address; // For SuperPaymaster
            factory?: Address;
            factoryData?: Hex;
        }
    ) {
        // 0. Check cachedPrice (Critical for Paymaster V4)
        if (!options?.operator) { // Only for Paymaster V4, not SuperPaymaster
            try {
                const cache = await client.readContract({
                    address: paymasterAddress,
                    abi: parseAbi(['function cachedPrice() view returns (uint208 price, uint48 updatedAt)']),
                    functionName: 'cachedPrice'
                }) as any;
                
                const cachedPrice: bigint = BigInt(cache?.price ?? cache?.[0] ?? 0);
                const cachedUpdatedAt: bigint = BigInt(cache?.updatedAt ?? cache?.[1] ?? 0);
                const now = BigInt(Math.floor(Date.now() / 1000));
                let stalenessThreshold = 0n;

                try {
                    stalenessThreshold = await client.readContract({
                        address: paymasterAddress,
                        abi: parseAbi(['function priceStalenessThreshold() view returns (uint256)']),
                        functionName: 'priceStalenessThreshold'
                    }) as bigint;
                } catch {}

                const isStale =
                    cachedPrice === 0n ||
                    cachedUpdatedAt === 0n ||
                    (stalenessThreshold > 0n && cachedUpdatedAt + stalenessThreshold < now);

                if (isStale) {
                    // Check if we're on testnet (chainId 11155111 = Sepolia, 11155420 = OP Sepolia)
                    const chainId = client.chain?.id || await client.getChainId();
                    const isTestnet = [11155111, 11155420, 31337].includes(chainId);

                    if (isTestnet) {
                        const updateHash = await wallet.writeContract({
                            address: paymasterAddress,
                            abi: parseAbi(['function updatePrice() external']),
                            functionName: 'updatePrice'
                        });
                        await client.waitForTransactionReceipt({ hash: updateHash });
                        console.log('[PaymasterClient] ✅ cachedPrice refreshed via updatePrice()');
                    } else {
                        throw new Error(
                            `Paymaster cachedPrice is stale on Mainnet (chainId: ${chainId}). ` +
                            `This requires Keeper to call updatePrice(). Please ensure Keeper is running.`
                        );
                    }
                }
            } catch (e: any) {
                // If error is our mainnet check, re-throw
                if (e.message?.includes('requires Keeper')) throw e;
                // Otherwise log and continue (might be old Paymaster without cachedPrice)
                console.log('[PaymasterClient] ⚠️  Failed to check cachedPrice:', e.message?.slice(0, 50));
            }
        }
        
        // 1. Construct a dummy UserOp for estimation
        let paymasterAndData: Hex;
        
        if (options?.operator) {
             paymasterAndData = buildSuperPaymasterData(paymasterAddress, options.operator, {
                verificationGasLimit: 300000n,
                postOpGasLimit: 300000n
             });
        } else {
                     paymasterAndData = buildPaymasterData(paymasterAddress, token, {
                validityWindow: options?.validityWindow,
                verificationGasLimit: 250000n, 
                postOpGasLimit: 150000n        
            });
        }

        // 1.5. Get gas fees from network
        // Strategy: testnets use aggressive floor (bundlers require higher minimums);
        //          mainnet uses dynamic estimation with 1.5x buffer for cost efficiency.
        const chainId = client.chain?.id || await client.getChainId();
        const isTestnet = [11155111, 11155420, 31337].includes(chainId);
        const TESTNET_PRIORITY_FLOOR = 500_000_000n; // 0.5 Gwei — Alchemy bundler minimum on testnets

        let maxFeePerGas = 0n;
        let maxPriorityFeePerGas = 0n;
        try {
            const feeData = await client.estimateFeesPerGas();
            maxFeePerGas = ((feeData.maxFeePerGas ?? 0n) * 115n) / 100n;
            maxPriorityFeePerGas = ((feeData.maxPriorityFeePerGas ?? 0n) * 115n) / 100n;
        } catch {}
        if (!maxFeePerGas) {
            try {
                const gasPrice = await client.getGasPrice();
                maxFeePerGas = (gasPrice * 120n) / 100n;
            } catch {}
        }
        // Testnet floor: bundlers like Alchemy require higher priority than network reports
        if (isTestnet) {
            if (maxPriorityFeePerGas < TESTNET_PRIORITY_FLOOR) maxPriorityFeePerGas = TESTNET_PRIORITY_FLOOR;
            if (maxFeePerGas < TESTNET_PRIORITY_FLOOR * 2n) maxFeePerGas = TESTNET_PRIORITY_FLOOR * 2n;
        }
        if (!maxFeePerGas) maxFeePerGas = 1n;
        if (maxFeePerGas < maxPriorityFeePerGas) maxFeePerGas = maxPriorityFeePerGas + 1n;

        const partialUserOp = {
            sender: aaAddress,
            nonce: 0n,
            initCode: (options?.factory && options?.factoryData) 
                ? concat([options.factory, options.factoryData]) 
                : '0x' as Hex,
            callData,
            accountGasLimits: concat([pad(toHex(250000n), { size: 16 }), pad(toHex(500000n), { size: 16 })]), 
            preVerificationGas: 0n, 
            gasFees: concat([pad(toHex(maxPriorityFeePerGas), { size: 16 }), pad(toHex(maxFeePerGas), { size: 16 })]),
            paymasterAndData,
            signature: PaymasterClient.makePlaceholderSignature(65)
        };

        // Get actual nonce
        try {
            const nonce = await client.readContract({
                address: aaAddress,
                abi: parseAbi(['function getNonce() view returns (uint256)']),
                functionName: 'getNonce'
            });
            partialUserOp.nonce = BigInt(nonce);
        } catch (e) {}

        partialUserOp.preVerificationGas = (PaymasterClient.estimatePreVerificationGasV07(partialUserOp) * 120n) / 100n + 5000n;

        const userOpHash = getUserOpHashV07(partialUserOp, entryPoint, BigInt(client.chain.id));
        partialUserOp.signature = (await wallet.account.signMessage({ message: { raw: userOpHash } })) as `0x${string}`;

        const payload = {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_estimateUserOperationGas',
            params: [formatUserOpV07(partialUserOp), entryPoint]
        };

        const response = await fetch(bundlerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload, (_, v) => typeof v === 'bigint' ? '0x' + v.toString(16) : v)
        });

        const result = await response.json();
        
        // Debug logging for Candide
        if (bundlerUrl.includes('candide')) {
            console.log('[PaymasterClient] Candide Request:', JSON.stringify(payload.params[0], null, 2));
            console.log('[PaymasterClient] Candide Response:', JSON.stringify(result, null, 2));
        }

        const data = result.result;

        // Debug logging for estimation
        console.log('[PaymasterClient] Gas Estimation Result:', JSON.stringify(data, null, 2));

        // Anvil Fallback for Estimation
        if (result.error && (result.error.code === -32601 || result.error.message?.includes('Method not found'))) {
             console.log('[PaymasterClient] EstimateUserOp failed (Method not found). Using Anvil defaults.');
             return {
                 preVerificationGas: partialUserOp.preVerificationGas,
                 verificationGasLimit: 1000000n, 
                 callGasLimit: 2000000n,
                 paymasterVerificationGasLimit: 100000n,
                 paymasterPostOpGasLimit: 100000n
             };
        }

        if (result.error) throw new Error(`Estimation Error: ${JSON.stringify(result.error)}`);
        
        // Dynamic tuning: use estimated values directly to maintain efficiency
        // Bundler efficiency check: actual_used / limit >= 0.4
        const estVGL = BigInt(data.verificationGasLimit);
        const estPMVGL = data.paymasterVerificationGasLimit ? BigInt(data.paymasterVerificationGasLimit) : 100000n;

        return {
            preVerificationGas: (BigInt(data.preVerificationGas) * 120n) / 100n + 5000n,
            verificationGasLimit: tuneGasLimit(estVGL, 35_000n, 0.45), 
            callGasLimit: (BigInt(data.callGasLimit) * 110n) / 100n, // Small 1.1x buffer
            paymasterVerificationGasLimit: tuneGasLimit(estPMVGL, 35_000n, 0.45),
            paymasterPostOpGasLimit: data.paymasterPostOpGasLimit ? BigInt(data.paymasterPostOpGasLimit) : 100000n
        };
    }

    /**
     * High-level API to submit a gasless UserOperation.
     * Automatically handles nonce fetching, gas estimation (if not provided), signing, and submission.
     */
    static async submitGaslessUserOperation(
        client: any,
        wallet: any,
        aaAddress: Address,
        entryPoint: Address,
        paymasterAddress: Address,
        token: Address,
        bundlerUrl: string,
        callData: `0x${string}`,
        options?: {
            validityWindow?: number;
            verificationGasLimit?: bigint;
            callGasLimit?: bigint;
            preVerificationGas?: bigint;
            maxFeePerGas?: bigint;
            maxPriorityFeePerGas?: bigint;
            autoEstimate?: boolean;
            operator?: Address; // For SuperPaymaster
            paymasterVerificationGasLimit?: bigint;
            paymasterPostOpGasLimit?: bigint;
            factory?: Address;
            factoryData?: Hex;
        }
    ): Promise<`0x${string}`> {
        // 0. Auto-Estimate if requested or if limits missing
        let gasLimits = {
            preVerificationGas: options?.preVerificationGas,
            verificationGasLimit: options?.verificationGasLimit,
            callGasLimit: options?.callGasLimit,
            paymasterVerificationGasLimit: options?.paymasterVerificationGasLimit,
            paymasterPostOpGasLimit: options?.paymasterPostOpGasLimit ?? 150000n
        };

        if (options?.autoEstimate !== false && (!gasLimits.verificationGasLimit || !gasLimits.callGasLimit)) {
            const est = await this.estimateUserOperationGas(
                client, wallet, aaAddress, entryPoint, paymasterAddress, token, bundlerUrl, callData, 
                { 
                    validityWindow: options?.validityWindow,
                    operator: options?.operator,
                    factory: options?.factory,
                    factoryData: options?.factoryData
                }
            );
            gasLimits.preVerificationGas = options?.preVerificationGas ?? est.preVerificationGas;
            gasLimits.verificationGasLimit = options?.verificationGasLimit ?? est.verificationGasLimit;
            gasLimits.callGasLimit = options?.callGasLimit ?? est.callGasLimit;
            gasLimits.paymasterVerificationGasLimit = options?.paymasterVerificationGasLimit ?? est.paymasterVerificationGasLimit;
            gasLimits.paymasterPostOpGasLimit = options?.paymasterPostOpGasLimit ?? est.paymasterPostOpGasLimit;
        }

        // 1. Get Nonce
        const nonce = await client.readContract({
            address: aaAddress,
            abi: parseAbi(['function getNonce() view returns (uint256)']),
            functionName: 'getNonce'
        });

        // 1.5 Get Gas Prices from Network if not provided
        // Strategy: testnets use aggressive floor; mainnet uses dynamic + 1.5x buffer
        const chainId = client.chain?.id || await client.getChainId();
        const isTestnet = [11155111, 11155420, 31337].includes(chainId);
        const TESTNET_PRIORITY_FLOOR = 500_000_000n; // 0.5 Gwei

        let maxFeePerGas = options?.maxFeePerGas;
        let maxPriorityFeePerGas = options?.maxPriorityFeePerGas;
        
        if (!maxFeePerGas || !maxPriorityFeePerGas) {
            try {
                const feeData = await client.estimateFeesPerGas();
                maxFeePerGas = maxFeePerGas ?? ((feeData.maxFeePerGas ?? 0n) * 115n) / 100n;
                maxPriorityFeePerGas = maxPriorityFeePerGas ?? ((feeData.maxPriorityFeePerGas ?? 0n) * 115n) / 100n;
            } catch (e) {
                maxFeePerGas = maxFeePerGas ?? undefined;
                maxPriorityFeePerGas = maxPriorityFeePerGas ?? undefined;
            }
        }
        if (!maxFeePerGas) {
            try {
                maxFeePerGas = (await client.getGasPrice()) * 150n / 100n;
            } catch {}
        }
        // Testnet floor: bundlers like Alchemy require higher priority than network reports
        if (isTestnet) {
            maxPriorityFeePerGas = maxPriorityFeePerGas ?? TESTNET_PRIORITY_FLOOR;
            if (maxPriorityFeePerGas < TESTNET_PRIORITY_FLOOR) maxPriorityFeePerGas = TESTNET_PRIORITY_FLOOR;
            if (!maxFeePerGas || maxFeePerGas < TESTNET_PRIORITY_FLOOR * 2n) maxFeePerGas = TESTNET_PRIORITY_FLOOR * 2n;
        }
        maxFeePerGas = maxFeePerGas ?? 1n;
        maxPriorityFeePerGas = maxPriorityFeePerGas ?? 0n;
        if (maxFeePerGas < maxPriorityFeePerGas) maxFeePerGas = maxPriorityFeePerGas + 1n;
        console.log(`[PaymasterClient] Gas Pricing: ${isTestnet ? 'TESTNET (0.5 Gwei floor)' : 'MAINNET (dynamic)'} | priority=${maxPriorityFeePerGas} maxFee=${maxFeePerGas}`);

        // 2. Build paymasterAndData
        let paymasterAndData: Hex;
        if (options?.operator) {
            paymasterAndData = buildSuperPaymasterData(paymasterAddress, options.operator, {
                verificationGasLimit: gasLimits.paymasterVerificationGasLimit ?? gasLimits.verificationGasLimit ?? 150000n,
                postOpGasLimit: gasLimits.paymasterPostOpGasLimit ?? 100000n
            });
        } else {
            // MATH: Target Efficiency = PVG / (PVG + VGL + PMVGL) >= 0.4
            // Since PVG is ~100k, (VGL + PMVGL) must be <= 150k.
            // We set each to 75k to safely pass the 0.4 efficiency guard.
            const pmVerGas = gasLimits.paymasterVerificationGasLimit ?? 75000n; 
            
            paymasterAndData = buildPaymasterData(paymasterAddress, token, {
                validityWindow: options?.validityWindow,
                verificationGasLimit: pmVerGas,
                postOpGasLimit: gasLimits.paymasterPostOpGasLimit ?? 100000n
            });
        }

        // 3. Construct UserOp
        const initCode = ((options?.factory && options?.factoryData) ? concat([options.factory, options.factoryData]) : '0x') as Hex;
        const accountGasLimits = concat([
            pad(toHex(gasLimits.verificationGasLimit ?? 75000n), { size: 16 }),
            pad(toHex(gasLimits.callGasLimit ?? 500000n), { size: 16 })
        ]) as Hex;
        const gasFees = concat([
            pad(toHex(maxPriorityFeePerGas), { size: 16 }),
            pad(toHex(maxFeePerGas), { size: 16 })
        ]) as Hex;
        const preVerificationGas =
            gasLimits.preVerificationGas ??
            (PaymasterClient.estimatePreVerificationGasV07({
                sender: aaAddress,
                nonce: BigInt(nonce),
                initCode,
                callData,
                accountGasLimits,
                preVerificationGas: 0n,
                gasFees,
                paymasterAndData,
                signature: PaymasterClient.makePlaceholderSignature(65)
            }) * 120n) / 100n + 5000n;

        const userOp = {
            sender: aaAddress,
            nonce: BigInt(nonce),
            initCode,
            callData,
            accountGasLimits,
            preVerificationGas,
            gasFees,
            paymasterAndData,
            signature: '0x' as `0x${string}`
        };
        
        // Debug logs (Commented out for production)
        /*
        console.log("DEBUG: UserOp Gas Limits:", {
            accountGasLimits: userOp.accountGasLimits,
            preVerificationGas: userOp.preVerificationGas,
            gasFees: userOp.gasFees,
            paymasterAndData: userOp.paymasterAndData
        });
        */


        // 4. Final Hashing and Signing
        const userOpHash = getUserOpHashV07(userOp, entryPoint, BigInt(client.chain.id));
        const signature = (await wallet.account.signMessage({ message: { raw: userOpHash } })) as `0x${string}`;
        userOp.signature = signature;


        // 6. Submit to Bundler (Unified JSON-RPC)
        const bundlerType = detectBundlerType(bundlerUrl);
        console.log(`[PaymasterClient] Using ${bundlerType} Bundler`);
        
        // Retry Loop: Up to 4 retries for compound errors (PVG + fee bump + replacement)
        for (let attempt = 0; attempt < 5; attempt++) {
            // Use standard JSON-RPC for all bundlers (Pimlico/Alchemy/Stackup/etc)
            const response = await fetch(bundlerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_sendUserOperation',
                    params: [formatUserOpV07(userOp), entryPoint]
                }, (_, v) => typeof v === 'bigint' ? '0x' + v.toString(16) : v)
            });

            const result = await response.json();
            
            // 7. Error Handling & Retry Logic (Fee Bump)
            if (result.error && attempt < 4) {
                const msg = result.error.message || '';
                const errData = result.error.data || {};
                
                // Case A: Replacement Underpriced (Nonce collision in mempool)
                // e.g. {"code":-32602,"message":"replacement underpriced","data":{"currentMaxPriorityFee":"0x5f5e100","currentMaxFee":"0xf6a44be"}}
                if (result.error.code === -32602 || msg.includes('replacement underpriced')) {
                     console.log(`[PaymasterClient] ⚠️  Replacement Underpriced. Bumping fees to replace pending UserOp...`);
                     let newMaxPriority = userOp.gasFees ? BigInt('0x' + userOp.gasFees.slice(2, 34)) : 0n;
                     let newMaxFee = userOp.gasFees ? BigInt('0x' + userOp.gasFees.slice(34)) : 0n;

                     // Extract from data if available (Alchemy/Pimlico standard)
                     if (errData.currentMaxPriorityFee && errData.currentMaxFee) {
                         const currentPriority = BigInt(errData.currentMaxPriorityFee);
                         const currentMax = BigInt(errData.currentMaxFee);
                         
                         // Bump by 10% to ensure replacement (Geth/Alchemy minimum)
                         newMaxPriority = (currentPriority * 110n) / 100n;
                         newMaxFee = (currentMax * 110n) / 100n;
                     } else {
                         // Fallback: Bump current values by 15% if data missing
                         newMaxPriority = (newMaxPriority * 115n) / 100n;
                         newMaxFee = (newMaxFee * 115n) / 100n;
                     }

                     console.log(`   -> New Priority: ${newMaxPriority}, New MaxFee: ${newMaxFee}`);
                     
                     // Update UserOp
                     userOp.gasFees = concat([
                        pad(toHex(newMaxPriority), { size: 16 }),
                        pad(toHex(newMaxFee), { size: 16 })
                     ]) as Hex;

                     // Re-Sign
                     const newHash = getUserOpHashV07(userOp, entryPoint, BigInt(client.chain.id));
                     userOp.signature = (await wallet.account.signMessage({ message: { raw: newHash } })) as `0x${string}`;
                     
                     continue; // Retry
                }

                // Case B: Priority Fee too low
                // e.g. "maxPriorityFeePerGas ... is 1007884 but must be at least 100000000"
                const matchPriority = msg.match(/maxPriorityFeePerGas.*(?:at least|expected) (\d+)/i) || msg.match(/priority fee.*(?:at least|expected) (\d+)/i);
                
                // Case C: Max Fee too low (often happens after bumping priority)
                // e.g. "maxFeePerGas is 339637908 but must be at least 392531063"
                const matchMaxFee = msg.match(/maxFeePerGas.*(?:at least|expected) (\d+)/i);

                if (matchPriority || matchMaxFee) {
                    console.log(`[PaymasterClient] ⚠️  Fee Error: ${msg}. Retrying with higher fees...`);
                    
                    let newMaxPriority = userOp.gasFees ? BigInt('0x' + userOp.gasFees.slice(2, 34)) : 0n;
                    let newMaxFee = userOp.gasFees ? BigInt('0x' + userOp.gasFees.slice(34)) : 0n;

                    if (matchPriority && matchPriority[1]) {
                        const required = BigInt(matchPriority[1]);
                        if (required > newMaxPriority) {
                            console.log(`   -> Bumping Priority Fee to ${required}`);
                            // Bump maxFee by at least the delta
                            const delta = required - newMaxPriority;
                            newMaxPriority = required;
                            newMaxFee += delta;
                        }
                    }

                    if (matchMaxFee && matchMaxFee[1]) {
                         const required = BigInt(matchMaxFee[1]);
                         if (required > newMaxFee) {
                            console.log(`   -> Bumping Max Fee to ${required}`);
                            newMaxFee = required;
                         }
                    }

                    // Double check maxFee >= maxPriority
                    if (newMaxFee < newMaxPriority) newMaxFee = newMaxPriority + 1n; // Minimal bump

                    // Update UserOp
                    userOp.gasFees = concat([
                        pad(toHex(newMaxPriority), { size: 16 }),
                        pad(toHex(newMaxFee), { size: 16 })
                    ]) as Hex;

                    // Re-Sign
                    const newHash = getUserOpHashV07(userOp, entryPoint, BigInt(client.chain.id));
                    userOp.signature = (await wallet.account.signMessage({ message: { raw: newHash } })) as `0x${string}`;
                    
                    continue; // Retry
                }

                // Case D: PreVerificationGas too low (common on L2s like Optimism)
                // e.g. "precheck failed: preVerificationGas is 57368 but must be at least 108901"
                const matchPVG = msg.match(/preVerificationGas.*(?:at least|expected) (\d+)/i);
                if (matchPVG && matchPVG[1]) {
                    const requiredPVG = BigInt(matchPVG[1]);
                    const currentPVG = BigInt(userOp.preVerificationGas);
                    
                    if (requiredPVG > currentPVG) {
                        console.log(`[PaymasterClient] ⚠️  PVG Error: ${msg}. Updating preVerificationGas...`);
                        
                        // Add 5% buffer to avoid "chasing" the requirement on L2s
                        const bufferedPVG = (requiredPVG * 105n) / 100n;
                        console.log(`   -> Updating PVG from ${currentPVG} to ${bufferedPVG} (inc. buffer)`);
                        
                        // Update PVG and re-sign
                        userOp.preVerificationGas = bufferedPVG;
                        const newHash = getUserOpHashV07(userOp, entryPoint, BigInt(client.chain.id));
                        userOp.signature = (await wallet.account.signMessage({ message: { raw: newHash } })) as `0x${string}`;
                        
                        continue; // Retry
                    }
                }
            }

            if (result.error && (result.error.code === -32601 || result.error.message?.includes('Method not found'))) {
                 console.log('[PaymasterClient] SendUserOp failed (Method not found). Falling back to direct handleOps...');
                 
                 const caller = wallet.account?.address ? wallet.account.address : wallet.account;

                 return await wallet.writeContract({
                     address: entryPoint,
                     abi: parseAbi(['function handleOps((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes)[], address) external']),
                     functionName: 'handleOps',
                     args: [[userOp], caller],
                     chain: wallet.chain,
                     account: wallet.account
                 });
            }

            if (result.error) throw new Error(`Bundler Error: ${JSON.stringify(result.error)}`);
            console.log('[PaymasterClient] ✅ Submitted via', bundlerType, 'hash:', result.result);
            return result.result;
        }

        throw new Error("Failed to submit UserOp after retries");
    }

    /**
     * Helper to extract the actual Gas Token fee from a UserOperation receipt.
     * Looks for the 'PostOpProcessed' event emitted by the Paymaster.
     */
    static getFeeFromReceipt(receipt: any, paymasterAddress: Address): { tokenCost: bigint, actualGasCostWei: bigint } | null {
        // Event Signature: PostOpProcessed(address indexed user, address indexed token, uint256 actualGasCostWei, uint256 tokenCost, uint256 protocolRevenue)
        // Topic0: 0x62544d7f48b11c32334310ebd306b47224fca220163218d4a7264322c52ae073
        const TOPIC_POST_OP = '0x62544d7f48b11c32334310ebd306b47224fca220163218d4a7264322c52ae073';

        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === paymasterAddress.toLowerCase() && log.topics[0] === TOPIC_POST_OP) {
                // Decode Data: actualGasCostWei, tokenCost, protocolRevenue (3x uint256)
                // We manually decode or use viem's decodeEventLog if available.
                // Here we use a lightweight manual decode for the data part (non-indexed).
                // Data is 3 * 32 bytes.
                const data = log.data.replace('0x', '');
                if (data.length >= 192) { // 3 * 64 hex chars = 192
                    const actualGasCostWei = BigInt('0x' + data.slice(0, 64));
                    const tokenCost = BigInt('0x' + data.slice(64, 128));
                    // const protocolRevenue = BigInt('0x' + data.slice(128, 192));
                    return { tokenCost, actualGasCostWei };
                }
            }
        }
        return null;
    }

    /**
     * Get the fee for a specific transaction hash.
     * Fetches the receipt (no scanning required) and decodes the log.
     */
    static async getTransactionFee(publicClient: any, txHash: `0x${string}`, paymasterAddress: Address) {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        return this.getFeeFromReceipt(receipt, paymasterAddress);
    }

    // ===========================================
    // 🛠️ Semantic CallData Builders (For DX)
    // ===========================================

    /**
     * Helper: Encode a standardized ERC-20 Transfer.
     * Returns the raw function data: `transfer(to, amount)`
     */
    static encodeTokenTransfer(recipient: Address, amount: bigint): `0x${string}` {
        return encodeFunctionData({
            abi: parseAbi(['function transfer(address to, uint256 amount) external returns (bool)']),
            functionName: 'transfer',
            args: [recipient, amount]
        });
    }

    /**
     * Helper: Encode a SimpleAccount execution.
     * Wraps the inner call into: `execute(target, value, data)`
     * This is the payload signed by the user.
     */
    static encodeExecution(target: Address, value: bigint, data: `0x${string}`): `0x${string}` {
        return encodeFunctionData({
            abi: parseAbi(['function execute(address dest, uint256 value, bytes func) external']),
            functionName: 'execute',
            args: [target, value, data]
        });
    }

    /**
     * More robust version of waitForUserOperationReceipt.
     * Catches timeouts and returns a cleaner result.
     */
    static async waitForUserOperation(bundlerClient: any, hash: `0x${string}`, timeout = 180000) {
        try {
            return await bundlerClient.waitForUserOperationReceipt({ hash, timeout });
        } catch (error: any) {
            const errName = error.name || '';
            const errMsg = error.message || '';
            if (
                errName === 'TimeoutError' || 
                errName === 'WaitForUserOperationReceiptTimeoutError' || 
                /timed? out/i.test(errMsg)
            ) {
                return { timeout: true, hash };
            }
            throw error;
        }
    }
}
