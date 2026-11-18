import { type Address, type Hex, parseAbi, encodePacked, keccak256, toBytes, concat, pad, toHex, encodeFunctionData, encodeAbiParameters, parseAbiParameters, decodeEventLog } from 'viem';
import { type PublicClient, EntryPointABI, SUPER_PAYMASTER_FLAGS } from '@aastar/core';
import { buildPaymasterData, buildSuperPaymasterData, formatUserOpV07, getUserOpHashV07 } from './PaymasterUtils.js';
import { DEFAULT_GAS_LIMIT_COEFFICIENT_BPS, resolveUserOpFees, scaleLimits, type FeePolicy, type GasDecision, type LimitSource, type UserOpGasLimits } from './gasPolicy.js';
import { detectBundlerType, BundlerType } from './BundlerCompat.js';
import { resolveSuperPaymasterSponsorship, atLeast, SuperPaymasterInflightGuard, decideSuperPaymasterSpRenew, userOpMaxCostV07, type SuperPaymasterSponsorshipContext } from '../SuperPaymaster/v550.js';
import { readUserOperationResult, userOperationNotYetValidFromRpc, UserOperationFailedError, type UserOperationExecutionResult, type WaitForUserOperationResultOptions } from './userOpOutcome.js';

/** Options of PaymasterClient.submitGaslessUserOperation. */
export type SubmitGaslessOptions = {
    validityWindow?: number;
    airAccountSig?: boolean; // v0.20.0 AirAccount: emit algId-prefixed [0x02] sig to avoid intermittent AA24
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
    /**
     * SuperPaymaster 5.5.0 flags byte (SUPER_PAYMASTER_FLAGS). When set, it is used as is. When
     * unset, SP_RENEW is added only when decideSuperPaymasterSpRenew says the op needs it and the
     * token allows it (see superPaymasterAutoRenew).
     */
    superPaymasterFlags?: number;
    /**
     * 5.5.0, superPaymasterFlags unset: decide SP_RENEW per op from the token's previewLock
     * (default true). false = never set it (flags 0, the behaviour before this option existed).
     */
    superPaymasterAutoRenew?: boolean;
    /**
     * A floor for SuperPaymaster's paymasterVerificationGasLimit. Unset: none beyond estimate × coefficient
     * (the old 250k draft floor was below what the credit branch needs on 5.5.x).
     */
    superPaymasterVerificationGasFloor?: bigint;
    /**
     * Adjust the bundler estimate before it is used, so a caller that tunes limits needs no
     * estimation round-trip of its own. Explicit limits in these options still win over anything
     * returned here.
     */
    tuneEstimate?: (est: GasEstimate) => Partial<GasEstimate>;
    /**
     * All five limits, fixed for a data collection and used exactly as given (no estimate). Refused when a
     * limit is below a contract floor read from the chain (SuperPaymaster minPostOpGas) or below
     * superPaymasterVerificationGasFloor, instead of being raised: a raised limit would change actualGas.
     */
    frozenGas?: UserOpGasLimits;
    /** Estimate × this coefficient, in basis points (default DEFAULT_GAS_LIMIT_COEFFICIENT_BPS = 15000, i.e. 1.5x). */
    gasLimitCoefficientBps?: bigint;
    /** How fees are taken from the chain when maxFeePerGas / maxPriorityFeePerGas are not both given. */
    feePolicy?: FeePolicy;
    /** Called with the limits, fees and their sources before the op is signed, so a collector can record them. */
    onGasDecided?: (decision: GasDecision) => void;
};

/** The limits used when the endpoint cannot estimate at all (eth_estimateUserOperationGas missing): defaults, not estimates. */
/**
 * A V4 paymaster's postOp limit when the bundler gives no estimate for it (Alchemy omits the field): the value the SDK
 * used before limits came from estimates (max(est + 100k, 200k) with no estimate). Labelled 'default', not scaled.
 */
export const V4_DEFAULT_POSTOP_GAS = 200_000n;

const LOCAL_DEFAULT_LIMITS: GasEstimate = {
    preVerificationGas: 0n, verificationGasLimit: 1_000_000n, callGasLimit: 2_000_000n,
    paymasterVerificationGasLimit: 100_000n, paymasterPostOpGasLimit: 100_000n,
};

/** Options of PaymasterClient.estimateUserOperationGas. */
export type EstimateGasOptions = {
    validityWindow?: number;
    airAccountSig?: boolean; // v0.20.0 AirAccount: emit algId-prefixed [0x02] sig to avoid intermittent AA24
    operator?: Address; // For SuperPaymaster
    factory?: Address;
    factoryData?: Hex;
    /** SuperPaymaster 5.5.0 flags byte — must match the submitted op, or a user whose cap needs SP_RENEW fails validation during estimation. */
    superPaymasterFlags?: number;
    /** As SubmitGaslessOptions.superPaymasterAutoRenew: decided here for the estimation op's own limits. */
    superPaymasterAutoRenew?: boolean;
    /**
     * Sponsorship already read for this op. When set, it is not read again — a 5.4.2→5.5.0
     * upgrade between submit's read and this one would otherwise build two generations.
     */
    sponsorship?: SuperPaymasterSponsorshipContext;
    /**
     * Nonce already chosen for this op. Submit passes the reconciled value
     * (EntryPoint.getNonce when a hold exists, otherwise the account nonce)
     * so estimation cannot sign a different one.
     */
    nonce?: bigint;
    /** Fees for the estimation op; unset ones come from the chain (feePolicy). */
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    feePolicy?: FeePolicy;
};

/** What estimateUserOperationGas returns (all limits). */
export type GasEstimate = {
    preVerificationGas: bigint;
    verificationGasLimit: bigint;
    callGasLimit: bigint;
    paymasterVerificationGasLimit: bigint;
    paymasterPostOpGasLimit: bigint;
};

/**
 * Only a well-formed JSON-RPC answer (jsonrpc + id + exactly one of result / error) proves the
 * bundler processed the request. A gateway body such as {"message": "..."} parses as JSON but says
 * nothing about whether the signed op reached the bundler, so it throws while the in-flight
 * exposure flag is still set — the slot is kept, like any other ambiguous failure.
 */
function assertJsonRpcAnswer(r: any, method: string): void {
    const ok = r !== null && typeof r === 'object' && r.jsonrpc === '2.0' && 'id' in r && (('result' in r) !== ('error' in r));
    if (!ok) throw new Error(`${method}: bundler returned a non-JSON-RPC answer: ${JSON.stringify(r)?.slice(0, 200)}`);
}

