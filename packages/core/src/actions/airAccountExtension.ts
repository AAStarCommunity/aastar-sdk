import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
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
 * ## P-256 (passkey) guardian feature — fully wired (Batch 2)
 * The full P-256 / WebAuthn guardian feature (passkey-signed recovery, mixed
 * ECDSA+P-256 guardian consensus) landed in the contracts at v0.20.0 and is wired
 * end-to-end here: the two VIEW reads plus the eight state-changing writes.
 *
 * The `sig` blobs these writes consume are built by the core crypto module
 * (`@aastar/core` → `buildP256GuardianChallenge` / `encodeWebAuthnAssertion` /
 * `signP256GuardianAssertion` in `crypto/p256Guardian.ts`). This action layer is the
 * thin calldata wrapper; the security-critical encoding lives in that module and is
 * decode-verified against a live Sepolia tx (see `tests/regression/onchain-evidence/`).
 *
 * ## Guardian bootstrap is guardianSig-free (spec §5.1 / §9)
 * `addP256Guardian(x, y)` is **owner-only** and requires `_guardianCount < RECOVERY_THRESHOLD`
 * (a single guardian can't form a quorum), so the FIRST P-256 guardian(s) need NO guardian
 * signature — only the owner. The same holds for init-time setup via `InitConfig.guardianP256X/Y`
 * (one factory tx, no window). Once `RECOVERY_THRESHOLD` guardians exist, expansion requires
 * consensus via `addP256GuardianWithMixedSigs` / `addGuardianWithMixedSigs`.
 *
 * The plain ECDSA recovery lifecycle (`proposeRecovery` / `approveRecovery` /
 * `executeRecovery` / `cancelRecovery`) is unchanged at the byte level and is encoded by
 * the AirAccount server's `RecoveryService` against the account address — NOT re-declared here.
 */
export type AirAccountExtensionActions = {
    // ── Views (real reads against the account address) ────────────────────────
    /** `getRecoveryNonce()` — monotonic nonce that domain-separates P-256 / mixed-sig recovery payloads. */
    getRecoveryNonce: () => Promise<bigint>;
    /** `getGuardianP256Key(index)` — the (x, y) secp256r1 pubkey of guardian slot `index` (zero pair ⇒ not a P-256 guardian). */
    getGuardianP256Key: (args: { index: number }) => Promise<{ x: Hex, y: Hex }>;

    // ── P-256 / WebAuthn guardian writes (real calldata) ──────────────────────
    /** `addP256Guardian(x, y)` — owner-only bootstrap of a passkey guardian (no guardianSig while `count < threshold`). */
    addP256Guardian: (args: { x: Hex, y: Hex, account?: Account | Address, maxFeePerGas?: bigint, maxPriorityFeePerGas?: bigint }) => Promise<Hash>;
    /** `addP256GuardianWithMixedSigs(x, y, signerIdxs, sigs)` — add a passkey guardian once `count >= threshold` (consensus required). */
    addP256GuardianWithMixedSigs: (args: { x: Hex, y: Hex, signerIdxs: readonly number[], sigs: readonly Hex[], account?: Account | Address, maxFeePerGas?: bigint, maxPriorityFeePerGas?: bigint }) => Promise<Hash>;
    /** `addGuardianWithMixedSigs(guardian, signerIdxs, sigs)` — add an ECDSA guardian with mixed-type guardian consensus. */
    addGuardianWithMixedSigs: (args: { guardian: Address, signerIdxs: readonly number[], sigs: readonly Hex[], account?: Account | Address, maxFeePerGas?: bigint, maxPriorityFeePerGas?: bigint }) => Promise<Hash>;
    /** `proposeRecoveryWithSig(newOwner, gIdx, sig)` — passkey guardian proposes recovery (any relayer submits). */
    proposeRecoveryWithSig: (args: { newOwner: Address, gIdx: number, sig: Hex, account?: Account | Address, maxFeePerGas?: bigint, maxPriorityFeePerGas?: bigint }) => Promise<Hash>;
    /** `approveRecoveryWithSig(gIdx, sig)` — passkey guardian approves the active recovery proposal. */
    approveRecoveryWithSig: (args: { gIdx: number, sig: Hex, account?: Account | Address, maxFeePerGas?: bigint, maxPriorityFeePerGas?: bigint }) => Promise<Hash>;
    /** `cancelRecoveryWithSig(gIdx, sig)` — passkey guardian votes to cancel the active recovery proposal. */
    cancelRecoveryWithSig: (args: { gIdx: number, sig: Hex, account?: Account | Address, maxFeePerGas?: bigint, maxPriorityFeePerGas?: bigint }) => Promise<Hash>;
    /** `removeGuardianWithMixedSigs(index, signerIdxs, sigs)` — owner-only removal with mixed-type guardian consensus. */
    removeGuardianWithMixedSigs: (args: { index: number, signerIdxs: readonly number[], sigs: readonly Hex[], account?: Account | Address, maxFeePerGas?: bigint, maxPriorityFeePerGas?: bigint }) => Promise<Hash>;
    /** `modifyTierLimitsWithMixedGuardians(tier1, tier2, deadline, signerIdxs, sigs)` — owner-only tier change with mixed consensus. */
    modifyTierLimitsWithMixedGuardians: (args: { tier1: bigint, tier2: bigint, deadline: bigint, signerIdxs: readonly number[], sigs: readonly Hex[], account?: Account | Address, maxFeePerGas?: bigint, maxPriorityFeePerGas?: bigint }) => Promise<Hash>;
};

const V7_ABI = AAStarAirAccountV7ABI;
const EXT_ABI = AirAccountExtensionABI;

/** Spread EIP-1559 fee overrides into a write only when provided. */
function feeOverrides(maxFeePerGas?: bigint, maxPriorityFeePerGas?: bigint) {
    return {
        ...(maxFeePerGas !== undefined ? { maxFeePerGas } : {}),
        ...(maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas } : {}),
    };
}

