import { type Address, type Hex } from 'viem';
import {
    buildPaymasterData as buildPaymasterDataV4,
    buildSuperPaymasterData
} from './V4/PaymasterUtils.js';

/**
 * Supported paymaster types.
 * - 'v4'    → PaymasterV4 layout (84 bytes): [paymaster(20)][verGas(16)][postGas(16)][token(20)][validUntil(6)][validAfter(6)]
 * - 'super' → SuperPaymaster layout (104 bytes): [paymaster(20)][verGas(16)][postGas(16)][operator(20)][maxRate(32)]
 */
export type PaymasterType = 'v4' | 'super';

/**
 * Unified parameters for building `paymasterAndData`.
 *
 * The byte layout differs by paymaster type; this shape carries the union of
 * both packers' inputs. `buildPaymasterData` validates that the fields required
 * for the resolved type are present, and dispatches to the correct existing
 * packer. Callers no longer need to know which format a given paymaster uses.
 */
export interface BuildPaymasterDataParams {
    /**
     * Explicit paymaster type. Preferred over address-based heuristics.
     * If omitted, the type is resolved from `paymasterAddress` against the
     * manager's registered known-paymaster map (throws if unresolved).
     */
    type?: PaymasterType;
    /** Paymaster contract address (first 20 bytes of the layout). */
    paymasterAddress: Address;
    /** Paymaster verification gas limit (16-byte field, both layouts). */
    verificationGasLimit?: bigint;
    /** Paymaster postOp gas limit (16-byte field, both layouts). */
    postOpGasLimit?: bigint;

    // ── PaymasterV4-specific fields ──
    /** Gas token address. Required for type 'v4'. */
    token?: Address;
    /** Validity window in seconds (used to compute validUntil/validAfter). 'v4' only. */
    validityWindow?: number;

    // ── SuperPaymaster-specific fields ──
    /** Operator address. Required for type 'super'. */
    operator?: Address;
    /** Optional max rate commitment (rug-pull protection). 'super' only. */
    maxRate?: bigint;
}

/**
 * PaymasterManager — unifies the per-type `paymasterAndData` packers behind a
 * single `buildPaymasterData` entry point that AUTO-SELECTS the correct byte
 * format by paymaster type.
 *
 * Type resolution order:
 *   1. Explicit `params.type` (preferred — no guessing).
 *   2. Address-based lookup against the registered known-paymaster map.
 *
 * The underlying packers (`buildPaymasterData` / `buildSuperPaymasterData` in
 * PaymasterUtils) remain exported and are reused verbatim here — this class
 * does NOT reimplement byte-packing.
 */
export class PaymasterManager {
    private readonly knownPaymasters: Map<string, PaymasterType>;

    constructor(opts?: { knownPaymasters?: Record<string, PaymasterType> }) {
        this.knownPaymasters = new Map();
        if (opts?.knownPaymasters) {
            for (const [address, type] of Object.entries(opts.knownPaymasters)) {
                this.setKnownPaymaster(address as Address, type);
            }
        }
    }

    /**
     * Register a known paymaster address → type mapping so that callers can
     * omit the explicit `type` and have it resolved from the address.
     */
    registerPaymaster(address: Address, type: PaymasterType): void {
        this.setKnownPaymaster(address, type);
    }

    /**
     * Record an address → type mapping, throwing on a CONFLICTING re-registration.
     * Silently overwriting a v4 address with `super` (or vice-versa) would later
     * pack the wrong-length paymasterData for a `type`-less call, so a conflicting
     * re-registration is treated as a programmer error. Re-registering the SAME
     * type (including a case-variant of the address) is an idempotent no-op.
     */
    private setKnownPaymaster(address: Address, type: PaymasterType): void {
        const normalized = address.toLowerCase();
        const existing = this.knownPaymasters.get(normalized);
        if (existing && existing !== type) {
            throw new Error(
                `Paymaster ${address} is already registered as '${existing}'; ` +
                `refusing to re-register as '${type}'`
            );
        }
        this.knownPaymasters.set(normalized, type);
    }

    /**
     * Resolve a paymaster's type from a registered address. Returns undefined
     * if the address is not registered.
     */
    resolveType(address: Address): PaymasterType | undefined {
        return this.knownPaymasters.get(address.toLowerCase());
    }

    /**
     * Build `paymasterAndData`, auto-selecting the correct byte layout for the
     * paymaster type. Dispatches to the existing per-type packers.
     */
    buildPaymasterData(params: BuildPaymasterDataParams): Hex {
        const type = params.type ?? this.resolveType(params.paymasterAddress);
        if (!type) {
            throw new Error(
                `PaymasterManager: cannot resolve paymaster type for ${params.paymasterAddress}. ` +
                `Pass an explicit \`type\` ('v4' | 'super') or register the address via registerPaymaster().`
            );
        }
        return PaymasterManager.dispatch(type, params);
    }

    /**
     * Static helper: build `paymasterAndData` for an explicit type without an
     * instance. Useful when the caller already knows the type.
     */
    static buildPaymasterData(type: PaymasterType, params: Omit<BuildPaymasterDataParams, 'type'>): Hex {
        return PaymasterManager.dispatch(type, params);
    }

    private static dispatch(type: PaymasterType, params: BuildPaymasterDataParams): Hex {
        switch (type) {
            case 'v4': {
                if (!params.token) {
                    throw new Error("PaymasterManager: type 'v4' requires `token`.");
                }
                return buildPaymasterDataV4(params.paymasterAddress, params.token, {
                    validityWindow: params.validityWindow,
                    verificationGasLimit: params.verificationGasLimit,
                    postOpGasLimit: params.postOpGasLimit
                });
            }
            case 'super': {
                if (!params.operator) {
                    throw new Error("PaymasterManager: type 'super' requires `operator`.");
                }
                return buildSuperPaymasterData(params.paymasterAddress, params.operator, {
                    verificationGasLimit: params.verificationGasLimit,
                    postOpGasLimit: params.postOpGasLimit,
                    maxRate: params.maxRate
                });
            }
            default: {
                // Exhaustiveness guard.
                const _never: never = type;
                throw new Error(`PaymasterManager: unsupported paymaster type '${_never}'.`);
            }
        }
    }
}