/**
 * Did the node definitively refuse a transaction BEFORE broadcasting it (so it is pending nowhere)?
 * Only codes / messages that cannot follow a broadcast count:
 *   - code 3: execution reverted during gas estimation (pre-signing);
 *   - code 4001: the user rejected the request in the wallet;
 *   - otherwise only whitelisted node messages (insufficient funds, intrinsic gas too low, …).
 * Anything about nonce / replacement / underpriced / already — which a node or bundler can report
 * on its own internal retry while the original is in flight or mined — and any unrecognised
 * message, transport error, timeout or -32603 is NOT a rejection: the slot stays reserved until
 * the caller has looked the transaction up by hash and calls release().
 *
 * A rejection needs provenance, not just matching words:
 *   - any transport-level error in the chain (HTTP status, timeout, socket) is ambiguous, whatever
 *     its body says — a proxy can answer 503 "upstream timeout; last error: insufficient funds"
 *     after forwarding the tx;
 *   - the innermost JSON-RPC code must be one a node uses for a refusal (3, 4001, -32000,
 *     -32003). No code at all is ambiguous: viem turns a -32603 into a code-less
 *     ContractFunctionRevertedError, so its message alone proves nothing.
 *   - any refusal, including a user rejection (4001), counts only on one of viem's own
 *     single-endpoint transports (http / webSocket / ipc). Behind `fallback` the caller sees the
 *     LAST endpoint's error: an earlier one may have accepted the tx and then failed (503) before
 *     a second endpoint refused it — or before the user rejected a retry. A `custom` (EIP-1193)
 *     transport can wrap any number of endpoints, and an unknown one says nothing, so both keep
 *     the slot; the caller releases it after looking the transaction up. (viem 2.43.3 sends a tx
 *     with retryCount 0 on http, and webSocket / ipc do not replay requests on reconnect. A
 *     user-supplied retrying fetchFn behind an `http` label is outside what this can see.)
 * Only the NODE's text is then matched, never a wrapper's: viem's ContractFunctionExecutionError
 * message prints the call (handleOps args, and the tx's `nonce`), so matching it would read every
 * handleOps failure as "maybe broadcast". viem carries the node's own message up the chain as
 * `details`; a plain error without it falls back to the innermost message.
 */
const PRE_BROADCAST_REJECTION = /insufficient funds|intrinsic gas too low|exceeds block gas limit|invalid sender|fee exceeds|exceeds the configured cap/i;
const MAYBE_BROADCAST = /nonce|replacement|underpriced|already|known transaction/i;
const TRANSPORT_ERROR_NAMES = new Set(['HttpRequestError', 'TimeoutError', 'WebSocketRequestError', 'SocketClosedError']);
const NODE_REFUSAL_CODES = new Set([-32000, -32003]);
const SINGLE_ENDPOINT_TRANSPORTS = new Set(['http', 'webSocket', 'ipc']);

function isExplicitTxRejection(err: unknown, transportType: unknown): boolean {
    const chain: any[] = [];
    for (let e: any = err; e && typeof e === 'object' && chain.length < 16; e = e.cause) chain.push(e);
    if (chain.some((e) => TRANSPORT_ERROR_NAMES.has(e.name) || typeof e.status === 'number')) return false;
    const root = chain[chain.length - 1];
    const code = [...chain].reverse().find((e) => typeof e.code === 'number')?.code;
    const details = chain.map((e) => e.details).find((d) => typeof d === 'string' && d.length > 0);
    const text = String(details ?? root?.message ?? '');
    if (MAYBE_BROADCAST.test(text)) return false;
    if (typeof transportType !== 'string' || !SINGLE_ENDPOINT_TRANSPORTS.has(transportType)) return false;
    if (code === 3 || code === 4001) return true;
    return NODE_REFUSAL_CODES.has(code) && PRE_BROADCAST_REJECTION.test(text);
}

/** Per-call handle on the SuperPaymaster 5.5.0 in-flight reservation (see submitGaslessUserOperation). */
type InflightGuardControl = {
    release?: () => void;
    /** Confirms THIS reservation only (bound to its symbol and nonce). */
    record?: (userOpHash?: string) => void;
    inSend?: boolean;
};

/** viem normalises to 'success' | 'reverted'; a stub or a raw RPC client may still hand back 0 / 1. */
function receiptReverted(status: unknown): boolean {
    return status === 'reverted' || status === 0 || status === 0n || status === '0x0' || status === '0x00';
}
function receiptSucceeded(status: unknown): boolean {
    return status === 'success' || status === 1 || status === 1n || status === '0x1' || status === '0x01';
}

/**
 * viem's waitForTransactionReceipt follows a replacement and resolves THAT receipt
 * (and reports the reason via onReplaced). `repriced` is the same calldata.
 * `replaced` only means the calldata changed — a different beneficiary can still
 * execute this UserOp, so the caller checks the mined receipt's UserOperationEvent.
 * `cancelled` is viem's name for any zero-value self-send, whatever its calldata: an
 * EIP-7702 wallet can wrap handleOps in one, so it gets the same event check.
 */
function directHandleOpsOutcome(
    submitted: `0x${string}`,
    receipt: { transactionHash?: `0x${string}` },
    replacement?: { reason?: string; transaction?: { hash?: `0x${string}` } },
): { accept: true; hash: `0x${string}` } | { accept: false; reason: string; hash: `0x${string}` } {
    const mined = (replacement?.transaction?.hash ?? receipt.transactionHash ?? submitted) as `0x${string}`;
    const reason = replacement?.reason;
    if (reason === 'repriced') return { accept: true, hash: mined };
    const same = mined.toLowerCase() === submitted.toLowerCase();
    if (reason === 'cancelled' || reason === 'replaced' || !same) {
        const why = reason === 'cancelled' || reason === 'replaced' ? reason : 'replaced';
        return { accept: false, reason: why, hash: mined };
    }
    return { accept: true, hash: submitted };
}

/**
 * UserOperationEvent for `userOpHash` emitted by `entryPoint` on this receipt.
 * `success` is the op's own flag (handleOps can mine successfully while the op failed).
 */