/** Validate that signer indices and signatures line up before a mixed-sig write. */
function validateMixedSigs(signerIdxs: readonly number[], sigs: readonly Hex[]): void {
    validateRequired(signerIdxs, 'signerIdxs');
    validateRequired(sigs, 'sigs');
    if (signerIdxs.length !== sigs.length) {
        throw new AAStarError(
            ErrorCode.INVALID_PARAMETER,
            `signerIdxs (${signerIdxs.length}) and sigs (${sigs.length}) must have equal length`,
        );
    }
    if (signerIdxs.length < 2) {
        throw new AAStarError(
            ErrorCode.INVALID_PARAMETER,
            `mixed-sig guardian operations require at least RECOVERY_THRESHOLD (2) signatures, got ${signerIdxs.length}`,
        );
    }
}

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

    // ── P-256 / WebAuthn guardian writes ───────────────────────────────────────
    // Each routes to AirAccountExtension via the account's fallback → delegatecall,
    // so `address` (the account) is the write target and `functionName` is the EXT fn.
    async addP256Guardian({ x, y, account, maxFeePerGas, maxPriorityFeePerGas }) {
        try {
            validateRequired(x, 'x');
            validateRequired(y, 'y');
            return await (client as WalletClient).writeContract({
                address, abi: EXT_ABI, functionName: 'addP256Guardian', args: [x, y],
                account: account as any, chain: (client as any).chain,
                ...feeOverrides(maxFeePerGas, maxPriorityFeePerGas),
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'addP256Guardian');
        }
    },

    async addP256GuardianWithMixedSigs({ x, y, signerIdxs, sigs, account, maxFeePerGas, maxPriorityFeePerGas }) {
        try {
            validateRequired(x, 'x');
            validateRequired(y, 'y');
            validateMixedSigs(signerIdxs, sigs);
            return await (client as WalletClient).writeContract({
                address, abi: EXT_ABI, functionName: 'addP256GuardianWithMixedSigs',
                args: [x, y, signerIdxs as readonly number[], sigs as readonly Hex[]],
                account: account as any, chain: (client as any).chain,
                ...feeOverrides(maxFeePerGas, maxPriorityFeePerGas),
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'addP256GuardianWithMixedSigs');
        }
    },

    async addGuardianWithMixedSigs({ guardian, signerIdxs, sigs, account, maxFeePerGas, maxPriorityFeePerGas }) {
        try {
            validateRequired(guardian, 'guardian');
            validateMixedSigs(signerIdxs, sigs);
            return await (client as WalletClient).writeContract({
                address, abi: EXT_ABI, functionName: 'addGuardianWithMixedSigs',
                args: [guardian, signerIdxs as readonly number[], sigs as readonly Hex[]],
                account: account as any, chain: (client as any).chain,
                ...feeOverrides(maxFeePerGas, maxPriorityFeePerGas),
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'addGuardianWithMixedSigs');
        }
    },

    async proposeRecoveryWithSig({ newOwner, gIdx, sig, account, maxFeePerGas, maxPriorityFeePerGas }) {
        try {
            validateRequired(newOwner, 'newOwner');
            validateRequired(gIdx, 'gIdx');
            validateRequired(sig, 'sig');
            return await (client as WalletClient).writeContract({
                address, abi: EXT_ABI, functionName: 'proposeRecoveryWithSig', args: [newOwner, gIdx, sig],
                account: account as any, chain: (client as any).chain,
                ...feeOverrides(maxFeePerGas, maxPriorityFeePerGas),
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'proposeRecoveryWithSig');
        }
    },

    async approveRecoveryWithSig({ gIdx, sig, account, maxFeePerGas, maxPriorityFeePerGas }) {
        try {
            validateRequired(gIdx, 'gIdx');
            validateRequired(sig, 'sig');
            return await (client as WalletClient).writeContract({
                address, abi: EXT_ABI, functionName: 'approveRecoveryWithSig', args: [gIdx, sig],
                account: account as any, chain: (client as any).chain,
                ...feeOverrides(maxFeePerGas, maxPriorityFeePerGas),
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'approveRecoveryWithSig');
        }
    },

    async cancelRecoveryWithSig({ gIdx, sig, account, maxFeePerGas, maxPriorityFeePerGas }) {
        try {
            validateRequired(gIdx, 'gIdx');
            validateRequired(sig, 'sig');
            return await (client as WalletClient).writeContract({
                address, abi: EXT_ABI, functionName: 'cancelRecoveryWithSig', args: [gIdx, sig],
                account: account as any, chain: (client as any).chain,
                ...feeOverrides(maxFeePerGas, maxPriorityFeePerGas),
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'cancelRecoveryWithSig');
        }
    },

    async removeGuardianWithMixedSigs({ index, signerIdxs, sigs, account, maxFeePerGas, maxPriorityFeePerGas }) {
        try {
            validateRequired(index, 'index');
            validateMixedSigs(signerIdxs, sigs);
            return await (client as WalletClient).writeContract({
                address, abi: EXT_ABI, functionName: 'removeGuardianWithMixedSigs',
                args: [index, signerIdxs as readonly number[], sigs as readonly Hex[]],
                account: account as any, chain: (client as any).chain,
                ...feeOverrides(maxFeePerGas, maxPriorityFeePerGas),
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'removeGuardianWithMixedSigs');
        }
    },

    async modifyTierLimitsWithMixedGuardians({ tier1, tier2, deadline, signerIdxs, sigs, account, maxFeePerGas, maxPriorityFeePerGas }) {
        try {
            validateRequired(tier1, 'tier1');
            validateRequired(tier2, 'tier2');
            validateRequired(deadline, 'deadline');
            validateMixedSigs(signerIdxs, sigs);
            return await (client as WalletClient).writeContract({
                address, abi: EXT_ABI, functionName: 'modifyTierLimitsWithMixedGuardians',
                args: [tier1, tier2, deadline, signerIdxs as readonly number[], sigs as readonly Hex[]],
                account: account as any, chain: (client as any).chain,
                ...feeOverrides(maxFeePerGas, maxPriorityFeePerGas),
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'modifyTierLimitsWithMixedGuardians');
        }
    },
});
