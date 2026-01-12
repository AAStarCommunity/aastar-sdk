import { type Address, concat, pad, toHex, parseAbi, parseAbiItem, encodeFunctionData } from 'viem';
import { buildPaymasterData, formatUserOpV07, getUserOpHashV07 } from './PaymasterUtils';

/**
 * PaymasterClient
 * Focus: Integration, Funding, Interaction.
 */
export class PaymasterClient {
    
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
        }
    ) {
        // 1. Construct a dummy UserOp for estimation
        const paymasterAndData = buildPaymasterData(paymasterAddress, token, {
            validityWindow: options?.validityWindow,
            verificationGasLimit: 60000n, // Placeholder
            postOpGasLimit: 60000n        // Placeholder
        });

        // 1.5. Get dynamic gas prices from network
        let maxFeePerGas = 30000000000n; // 30 Gwei default
        let maxPriorityFeePerGas = 1000000000n; // 1 Gwei default
        
        try {
            const feeData = await client.estimateFeesPerGas();
            maxFeePerGas = (feeData.maxFeePerGas ?? 30000000000n) * 150n / 100n; // 1.5x buffer
            maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas ?? 1000000000n) * 150n / 100n;
            if (maxPriorityFeePerGas < 500000000n) maxPriorityFeePerGas = 500000000n; // Min 0.5 Gwei
        } catch (e) {
            // Use defaults if estimation fails
        }

        const partialUserOp = {
            sender: aaAddress,
            nonce: 0n,
            initCode: '0x' as `0x${string}`,
            callData,
            accountGasLimits: concat([pad(toHex(60000n), { size: 16 }), pad(toHex(100000n), { size: 16 })]), // 60k verification, 100k call
            preVerificationGas: 50000n, // 50k PVG
            gasFees: concat([pad(toHex(maxPriorityFeePerGas), { size: 16 }), pad(toHex(maxFeePerGas), { size: 16 })]),
            paymasterAndData,
            signature: '0x' as `0x${string}`
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

        if (result.error) throw new Error(`Estimation Error: ${JSON.stringify(result.error)}`);

        const data = result.result;
        
        // Dynamic tuning based on "Efficiency Guard" formulas
        return {
            preVerificationGas: BigInt(data.preVerificationGas),
            verificationGasLimit: BigInt(data.verificationGasLimit), // No buffer to satisfy efficiency > 0.4
            callGasLimit: (BigInt(data.callGasLimit) * 110n) / 100n,                // 1.1x safety buffer
            paymasterPostOpGasLimit: 100000n                                       // Explicitly high for Oracle
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
        }
    ): Promise<`0x${string}`> {
        // 0. Auto-Estimate if requested or if limits missing
        let gasLimits = {
            preVerificationGas: options?.preVerificationGas,
            verificationGasLimit: options?.verificationGasLimit,
            callGasLimit: options?.callGasLimit,
            paymasterPostOpGasLimit: 100000n
        };

        if (options?.autoEstimate !== false && (!gasLimits.verificationGasLimit || !gasLimits.callGasLimit)) {
            const est = await this.estimateUserOperationGas(
                client, wallet, aaAddress, entryPoint, paymasterAddress, token, bundlerUrl, callData, 
                { validityWindow: options?.validityWindow }
            );
            gasLimits.preVerificationGas = options?.preVerificationGas ?? est.preVerificationGas;
            gasLimits.verificationGasLimit = options?.verificationGasLimit ?? est.verificationGasLimit;
            gasLimits.callGasLimit = options?.callGasLimit ?? est.callGasLimit;
            gasLimits.paymasterPostOpGasLimit = est.paymasterPostOpGasLimit;
        }

        // 1. Get Nonce
        const nonce = await client.readContract({
            address: aaAddress,
            abi: parseAbi(['function getNonce() view returns (uint256)']),
            functionName: 'getNonce'
        });

        // 1.5 Get Gas Prices from Network if not provided
        let maxFeePerGas = options?.maxFeePerGas;
        let maxPriorityFeePerGas = options?.maxPriorityFeePerGas;
        
        if (!maxFeePerGas || !maxPriorityFeePerGas) {
            try {
                const feeData = await client.estimateFeesPerGas();
                // Apply 1.5x buffer for network volatility
                maxFeePerGas = maxFeePerGas ?? ((feeData.maxFeePerGas ?? 30000000000n) * 150n) / 100n;
                maxPriorityFeePerGas = maxPriorityFeePerGas ?? ((feeData.maxPriorityFeePerGas ?? 1000000000n) * 150n) / 100n;
                if (maxPriorityFeePerGas < 500000000n) maxPriorityFeePerGas = 500000000n; // Min 0.5 Gwei
            } catch (e) {
                // Fallback to safer defaults if estimation fails
                maxFeePerGas = maxFeePerGas ?? 50000000000n; // 50 Gwei
                maxPriorityFeePerGas = maxPriorityFeePerGas ?? 2000000000n; // 2 Gwei
            }
        }

        // 2. Build paymasterAndData
        const paymasterAndData = buildPaymasterData(paymasterAddress, token, {
            validityWindow: options?.validityWindow,
            verificationGasLimit: gasLimits.verificationGasLimit ?? 150000n, // Use tuned value
            postOpGasLimit: gasLimits.paymasterPostOpGasLimit ?? 100000n
        });

        // 3. Construct UserOp
        const userOp = {
            sender: aaAddress,
            nonce: BigInt(nonce),
            initCode: '0x' as `0x${string}`,
            callData,
            accountGasLimits: concat([
                pad(toHex(gasLimits.verificationGasLimit ?? 150000n), { size: 16 }), // Verification (Tuned or Default)
                pad(toHex(gasLimits.callGasLimit ?? 500000n), { size: 16 })        // Call (Tuned or Default)
            ]),
            preVerificationGas: gasLimits.preVerificationGas ?? 50000n,
            gasFees: concat([
                pad(toHex(maxPriorityFeePerGas), { size: 16 }),
                pad(toHex(maxFeePerGas), { size: 16 })
            ]),
            paymasterAndData,
            signature: '0x' as `0x${string}`
        };

        // 4. Final Hashing and Signing
        const userOpHash = getUserOpHashV07(userOp, entryPoint, BigInt(client.chain.id));
        const signature = (await wallet.account.signMessage({ message: { raw: userOpHash } })) as `0x${string}`;
        userOp.signature = signature;

        // 6. Submit to Bundler
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
        if (result.error) throw new Error(`Bundler Error: ${JSON.stringify(result.error)}`);
        return result.result;
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
}