function userOperationEvent(
    receipt: { logs?: readonly { address?: string; topics?: readonly Hex[]; data?: Hex }[] },
    entryPoint: Address,
    userOpHash: Hex,
): { success: boolean } | undefined {
    for (const log of receipt.logs ?? []) {
        if (log.address?.toLowerCase() !== entryPoint.toLowerCase()) continue;
        if (!log.topics || log.topics.length < 2) continue;
        if (log.topics[1]?.toLowerCase() !== userOpHash.toLowerCase()) continue;
        try {
            const decoded = decodeEventLog({
                abi: EntryPointABI,
                data: log.data ?? '0x',
                topics: log.topics as [Hex, ...Hex[]],
            }) as { eventName?: string; args?: unknown };
            if (decoded.eventName !== 'UserOperationEvent') continue;
            const success = (decoded.args as { success?: boolean }).success;
            if (typeof success !== 'boolean') continue;
            return { success };
        } catch {
            continue;
        }
    }
    return undefined;
}

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

    /**
     * Sign a UserOp hash for the EntryPoint.
     *
     * airaccount-contract v0.20.0 `_validateSignature` routes on `signature[0]` as an algId
     * prefix BEFORE the raw-65-byte fallback. A raw 65-byte ECDSA sig whose first byte happens
     * to equal an algId const (e.g. `0x02` = ALG_ECDSA) is misrouted → intermittent AA24.
     * For v0.20.0 AirAccounts pass `airAccountSig: true` to emit the deterministic algId-prefixed
     * `[0x02][r][s][v]` (66-byte) format (matches `auth/hardware/ledger.ts`). Default is the raw
     * 65-byte form — unchanged for SimpleAccount and other account types.
     */
    private static async signUserOpHash(
        wallet: any,
        userOpHash: `0x${string}`,
        airAccountSig?: boolean
    ): Promise<`0x${string}`> {
        const raw = (await wallet.account.signMessage({ message: { raw: userOpHash } })) as `0x${string}`;
        return airAccountSig ? (`0x02${raw.slice(2)}` as `0x${string}`) : raw;
    }

    /**
     * Estimation signature: r = 0xff…f0…0, s = 0x7aa…a (low half), v = 28. ecrecover yields SOME
     * address for any hash, so the account runs its whole ECDSA check and returns
     * SIG_VALIDATION_FAILED instead of reverting (OpenZeppelin ECDSA.recover reverts only on an
     * unrecoverable or high-s signature). Same length and algId prefix as signUserOpHash's output.
     */
    static dummySignature(airAccountSig?: boolean): `0x${string}` {
        const raw = 'ff'.repeat(15) + 'f0' + '00'.repeat(16) + '7a' + 'aa'.repeat(31) + '1c';
        return (`0x${airAccountSig ? '02' : ''}${raw}`) as `0x${string}`;
    }

    /** 5.5.0 and flags left to the SDK: SP_RENEW is decided per op (decideSuperPaymasterSpRenew). */
    private static autoRenewApplies(
        sp: SuperPaymasterSponsorshipContext,
        options: { superPaymasterFlags?: number; superPaymasterAutoRenew?: boolean }
    ): boolean {
        return sp.generation === 'v5.5' && options.superPaymasterFlags === undefined && options.superPaymasterAutoRenew !== false;
    }

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
    /**
     * The bundler's estimate for one op, all five limits (unscaled). Throws when the bundler leaves a limit out or returns a
     * sentinel (≤ 1); against an endpoint without eth_estimateUserOperationGas it returns the old local defaults.
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
        options?: EstimateGasOptions
    ): Promise<GasEstimate> {
        const { fields, fallback } = await PaymasterClient.estimateUserOperationGasDetailed(
            client, wallet, aaAddress, entryPoint, paymasterAddress, token, bundlerUrl, callData, options);
        const missing = (Object.keys(LOCAL_DEFAULT_LIMITS) as (keyof GasEstimate)[]).filter((k) => fields[k] === undefined);
        if (missing.length > 0 && !fallback) throw new Error(`Estimation Error: the bundler returned no usable ${missing.join(', ')}`);
        return fields as GasEstimate;
    }

    /**
     * What the bundler estimated: a field is absent when the bundler left it out or answered a sentinel (≤ 1, e.g. a postOp it
     * did not simulate). `fallback`: the endpoint has no eth_estimateUserOperationGas and the fields are local defaults, not
     * an estimate.
     */
    private static async estimateUserOperationGasDetailed(
        client: any,
        wallet: any,
        aaAddress: Address,
        entryPoint: Address,
        paymasterAddress: Address,
        token: Address,
        bundlerUrl: string,
        callData: `0x${string}`,
        options?: EstimateGasOptions
    ): Promise<{ fields: Partial<GasEstimate>; fallback: boolean }> {
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
        let estSp: { ctx: SuperPaymasterSponsorshipContext; pmVerificationGas: bigint; pmPostOpGas: bigint } | undefined;
        
        if (options?.operator) {
             // Always carry the operator's token: REQUIRED by 5.5.0, ignored by 5.4.2 (see
             // @aastar/core encodeSuperPaymasterData). Estimating with a 104-byte layout against
             // 5.5.0 would sigFail and produce no estimate at all.
             const sp = options.sponsorship ?? await resolveSuperPaymasterSponsorship(client, paymasterAddress, options.operator);
             estSp = { ctx: sp, pmVerificationGas: atLeast(300000n, sp.verificationGasFloor), pmPostOpGas: atLeast(300000n, sp.minPostOpGas) };
             paymasterAndData = buildSuperPaymasterData(paymasterAddress, options.operator, {
                verificationGasLimit: estSp.pmVerificationGas,
                postOpGasLimit: estSp.pmPostOpGas,
                token: sp.token,
                flags: options.superPaymasterFlags
             });
        } else {
                     paymasterAndData = buildPaymasterData(paymasterAddress, token, {
                validityWindow: options?.validityWindow,
                verificationGasLimit: 250000n, 
                postOpGasLimit: 150000n        
            });
        }

        // 1.5. Fees for the estimation op: from the chain (eth_feeHistory), same rule as the submitted op.
        const { maxFeePerGas, maxPriorityFeePerGas } = await resolveUserOpFees(
            client, { maxFeePerGas: options?.maxFeePerGas, maxPriorityFeePerGas: options?.maxPriorityFeePerGas }, options?.feePolicy);

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

        // Submit passes the nonce it already reconciled. A second account getNonce()
        // can disagree with EntryPoint.getNonce(sender, key) and the bundler then
        // rejects the estimate (AA25) while the signed op uses the other value.
        if (options?.nonce !== undefined) {
            partialUserOp.nonce = BigInt(options.nonce);
        } else {
            try {
                const nonce = await client.readContract({
                    address: aaAddress,
                    abi: parseAbi(['function getNonce() view returns (uint256)']),
                    functionName: 'getNonce'
                });
                partialUserOp.nonce = BigInt(nonce);
            } catch (e) {}
        }

        partialUserOp.preVerificationGas = (PaymasterClient.estimatePreVerificationGasV07(partialUserOp) * 120n) / 100n + 5000n;

        // A user whose auto allowance is used up only passes 5.5.0 validation with SP_RENEW, so the
        // estimation op needs the same decision (for its own, larger, limits) or it gets no estimate.
        if (estSp && options?.operator && PaymasterClient.autoRenewApplies(estSp.ctx, options)) {
            const d = await decideSuperPaymasterSpRenew(client, {
                superPaymaster: paymasterAddress, token: estSp.ctx.token, user: aaAddress,
                maxCost: userOpMaxCostV07({
                    verificationGasLimit: 250000n, callGasLimit: 500000n,
                    paymasterVerificationGasLimit: estSp.pmVerificationGas, paymasterPostOpGasLimit: estSp.pmPostOpGas,
                    preVerificationGas: partialUserOp.preVerificationGas, maxFeePerGas,
                }),
            });
            if (d.spRenew) {
                // Same length as the flags-0 layout, so preVerificationGas above still holds.
                partialUserOp.paymasterAndData = buildSuperPaymasterData(paymasterAddress, options.operator, {
                    verificationGasLimit: estSp.pmVerificationGas, postOpGasLimit: estSp.pmPostOpGas,
                    token: estSp.ctx.token, flags: SUPER_PAYMASTER_FLAGS.SP_RENEW,
                });
            }
        }

        // Estimation never asks the signer: a dummy in the shape of the real signature. The
        // account rejects it (returns SIG_VALIDATION_FAILED; AirAccount and SimpleAccount never
        // revert on a recoverable, low-s signature), the bundler still simulates the full
        // validation and execution, and the op it receives can never be executed.
        partialUserOp.signature = PaymasterClient.dummySignature(options?.airAccountSig);

        const payload = {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_estimateUserOperationGas',
            params: [formatUserOpV07(partialUserOp), entryPoint]
        };

        // The payload carries only the dummy signature, so a lost answer is not ambiguous: the
        // bundler cannot hold an executable op from it.
        const response = await fetch(bundlerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload, (_, v) => typeof v === 'bigint' ? '0x' + v.toString(16) : v)
        });

        const result = await response.json();
        assertJsonRpcAnswer(result, 'eth_estimateUserOperationGas');
        
        // Debug logging for Candide.
        if (bundlerUrl.includes('candide')) {
            console.log('[PaymasterClient] Candide Response:', JSON.stringify(result, null, 2));
        }

        const data = result.result;

        // Debug logging for estimation
        console.log('[PaymasterClient] Gas Estimation Result:', JSON.stringify(data, null, 2));

        // -32503 is a definitive rejection (not valid yet / expires shortly). Do not substitute
        // Anvil defaults and do not retry — the caller decides whether to wait.
        if (result.error) {
            const notYet = userOperationNotYetValidFromRpc(result.error);
            if (notYet) throw notYet;
        }

        // Anvil Fallback for Estimation
        if (result.error && (result.error.code === -32601 || result.error.message?.includes('Method not found'))) {
             console.log('[PaymasterClient] EstimateUserOp failed (Method not found). Using local defaults (not an estimate).');
             return { fallback: true, fields: { ...LOCAL_DEFAULT_LIMITS, preVerificationGas: partialUserOp.preVerificationGas } };
        }

        if (result.error) throw new Error(`Estimation Error: ${JSON.stringify(result.error)}`);
        
        // The bundler's own estimate, unscaled: submitGaslessUserOperation applies the coefficient and the contract floors in
        // one place. A field left out, or answered with a sentinel (≤ 1, e.g. a postOp the bundler did not simulate), is not
        // an estimate: it is left absent so the caller's explicit value, or a refusal, decides it.
        const fields: Partial<GasEstimate> = {};
        for (const k of Object.keys(LOCAL_DEFAULT_LIMITS) as (keyof GasEstimate)[]) {
            const v = data?.[k];
            if (v === undefined || v === null) continue;
            const n = BigInt(v);
            if (n > 1n) fields[k] = n;
        }
        return { fields, fallback: false };
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
        options?: SubmitGaslessOptions
    ): Promise<`0x${string}`> {
        // The 5.5.0 single-in-flight slot is reserved synchronously before the first await that
        // follows the check, so concurrent calls for one sender cannot both pass. An explicit
        // failure (anything thrown outside the bundler round-trip, including a JSON-RPC error)
        // releases it. Estimation uses a dummy signature, so a lost estimate is not an in-flight
        // op and releases too. A transport error DURING eth_sendUserOperation (or a handleOps
        // broadcast whose receipt never arrives) is ambiguous — the bundler or node may hold the
        // op — so the slot stays until a later submit sees EntryPoint.getNonce(sender, key) move
        // past it. release() only with evidence the op can no longer execute (the sender nonce
        // advanced, or the op was replaced or its validity window passed per chain time).
        const guard: InflightGuardControl = {};
        try {
            return await PaymasterClient.submitGaslessUserOperationGuarded(
                client, wallet, aaAddress, entryPoint, paymasterAddress, token, bundlerUrl, callData, options, guard
            );
        } catch (e) {
            if (guard.inSend) {
                console.warn('[PaymasterClient] bundler round-trip failed ambiguously; keeping the SuperPaymaster in-flight slot until EntryPoint.getNonce(sender, key) moves past it. SuperPaymasterInflightGuard.release only with evidence the op can no longer execute (the sender nonce advanced, or the op was replaced or its validity window passed per chain time)');
            } else {
                guard.release?.();
            }
            throw e;
        }
    }

    private static async submitGaslessUserOperationGuarded(
        client: any,
        wallet: any,
        aaAddress: Address,
        entryPoint: Address,
        paymasterAddress: Address,
        token: Address,
        bundlerUrl: string,
        callData: `0x${string}`,
        options: SubmitGaslessOptions | undefined,
        guard: InflightGuardControl
    ): Promise<`0x${string}`> {
        // 0. Nonce, SuperPaymaster context and the 5.5.0 in-flight reservation — all before the
        // first signature (see the reservation comment).
        let nonce = BigInt(await client.readContract({
            address: aaAddress,
            abi: parseAbi(['function getNonce() view returns (uint256)']),
            functionName: 'getNonce'
        }));
        let spCtx: SuperPaymasterSponsorshipContext | undefined;
        const chainIdForGuard = client.chain?.id ?? (await client.getChainId());
        if (options?.operator) {
            spCtx = await resolveSuperPaymasterSponsorship(client, paymasterAddress, options.operator);
            // Both generations sigFail (AA34, no reason) for an unconfigured/paused operator —
            // say so here instead of after a signed round-trip to the bundler.
            if (!spCtx.isConfigured || spCtx.isPaused) {
                throw new Error(`SuperPaymaster ${spCtx.version}: operator ${options.operator} is ${spCtx.isConfigured ? 'paused' : 'not configured'}; the op would be rejected (AA34).`);
            }
            const zero = '0x0000000000000000000000000000000000000000';
            if (token && token.toLowerCase() !== zero && token.toLowerCase() !== spCtx.token.toLowerCase()) {
                // The SP gas token is the operator's configured xPNTs token, never a per-call choice.
                console.warn(`[PaymasterClient] token ${token} ignored for SuperPaymaster; using operators(${options.operator}).xPNTsToken = ${spCtx.token}`);
            }
            if (spCtx.generation === 'v5.5') {
                // Spec §3.2 F1: one in-flight sponsored op per sender. Reserved before the signature,
                // so a caller that loses this race signs nothing. (Estimation below uses a dummy
                // signature and asks the signer nothing.)
                // An existing hold — confirmed or not — is reconciled by the same nonce check.
                // The key is the high 192 bits of the held nonce (EntryPoint.getNonce(sender, key)).
                // The read is awaited, so the hold can be released and replaced before it returns.
                // reserve() may clear only that same reservation, and only for this key's sequence.
                const observed = SuperPaymasterInflightGuard.hold(chainIdForGuard, entryPoint, aaAddress);
                if (observed) {
                    nonce = BigInt(await client.readContract({
                        address: entryPoint,
                        abi: EntryPointABI,
                        functionName: 'getNonce',
                        args: [aaAddress, observed.nonce >> 64n],
                    }));
                }
                const hold = SuperPaymasterInflightGuard.reserve(chainIdForGuard, entryPoint, aaAddress, nonce, observed);
                guard.release = hold;
                guard.record = hold.record;
            }
        }

        // 1. Limits: frozen (used as given), or the bundler's estimate × coefficient. Explicit per-field
        // options and tuneEstimate still win over the scaled estimate.
        const coefficientBps = options?.gasLimitCoefficientBps ?? DEFAULT_GAS_LIMIT_COEFFICIENT_BPS;
        const frozen = options?.frozenGas;
        let rawEstimate: GasEstimate | undefined;
        const FIELDS = ['preVerificationGas', 'verificationGasLimit', 'callGasLimit', 'paymasterVerificationGasLimit', 'paymasterPostOpGasLimit'] as const;
        type Field = typeof FIELDS[number];
        // Where each sent limit came from, reported to onGasDecided (a collector must not record "estimate" for a default).
        const limitSources: Partial<Record<Field, LimitSource>> = {};
        let gasLimits: Partial<Record<Field, bigint>> = {};
        if (frozen) {
            for (const k of FIELDS) {
                const v = (frozen as any)[k];
                if (typeof v !== 'bigint' || v <= 0n || v >= 1n << 128n) throw new Error(`frozenGas.${k} must be a positive bigint below 2^128 (all five limits are required)`);
                gasLimits[k] = v;
                limitSources[k] = 'frozen';
            }
        } else {
            for (const k of FIELDS) {
                const v = options?.[k];
                if (v !== undefined) { gasLimits[k] = v; limitSources[k] = 'explicit'; }
            }
        }

        // Estimate whenever a limit is still missing (unless estimation is switched off); fill only the missing ones.
        if (!frozen && options?.autoEstimate !== false && FIELDS.some((k) => gasLimits[k] === undefined)) {
            const { fields: est, fallback } = await this.estimateUserOperationGasDetailed(
                client, wallet, aaAddress, entryPoint, paymasterAddress, token, bundlerUrl, callData,
                {
                    validityWindow: options?.validityWindow,
                    operator: options?.operator,
                    factory: options?.factory,
                    factoryData: options?.factoryData,
                    airAccountSig: options?.airAccountSig, // forward so the estimation dummy has the same format (#115 H-1)
                    superPaymasterFlags: options?.superPaymasterFlags,
                    superPaymasterAutoRenew: options?.superPaymasterAutoRenew,
                    sponsorship: spCtx, // one op, one resolve — do not re-read across a 5.4.2→5.5.0 upgrade
                    nonce,
                    maxFeePerGas: options?.maxFeePerGas,
                    maxPriorityFeePerGas: options?.maxPriorityFeePerGas,
                    feePolicy: options?.feePolicy,
                }
            );
            // A fallback (no estimation endpoint) yields local defaults: used as they are and labelled 'default'.
            if (!fallback) rawEstimate = FIELDS.every((k) => est[k] !== undefined) ? est as GasEstimate : undefined;
            if (options?.tuneEstimate && !fallback && !rawEstimate) {
                // tuneEstimate is defined over a complete estimate; do not run it on a partial one, and do not skip it silently.
                throw new Error(`tuneEstimate needs a complete estimate, but the bundler returned no usable ${FIELDS.filter((k) => est[k] === undefined).join(', ')}`);
            }
            const tuned = !fallback && rawEstimate ? (options?.tuneEstimate?.(rawEstimate) ?? {}) : {};
            for (const k of FIELDS) {
                if (gasLimits[k] !== undefined) continue;
                if (tuned[k] !== undefined) { gasLimits[k] = tuned[k]; limitSources[k] = 'tuned'; continue; }
                const v = est[k];
                if (v === undefined) continue; // not estimated: a contract floor, or a refusal below, decides it
                if (fallback) { gasLimits[k] = v; limitSources[k] = k === 'preVerificationGas' ? 'computed' : 'default'; }
                else { gasLimits[k] = scaleLimits({ ...LOCAL_DEFAULT_LIMITS, [k]: v } as GasEstimate, coefficientBps)[k]; limitSources[k] = 'estimate'; }
            }
            if (!fallback) {
                const unestimated = FIELDS.filter((k) => gasLimits[k] === undefined);
                // postOp: SuperPaymaster's has a contract floor read from the chain; a V4 paymaster's gets a labelled
                // default (V4_DEFAULT_POSTOP_GAS, never a scaled sentinel) — bundlers such as Alchemy do not estimate it.
                // Anything else needs a value.
                const coveredByFloor = (k: Field) => k === 'paymasterPostOpGasLimit';
                // preVerificationGas too: the SDK's local calculation has no L1 data fee, so it is not a stand-in for an L2 estimate.
                const refuse = unestimated.filter((k) => !coveredByFloor(k));
                if (refuse.length > 0) {
                    throw new Error(`Estimation Error: the bundler returned no usable ${refuse.join(', ')}; pass ${refuse.length > 1 ? 'them' : 'it'} explicitly`);
                }
            }
        }

        // 1.5 Fees: caller's values, otherwise from the chain (eth_feeHistory). No per-chain floor.
        const fees = await resolveUserOpFees(
            client, { maxFeePerGas: options?.maxFeePerGas, maxPriorityFeePerGas: options?.maxPriorityFeePerGas }, options?.feePolicy);
        const { maxFeePerGas, maxPriorityFeePerGas } = fees;
        console.log(`[PaymasterClient] Fees (${fees.source}): priority=${maxPriorityFeePerGas} maxFee=${maxFeePerGas}`);

        // 2. Build paymasterAndData
        let paymasterAndData: Hex;
        const floors: GasDecision['floors'] = {};
        if (options?.operator && spCtx) {
            // Contract floors read from the chain only ever RAISE an estimated limit. postOp:
            // minPostOpGas (both generations; never trust a bundler estimate for it, spec §3.2).
            // A frozen limit below a floor is refused instead: raising it would change actualGas.
            floors.paymasterPostOpGasLimit = spCtx.minPostOpGas;
            if (options?.superPaymasterVerificationGasFloor !== undefined) floors.paymasterVerificationGasLimit = options.superPaymasterVerificationGasFloor;
            if (frozen) {
                if (frozen.paymasterPostOpGasLimit < spCtx.minPostOpGas) {
                    throw new Error(`frozenGas.paymasterPostOpGasLimit ${frozen.paymasterPostOpGasLimit} is below SuperPaymaster ${spCtx.version} minPostOpGas ${spCtx.minPostOpGas} (validation would fail)`);
                }
                if (floors.paymasterVerificationGasLimit !== undefined && frozen.paymasterVerificationGasLimit < floors.paymasterVerificationGasLimit) {
                    throw new Error(`frozenGas.paymasterVerificationGasLimit ${frozen.paymasterVerificationGasLimit} is below superPaymasterVerificationGasFloor ${floors.paymasterVerificationGasLimit}`);
                }
            } else {
                const raise = (k: 'paymasterPostOpGasLimit' | 'paymasterVerificationGasLimit', floor: bigint, fallback: bigint) => {
                    const cur = gasLimits[k];
                    if (cur === undefined) { gasLimits[k] = atLeast(fallback, floor); limitSources[k] = floor > fallback ? 'floor' : 'default'; }
                    else if (cur < floor) { gasLimits[k] = floor; limitSources[k] = 'floor'; }
                };
                raise('paymasterPostOpGasLimit', spCtx.minPostOpGas, 0n);
                raise('paymasterVerificationGasLimit', floors.paymasterVerificationGasLimit ?? 0n, gasLimits.verificationGasLimit ?? 150000n);
            }
            paymasterAndData = buildSuperPaymasterData(paymasterAddress, options.operator, {
                verificationGasLimit: gasLimits.paymasterVerificationGasLimit,
                postOpGasLimit: gasLimits.paymasterPostOpGasLimit,
                token: spCtx.token,
                flags: options?.superPaymasterFlags
            });
        } else {
            // MATH: Target Efficiency = PVG / (PVG + VGL + PMVGL) >= 0.4
            // Since PVG is ~100k, (VGL + PMVGL) must be <= 150k.
            // We set each to 75k to safely pass the 0.4 efficiency guard.
            if (gasLimits.paymasterVerificationGasLimit === undefined) { gasLimits.paymasterVerificationGasLimit = 75000n; limitSources.paymasterVerificationGasLimit = 'default'; }
            if (gasLimits.paymasterPostOpGasLimit === undefined) { gasLimits.paymasterPostOpGasLimit = V4_DEFAULT_POSTOP_GAS; limitSources.paymasterPostOpGasLimit = 'default'; }

            paymasterAndData = buildPaymasterData(paymasterAddress, token, {
                validityWindow: options?.validityWindow,
                verificationGasLimit: gasLimits.paymasterVerificationGasLimit,
                postOpGasLimit: gasLimits.paymasterPostOpGasLimit
            });
        }

        // 3. Construct UserOp
        const initCode = ((options?.factory && options?.factoryData) ? concat([options.factory, options.factoryData]) : '0x') as Hex;
        if (gasLimits.verificationGasLimit === undefined) { gasLimits.verificationGasLimit = 75000n; limitSources.verificationGasLimit = 'default'; }
        if (gasLimits.callGasLimit === undefined) { gasLimits.callGasLimit = 500000n; limitSources.callGasLimit = 'default'; }
        const accountGasLimits = concat([
            pad(toHex(gasLimits.verificationGasLimit), { size: 16 }),
            pad(toHex(gasLimits.callGasLimit), { size: 16 })
        ]) as Hex;
        const gasFees = concat([
            pad(toHex(maxPriorityFeePerGas), { size: 16 }),
            pad(toHex(maxFeePerGas), { size: 16 })
        ]) as Hex;
        if (gasLimits.preVerificationGas === undefined) limitSources.preVerificationGas = 'computed';
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


        // 3.5 SP 5.5.0 inline renewal: decided for THIS op's limits and fee, and again before every
        // re-sign below (a fee or preVerificationGas bump raises maxCost, hence a0).
        const autoRenew = !!(options?.operator && spCtx && PaymasterClient.autoRenewApplies(spCtx, options));
        const refreshSpRenew = async () => {
            if (!autoRenew || !options?.operator || !spCtx) return;
            const d = await decideSuperPaymasterSpRenew(client, {
                superPaymaster: paymasterAddress, token: spCtx.token, user: aaAddress,
                maxCost: userOpMaxCostV07({
                    verificationGasLimit: BigInt('0x' + userOp.accountGasLimits.slice(2, 34)),
                    callGasLimit: BigInt('0x' + userOp.accountGasLimits.slice(34)),
                    paymasterVerificationGasLimit: gasLimits.paymasterVerificationGasLimit!,
                    paymasterPostOpGasLimit: gasLimits.paymasterPostOpGasLimit!,
                    preVerificationGas: BigInt(userOp.preVerificationGas),
                    maxFeePerGas: BigInt('0x' + userOp.gasFees.slice(34)),
                }),
            });
            if (d.spRenew) console.log(`[PaymasterClient] SP_RENEW set: ${d.reason} (a0=${d.a0})`);
            userOp.paymasterAndData = buildSuperPaymasterData(paymasterAddress, options.operator, {
                verificationGasLimit: gasLimits.paymasterVerificationGasLimit!,
                postOpGasLimit: gasLimits.paymasterPostOpGasLimit!,
                token: spCtx.token,
                flags: d.spRenew ? SUPER_PAYMASTER_FLAGS.SP_RENEW : 0
            });
        };
        const resign = async () => {
            await refreshSpRenew();
            const h = getUserOpHashV07(userOp, entryPoint, BigInt(client.chain.id));
            userOp.signature = await PaymasterClient.signUserOpHash(wallet, h, options?.airAccountSig);
        };

        // What was decided, read back from the op actually sent (fees may have been raised by a bundler's
        // explicit requirement in the retry loop below).
        const initialGasFees = userOp.gasFees;
        // Fees the caller gave are a price limit: the retry loop below never raises an explicit field (per field).
        const callerPriority = options?.maxPriorityFeePerGas !== undefined;
        const callerMaxFee = options?.maxFeePerGas !== undefined;
        const reportGas = () => {
            if (!options?.onGasDecided) return;
            const pmd = userOp.paymasterAndData;
            const sources = limitSources as Record<keyof UserOpGasLimits, LimitSource>;
            const all = Object.values(sources);
            const decision: GasDecision = {
                limits: {
                    preVerificationGas: BigInt(userOp.preVerificationGas),
                    verificationGasLimit: BigInt('0x' + userOp.accountGasLimits.slice(2, 34)),
                    callGasLimit: BigInt('0x' + userOp.accountGasLimits.slice(34)),
                    paymasterVerificationGasLimit: BigInt('0x' + pmd.slice(42, 74)),
                    paymasterPostOpGasLimit: BigInt('0x' + pmd.slice(74, 106)),
                },
                limitSources: sources,
                fees: {
                    ...fees,
                    maxPriorityFeePerGas: BigInt('0x' + userOp.gasFees.slice(2, 34)),
                    maxFeePerGas: BigInt('0x' + userOp.gasFees.slice(34)),
                },
                feesRaisedByBundler: userOp.gasFees !== initialGasFees,
                limitsSource: frozen ? 'frozen' : all.every((x) => x === 'estimate' || x === 'floor') ? 'estimate' : 'mixed',
                coefficientBps: all.includes('estimate') ? coefficientBps : undefined,
                estimate: rawEstimate,
                floors,
            };
            // An observer must not change the outcome: the op is already accepted (and its in-flight slot recorded)
            // when this runs, so a throwing callback is reported and swallowed rather than turned into a failure.
            try { options.onGasDecided(decision); } catch (e) {
                console.warn(`[PaymasterClient] onGasDecided threw (${(e as Error)?.message ?? e}); the op was submitted and its result stands`);
            }
        };

        // 4. Final Hashing and Signing
        await resign();


        // 6. Submit to Bundler (Unified JSON-RPC)
        const bundlerType = detectBundlerType(bundlerUrl);
        console.log(`[PaymasterClient] Using ${bundlerType} Bundler`);
        
        // Retry Loop: Up to 4 retries for compound errors (PVG + fee bump + replacement)
        for (let attempt = 0; attempt < 5; attempt++) {
            // Use standard JSON-RPC for all bundlers (Pimlico/Alchemy/Stackup/etc)
            guard.inSend = true;
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
            assertJsonRpcAnswer(result, 'eth_sendUserOperation');
            guard.inSend = false;

            // -32503 (not valid yet / expires shortly) is not a fee or gas problem. Thrown after
            // inSend is cleared so the 5.5.0 slot is released, and before the retry loop so we
            // neither bump fees nor fall through to handleOps. No sleep.
            if (result.error) {
                const notYet = userOperationNotYetValidFromRpc(result.error);
                if (notYet) throw notYet;
            }

            // 7. Error Handling & Retry Logic (Fee Bump)
            if (result.error && attempt < 4) {
                const msg = result.error.message || '';
                const errData = result.error.data || {};
                
                // Case A: Replacement Underpriced (Nonce collision in mempool)
                // e.g. {"code":-32602,"message":"replacement underpriced","data":{"currentMaxPriorityFee":"0x5f5e100","currentMaxFee":"0xf6a44be"}}
                if (/replacement/i.test(msg)) {
                     console.log(`[PaymasterClient] ⚠️  Replacement Underpriced. Raising fees to replace the pending UserOp...`);
                     const curPriority = userOp.gasFees ? BigInt('0x' + userOp.gasFees.slice(2, 34)) : 0n;
                     const curMax = userOp.gasFees ? BigInt('0x' + userOp.gasFees.slice(34)) : 0n;
                     // What the replacement needs, per field: 10% over the pending op's fees when the bundler names them
                     // (Alchemy/Pimlico), else 15% over this op's.
                     // A null / absent pair is "not named" (the 15% path); a named value that is not a number is a bundler error.
                     const named = errData.currentMaxPriorityFee != null && errData.currentMaxFee != null;
                     const feeOf = (v: unknown, field: string): bigint => {
                         try { return BigInt(v as any); }
                         catch { throw new Error(`Bundler Error: replacement underpriced with an unreadable ${field} ${JSON.stringify(v)}: ${JSON.stringify(result.error)}`); }
                     };
                     const needPriority = named ? (feeOf(errData.currentMaxPriorityFee, 'currentMaxPriorityFee') * 110n) / 100n : (curPriority * 115n) / 100n;
                     const needMax = named ? (feeOf(errData.currentMaxFee, 'currentMaxFee') * 110n) / 100n : (curMax * 115n) / 100n;
                     const refuseRaise = (field: string) => {
                         throw new Error(`Bundler Error: ${JSON.stringify(result.error)} (${field} was given by the caller and is not raised)`);
                     };
                     // An explicit field that already meets the requirement stays; one that does not is refused.
                     let newMaxPriority = curPriority;
                     let newMaxFee = curMax;
                     if (curPriority < needPriority) { if (callerPriority) refuseRaise('maxPriorityFeePerGas'); newMaxPriority = needPriority; }
                     if (curMax < needMax) { if (callerMaxFee) refuseRaise('maxFeePerGas'); newMaxFee = needMax; }
                     if (newMaxFee < newMaxPriority) { if (callerMaxFee) refuseRaise('maxFeePerGas'); newMaxFee = newMaxPriority + 1n; }

                     console.log(`   -> New Priority: ${newMaxPriority}, New MaxFee: ${newMaxFee}`);
                     
                     // Update UserOp
                     userOp.gasFees = concat([
                        pad(toHex(newMaxPriority), { size: 16 }),
                        pad(toHex(newMaxFee), { size: 16 })
                     ]) as Hex;

                     // Re-Sign
                     await resign();
                     
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
                    const refuseRaise = (field: string) => {
                        throw new Error(`Bundler Error: ${JSON.stringify(result.error)} (${field} was given by the caller and is not raised)`);
                    };

                    if (matchPriority && matchPriority[1]) {
                        const required = BigInt(matchPriority[1]);
                        if (required > newMaxPriority) {
                            if (callerPriority) refuseRaise('maxPriorityFeePerGas');
                            console.log(`   -> Bumping Priority Fee to ${required}`);
                            const delta = required - newMaxPriority;
                            newMaxPriority = required;
                            if (!callerMaxFee) newMaxFee += delta; // an explicit maxFee stays the cap
                        }
                    }

                    if (matchMaxFee && matchMaxFee[1]) {
                         const required = BigInt(matchMaxFee[1]);
                         if (required > newMaxFee) {
                            if (callerMaxFee) refuseRaise('maxFeePerGas');
                            console.log(`   -> Bumping Max Fee to ${required}`);
                            newMaxFee = required;
                         }
                    }

                    if (newMaxFee < newMaxPriority) {
                        if (callerMaxFee) refuseRaise('maxFeePerGas');
                        newMaxFee = newMaxPriority + 1n; // Minimal bump
                    }

                    // Update UserOp
                    userOp.gasFees = concat([
                        pad(toHex(newMaxPriority), { size: 16 }),
                        pad(toHex(newMaxFee), { size: 16 })
                    ]) as Hex;

                    // Re-Sign
                    await resign();
                    
                    continue; // Retry
                }

                // Case D: PreVerificationGas too low (common on L2s like Optimism)
                // e.g. "precheck failed: preVerificationGas is 57368 but must be at least 108901"
                const matchPVG = msg.match(/preVerificationGas.*(?:at least|expected) (\d+)/i);
                if (matchPVG && matchPVG[1]) {
                    const requiredPVG = BigInt(matchPVG[1]);
                    const currentPVG = BigInt(userOp.preVerificationGas);
                    
                    if (requiredPVG > currentPVG) {
                        if (frozen) {
                            // A frozen collection does not change its limits per op; the caller re-freezes.
                            throw new Error(`frozenGas.preVerificationGas ${currentPVG} is below the bundler's required ${requiredPVG}: ${msg}`);
                        }
                        console.log(`[PaymasterClient] ⚠️  PVG Error: ${msg}. Updating preVerificationGas...`);
                        
                        // Add 5% buffer to avoid "chasing" the requirement on L2s
                        const bufferedPVG = (requiredPVG * 105n) / 100n;
                        console.log(`   -> Updating PVG from ${currentPVG} to ${bufferedPVG} (inc. buffer)`);
                        
                        // Update PVG and re-sign
                        userOp.preVerificationGas = bufferedPVG;
                        limitSources.preVerificationGas = 'bundler-retry';
                        await resign();
                        
                        continue; // Retry
                    }
                }
            }

            if (result.error && (result.error.code === -32601 || result.error.message?.includes('Method not found'))) {
                 console.log('[PaymasterClient] SendUserOp failed (Method not found). Falling back to direct handleOps...');
                 
                 const caller = wallet.account?.address ? wallet.account.address : wallet.account;

                 // A broadcast whose answer is lost may still be pending on-chain, so the slot is
                 // kept unless the node EXPLICITLY refused (see isExplicitTxRejection).
                 guard.inSend = true;
                 let txHash: `0x${string}`;
                 try {
                     txHash = await wallet.writeContract({
                         address: entryPoint,
                         // Named-component ABI from @aastar/core: `userOp` is an object, and viem
                         // cannot encode an object into the unnamed tuple of a hand-written signature
                         // (it reads userOp[0]… → "Address undefined is invalid"), so this fallback
                         // never worked with the previous parseAbi string.
                         abi: EntryPointABI,
                         functionName: 'handleOps',
                         args: [[userOp], caller],
                         chain: wallet.chain,
                         account: wallet.account
                     });
                 } catch (e) {
                     if (isExplicitTxRejection(e, wallet.transport?.type)) guard.inSend = false;
                     throw e;
                 }
                 // writeContract resolves when the tx is accepted, not when it lands. A throw
                 // here leaves inSend set: the tx may still be pending. A reverted handleOps
                 // does not move the nonce, so recording the hash would pin the sender on an
                 // op that can never be included. viem follows a replacement (speed-up, cancel,
                 // or a different tx on the same nonce) and resolves that receipt. `replaced`
                 // or `cancelled` (viem's label for any zero-value self-send) still counts when
                 // the mined receipt's UserOperationEvent is this op.
                 let replacement: { reason?: string; transaction?: { hash?: `0x${string}` } } | undefined;
                 const receipt: { status?: unknown; transactionHash?: `0x${string}`; logs?: readonly { address?: string; topics?: readonly Hex[]; data?: Hex }[] } = await client.waitForTransactionReceipt({
                     hash: txHash,
                     onReplaced: (response: { reason?: string; transaction?: { hash?: `0x${string}` } }) => {
                         replacement = response;
                     },
                 });
                 let outcome = directHandleOpsOutcome(txHash, receipt, replacement);
                 if (!outcome.accept && (outcome.reason === 'replaced' || outcome.reason === 'cancelled')) {
                     const executed = userOperationEvent(receipt, entryPoint, getUserOpHashV07(userOp, entryPoint, BigInt(chainIdForGuard)));
                     if (executed?.success) {
                         outcome = { accept: true, hash: outcome.hash };
                     } else if (executed) {
                         // Included, but the op itself failed. Nonce was consumed: keep the
                         // record. The outer catch must not release it.
                         guard.inSend = false;
                         if (spCtx?.generation === 'v5.5') guard.record?.(outcome.hash);
                         guard.release = undefined;
                         throw new Error(`direct handleOps userOp failed (tx ${outcome.hash}); the op was included`);
                     }
                 }
                 if (!outcome.accept) {
                     guard.inSend = false;
                     guard.release?.();
                     throw new Error(`direct handleOps ${outcome.reason} (submitted ${txHash}, mined ${outcome.hash}); the SuperPaymaster in-flight slot was released`);
                 }
                 if (receiptReverted(receipt?.status)) {
                     guard.inSend = false;
                     guard.release?.();
                     throw new Error(`direct handleOps reverted (tx ${outcome.hash}, status ${String(receipt.status)}); the SuperPaymaster in-flight slot was released`);
                 }
                 if (!receiptSucceeded(receipt?.status)) {
                     throw new Error(`direct handleOps receipt status ${String(receipt?.status)} is not success (tx ${outcome.hash}); keeping the SuperPaymaster in-flight slot`);
                 }
                 guard.inSend = false;
                 if (spCtx?.generation === 'v5.5') guard.record?.(outcome.hash);
                 reportGas();
                 return outcome.hash;
            }

            if (result.error) throw new Error(`Bundler Error: ${JSON.stringify(result.error)}`);
            console.log('[PaymasterClient] ✅ Submitted via', bundlerType, 'hash:', result.result);
            if (spCtx?.generation === 'v5.5') guard.record?.(result.result);
            reportGas();
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
     *
     * Does not inspect `UserOperationEvent.success`. An included op whose inner call reverted
     * still comes back as a receipt (`success === false`, gas already charged). Use
     * {@link waitForUserOperationResult} to tell those apart.
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

    /**
     * Wait for inclusion and read whether THIS userOp succeeded. `success === false` is a result,
     * not a thrown timeout: the user was charged. Pass `throwOnFailure: true` to throw
     * {@link UserOperationFailedError} instead. The return shape of {@link waitForUserOperation}
     * is unchanged.
     */
    static async waitForUserOperationResult(
        bundlerClient: any,
        hash: `0x${string}`,
        options: number | WaitForUserOperationResultOptions = {}
    ): Promise<UserOperationExecutionResult> {
        const opts: WaitForUserOperationResultOptions = typeof options === 'number' ? { timeout: options } : options;
        const timeout = opts.timeout ?? 180000;
        const receipt = await bundlerClient.waitForUserOperationReceipt({ hash, timeout });
        const result = readUserOperationResult(receipt, hash, opts.entryPoint);
        if (opts.throwOnFailure && result.success === false) throw new UserOperationFailedError(result);
        return result;
    }
}
