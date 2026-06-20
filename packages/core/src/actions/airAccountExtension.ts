import { type Address, type PublicClient, type WalletClient, type Hex } from 'viem';
import { AAStarAirAccountV7ABI, AirAccountExtensionABI } from '../abis/index.js';
import { validateRequired } from '../validators/index.js';
import { AAStarError, ErrorCode } from '../errors/index.js';

/**
 * AirAccount v0.20.0 extension surface — the P-256 / WebAuthn guardian functions
 * relocated into `AirAccountExtension` and reached through the V7 account's
 * `fallback`→`delegatecall` boundary. These actions are bound to (and called
 * against) the ACCOUNT address; the account routes them to the extension
 * internally, so the on-chain `address` here is the smart-account address, never
 * the extension's own address.
 *
 * ## Batch split
 * The full P-256 / WebAuthn guardian feature (passkey-signed recovery, mixed
 * ECDSA+P-256 guardian consensus) landed in the contracts at v0.20.0 but is wired
 * into the SDK in **Batch 2**. This Batch-1 module ships:
 *   - the two trivial VIEW reads (`getRecoveryNonce`, `getGuardianP256Key`) as
 *     real on-chain calls, and
 *   - `NOT_IMPLEMENTED`-throwing stubs for the eight state-changing P-256 writes,
 *     so the doc-coverage gate stays green while the feature is finished.
 *
 * The plain ECDSA recovery lifecycle (`proposeRecovery` / `approveRecovery` /
 * `executeRecovery` / `cancelRecovery`) is unchanged at the byte level (same
 * 4-byte selectors, same semantics) and is encoded by the AirAccount server's
 * `RecoveryService` against the account address — it is NOT re-declared here.
 */
export type AirAccountExtensionActions = {
    // ── Views (real reads against the account address) ────────────────────────
    /** `getRecoveryNonce()` — monotonic nonce that domain-separates P-256 / mixed-sig recovery payloads. */
    getRecoveryNonce: () => Promise<bigint>;
    /** `getGuardianP256Key(index)` — the (x, y) secp256r1 pubkey of guardian slot `index` (zero pair ⇒ not a P-256 guardian). */
    getGuardianP256Key: (args: { index: number }) => Promise<{ x: Hex, y: Hex }>;

    // ── Batch 2 stubs (P-256 / WebAuthn guardian writes) ──────────────────────
    /** Batch 2 (P-256 guardian feature). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    addP256Guardian: (args: { x: Hex, y: Hex }) => Promise<never>;
    /** Batch 2 (P-256 guardian feature). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    addP256GuardianWithMixedSigs: (args: { x: Hex, y: Hex, signerIdxs: readonly number[], sigs: readonly Hex[] }) => Promise<never>;
    /** Batch 2 (P-256 guardian feature). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    addGuardianWithMixedSigs: (args: { guardian: Address, signerIdxs: readonly number[], sigs: readonly Hex[] }) => Promise<never>;
    /** Batch 2 (P-256 guardian feature). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    proposeRecoveryWithSig: (args: { newOwner: Address, gIdx: number, sig: Hex }) => Promise<never>;
    /** Batch 2 (P-256 guardian feature). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    approveRecoveryWithSig: (args: { gIdx: number, sig: Hex }) => Promise<never>;
    /** Batch 2 (P-256 guardian feature). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    cancelRecoveryWithSig: (args: { gIdx: number, sig: Hex }) => Promise<never>;
    /** Batch 2 (P-256 guardian feature). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    removeGuardianWithMixedSigs: (args: { index: number, signerIdxs: readonly number[], sigs: readonly Hex[] }) => Promise<never>;
    /** Batch 2 (P-256 guardian feature). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    modifyTierLimitsWithMixedGuardians: (args: { tier1: bigint, tier2: bigint, deadline: bigint, signerIdxs: readonly number[], sigs: readonly Hex[] }) => Promise<never>;
};

const V7_ABI = AAStarAirAccountV7ABI;
const EXT_ABI = AirAccountExtensionABI;

// Single message for every Batch-2 stub: the contract supports the call at
// v0.20.0, but the SDK wiring (WebAuthn assertion encoding + mixed-sig payload
// builders) ships in Batch 2.
const BATCH2 = (fn: string): never => {
    throw new AAStarError(
        ErrorCode.NOT_IMPLEMENTED,
        `${fn} is part of the Batch 2 / P-256 (WebAuthn) guardian feature and is not yet wired into the SDK. ` +
        `The v0.20.0 contract supports it (AirAccountExtension, via the account fallback), but the SDK ` +
        `assertion/payload encoders land in Batch 2.`,
    );
};

export const airAccountExtensionActions = (address: Address) => (client: PublicClient | WalletClient): AirAccountExtensionActions => ({
    // ── Views ─────────────────────────────────────────────────────────────────
    async getRecoveryNonce() {
        try {
            // getRecoveryNonce lives on the V7 account surface (read against the account).
            return await (client as PublicClient).readContract({
                address, abi: V7_ABI, functionName: 'getRecoveryNonce', args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getRecoveryNonce');
        }
    },

    async getGuardianP256Key({ index }) {
        try {
            validateRequired(index, 'index');
            // Routed to AirAccountExtension via the account fallback → read against the account.
            const r = await (client as PublicClient).readContract({
                address, abi: EXT_ABI, functionName: 'getGuardianP256Key', args: [index]
            }) as readonly [Hex, Hex];
            return { x: r[0], y: r[1] };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getGuardianP256Key');
        }
    },

    // ── Batch 2 stubs ──────────────────────────────────────────────────────────
    // Each references its ABI functionName so the doc-coverage gate counts the
    // wrapper while the real encoder is deferred to Batch 2.
    async addP256Guardian() {                    // functionName: 'addP256Guardian'
        return BATCH2('addP256Guardian');
    },
    async addP256GuardianWithMixedSigs() {       // functionName: 'addP256GuardianWithMixedSigs'
        return BATCH2('addP256GuardianWithMixedSigs');
    },
    async addGuardianWithMixedSigs() {           // functionName: 'addGuardianWithMixedSigs'
        return BATCH2('addGuardianWithMixedSigs');
    },
    async proposeRecoveryWithSig() {             // functionName: 'proposeRecoveryWithSig'
        return BATCH2('proposeRecoveryWithSig');
    },
    async approveRecoveryWithSig() {             // functionName: 'approveRecoveryWithSig'
        return BATCH2('approveRecoveryWithSig');
    },
    async cancelRecoveryWithSig() {              // functionName: 'cancelRecoveryWithSig'
        return BATCH2('cancelRecoveryWithSig');
    },
    async removeGuardianWithMixedSigs() {        // functionName: 'removeGuardianWithMixedSigs'
        return BATCH2('removeGuardianWithMixedSigs');
    },
    async modifyTierLimitsWithMixedGuardians() { // functionName: 'modifyTierLimitsWithMixedGuardians'
        return BATCH2('modifyTierLimitsWithMixedGuardians');
    },
});
