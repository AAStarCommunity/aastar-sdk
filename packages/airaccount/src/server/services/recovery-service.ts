import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  zeroAddress,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
// AIRACCOUNT_ABI is a local human-readable `string[]` signature set (not available
// in @aastar/core), so parseAbi is required to feed it to viem's encode/read calls.
// eslint-disable-next-line no-restricted-imports
import { parseAbi } from "viem";
import { AIRACCOUNT_ABI } from "../constants/entrypoint";

/**
 * Parsed AirAccount ABI shared by the encoders and on-chain reads. Cast to the
 * loose `Abi` type so `encodeFunctionData`/`readContract` accept dynamic
 * function names and return `unknown` (mirrors the old `ethers.Interface` /
 * `ethers.Contract` dynamic surface).
 */
const AIRACCOUNT_ABI_PARSED = parseAbi(AIRACCOUNT_ABI) as Abi;

/**
 * RECOVERY_THRESHOLD — number of distinct guardian approvals required to recover
 * (or to cancel a recovery). The contract hard-codes `RECOVERY_THRESHOLD = 2`
 * against a maximum of 3 guardians, i.e. a 2-of-3 social-recovery scheme.
 *
 * Source of truth: `AAStarAirAccountBase.RECOVERY_THRESHOLD` (internal constant).
 */
export const RECOVERY_THRESHOLD = 2;

/**
 * MAX_GUARDIANS — the account stores at most 3 guardians (packed slots 12-14).
 * Source: `AAStarAirAccountBase.addGuardian` (`_guardianCount >= 3` reverts).
 */
export const MAX_GUARDIANS = 3;

/**
 * RECOVERY_TIMELOCK_SECONDS — delay between `proposeRecovery` and the earliest
 * `executeRecovery`. The contract hard-codes `RECOVERY_TIMELOCK = 2 days`
 * (172800 seconds).
 *
 * NOTE: the prose in `docs/abi/capabilities.md` says "72h"; the deployed
 * contract uses 2 days (48h). The on-chain constant is authoritative.
 *
 * Source of truth: `AAStarAirAccountBase.RECOVERY_TIMELOCK` (internal constant).
 */
export const RECOVERY_TIMELOCK_SECONDS = 2n * 24n * 60n * 60n; // 2 days

/**
 * GUARDIAN_SIG_VERSION — version byte folded into every guardian-signed challenge
 * (domain-separates signatures across contract versions). Source of truth:
 * `AAStarAirAccountBase.GUARDIAN_SIG_VERSION` (== 4 since v0.20.0).
 */
export const GUARDIAN_SIG_VERSION = 4;

/**
 * P256_GUARDIAN_SENTINEL — the address stored in a guardian slot occupied by a
 * P-256 (WebAuthn) guardian; the real secp256r1 key lives in a side mapping. For
 * a plain ECDSA guardian the slot stores the guardian's own EOA address instead.
 * Source: `AAStarAirAccountBase.P256_GUARDIAN_SENTINEL` (`address(0x7026)`).
 */
export const P256_GUARDIAN_SENTINEL: Address = "0x0000000000000000000000000000000000007026";

/**
 * Decoded view of the account's `activeRecovery()` struct (RecoveryProposal).
 *
 * On-chain layout (`AAStarAgentStorageLayout.RecoveryProposal`):
 *   - newOwner            : proposed new owner (address(0) ⇒ no active recovery)
 *   - proposedAt          : block.timestamp when the recovery was proposed
 *   - approvalBitmap      : bit i set ⇒ guardian[i] approved (2-of-3 to execute)
 *   - cancellationBitmap  : bit i set ⇒ guardian[i] voted to cancel (2-of-3 to cancel)
 *
 * The remaining fields are SDK-side conveniences derived from those values.
 */
export interface ActiveRecovery {
  /** Proposed new owner. `0x0000…0000` means there is no active recovery. */
  newOwner: string;
  /** `block.timestamp` at which the recovery was proposed (seconds). */
  proposedAt: bigint;
  /** Bitmap of guardian approvals (bit i ⇒ guardian[i] approved). */
  approvalBitmap: bigint;
  /** Bitmap of guardian cancel votes (bit i ⇒ guardian[i] voted to cancel). */
  cancellationBitmap: bigint;
  /** Number of distinct guardian approvals (popcount of `approvalBitmap`). */
  approvalCount: number;
  /** Number of distinct guardian cancel votes (popcount of `cancellationBitmap`). */
  cancellationCount: number;
  /** Earliest timestamp at which `executeRecovery` may succeed (`proposedAt + timelock`). */
  executeAfter: bigint;
  /** True when a recovery is currently active (`newOwner != address(0)`). */
  isActive: boolean;
}

/** Count the set bits of a non-negative bigint (guardian bitmap popcount). */
function popcount(value: bigint): number {
  let v = value;
  let count = 0;
  while (v > 0n) {
    count += Number(v & 1n);
    v >>= 1n;
  }
  return count;
}

/**
 * RecoveryService — typed wrappers for AirAccount's on-chain social / guardian
 * recovery (capability F28). Unlike `ForceExitService` (an ERC-7579 module),
 * these functions live directly on the account contract, so every encoded
 * calldata below is meant to be submitted **to the account address itself**
 * (via a direct tx or a UserOp).
 *
 * ## Threshold & timelock
 * 2-of-3 guardians ({@link RECOVERY_THRESHOLD} of {@link MAX_GUARDIANS}), with a
 * {@link RECOVERY_TIMELOCK_SECONDS} (2-day) delay before execution.
 *
 * ## Lifecycle & who-can-call
 *   1. `addGuardian(guardian)` — **owner only**. Registers a guardian (max 3).
 *   2. `proposeRecovery(newOwner)` — **any guardian**. Starts the timelock and
 *      records the proposer's approval bit (counts as the first of 2 approvals).
 *   3. `approveRecovery()` — **another guardian**. Sets its approval bit; once
 *      2-of-3 approvals are reached the threshold is satisfied.
 *   4. `executeRecovery()` — **anyone**, but only after the timelock has elapsed
 *      AND the approval threshold is met. Rotates `owner` to `newOwner`.
 *   5. `cancelRecovery()` — **guardians only** (2-of-3 votes). The owner cannot
 *      cancel: a thief who stole the owner key must not be able to block a
 *      legitimate recovery. Each guardian votes independently.
 *   6. `removeGuardian(index, guardianSigs)` — **owner**, but additionally
 *      requires >= {@link RECOVERY_THRESHOLD} guardian signatures over the
 *      removal hash (and cannot drop below 2 guardians).
 *
 * Guardian signatures are domain-separated per operation (the contract hashes a
 * per-op label such as "REMOVE_GUARDIAN") to prevent cross-operation replay.
 *
 * ## Re-proposing
 * A new proposal reverts with `RecoveryAlreadyActive` while one is pending. The
 * docs reference a `clearStaleRecovery()` helper, but that function is NOT
 * present in the deployed V7 ABI/contract — a stale proposal must instead be
 * cleared via guardian `cancelRecovery()` votes before re-proposing.
 */
export class RecoveryService {
  /**
   * @param client viem read client (was `ethers.Provider | ethers.Signer`). Only
   *   on-chain reads are performed here; calldata encoders are pure and never
   *   touch the client.
   */
  constructor(private readonly client: PublicClient) {}

  // ── Calldata encoders (submit TO the account address) ─────────────

  /**
   * Encode `addGuardian(guardian)` calldata. **Owner only.**
   * Registers a recovery guardian; reverts once 3 guardians are set, or if the
   * guardian is `address(0)`, the owner, or already registered.
   */
  encodeAddGuardian(guardian: string): string {
    return encodeFunctionData({
      abi: AIRACCOUNT_ABI_PARSED,
      functionName: "addGuardian",
      args: [guardian as Address],
    });
  }

  /**
   * Encode `removeGuardian(index, guardianSigs)` calldata. **Owner only**, and
   * requires >= {@link RECOVERY_THRESHOLD} guardian signatures over the removal
   * hash. Cannot remove while a recovery is active, nor drop below 2 guardians.
   *
   * @param index        Guardian slot to remove (0-indexed).
   * @param guardianSigs EIP-191 guardian signatures over the removal hash.
   */
  encodeRemoveGuardian(index: number, guardianSigs: string[]): string {
    return encodeFunctionData({
      abi: AIRACCOUNT_ABI_PARSED,
      functionName: "removeGuardian",
      args: [index, guardianSigs as Hex[]],
    });
  }

  /**
   * Build the RAW (un-prefixed) challenge hash that each guardian must sign to
   * authorize `removeGuardian(index, ...)` / `removeGuardianWithMixedSigs(...)`.
   *
   * ## v0.20.0 breaking change (#120 final-review [HIGH], spec §6.4)
   * The signed `opData` changed from `abi.encode(nonce, guardianToRemove)` to
   * `abi.encode(nonce, index, guardianToRemove, p256X, p256Y)` — it now binds the
   * SLOT INDEX and the slot's P-256 key. Because P-256 guardians all share the
   * sentinel address, the old 2-field payload was identical for every P-256 slot,
   * so a signature collected to remove slot A could be replayed to remove slot B
   * (or survive a key rotation). The new 5-field payload affects EVERY removal,
   * including the plain ECDSA path: for an ECDSA slot `p256X`/`p256Y` are both
   * `bytes32(0)`, but the payload STRUCTURE (extra `index` + two key words) still
   * changed, so the ECDSA `removeGuardian` signing payload MUST use this encoding.
   *
   * Hash construction (matches `AAStarAirAccountBase._guardianOpHash`):
   * ```
   * opData    = abi.encode(uint256 nonce, uint8 index, address guardianToRemove,
   *                        bytes32 p256X, bytes32 p256Y)
   * challenge = keccak256(abi.encode(uint8 GUARDIAN_SIG_VERSION, uint256 chainId,
   *                        address account, "REMOVE_GUARDIAN", bytes opData))
   * ```
   * The contract additionally applies `toEthSignedMessageHash()` before
   * `ecrecover`, so this returns the RAW inner hash and each guardian signs it via
   * `personal_sign` / `signMessage({ raw: hash })` (which adds the EIP-191 prefix).
   * Do NOT pre-apply the prefix here (mirrors `buildGuardianAcceptanceHash`).
   *
   * @param account          The AirAccount address whose guardian is being removed.
   * @param chainId          EVM chain id (bound into the challenge).
   * @param removalNonce     Current `_guardianRemovalNonce` — there is no on-chain
   *                         getter (internal storage slot 15), so the caller tracks
   *                         it (starts at 0, increments once per successful removal).
   * @param index            Guardian slot being removed (0-indexed, < guardianCount).
   * @param guardianToRemove Address stored in that slot (a P-256 slot stores
   *                         {@link P256_GUARDIAN_SENTINEL}; an ECDSA slot stores the EOA).
   * @param p256X            Slot's P-256 x coordinate; `bytes32(0)` for an ECDSA slot (default).
   * @param p256Y            Slot's P-256 y coordinate; `bytes32(0)` for an ECDSA slot (default).
   * @returns raw hex keccak256 challenge — guardians sign it with `personal_sign`.
   */
  buildRemoveGuardianHash(args: {
    account: string;
    chainId: number | bigint;
    removalNonce: bigint;
    index: number;
    guardianToRemove: string;
    p256X?: Hex;
    p256Y?: Hex;
  }): Hex {
    const ZERO32: Hex =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    const opData = encodeAbiParameters(
      [
        { type: "uint256" }, // _guardianRemovalNonce
        { type: "uint8" }, //   index
        { type: "address" }, // guardianToRemove
        { type: "bytes32" }, // p256X (0 for ECDSA slot)
        { type: "bytes32" }, // p256Y (0 for ECDSA slot)
      ],
      [
        args.removalNonce,
        args.index,
        args.guardianToRemove as Address,
        args.p256X ?? ZERO32,
        args.p256Y ?? ZERO32,
      ],
    );
    return keccak256(
      encodeAbiParameters(
        [
          { type: "uint8" }, //   GUARDIAN_SIG_VERSION
          { type: "uint256" }, // chainId
          { type: "address" }, // address(this) — the account
          { type: "string" }, //  opLabel
          { type: "bytes" }, //   opData
        ],
        [
          GUARDIAN_SIG_VERSION,
          BigInt(args.chainId),
          args.account as Address,
          "REMOVE_GUARDIAN",
          opData,
        ],
      ),
    );
  }

  /**
   * Encode `proposeRecovery(newOwner)` calldata. **Any guardian** may call.
   * Starts the {@link RECOVERY_TIMELOCK_SECONDS} timelock and records the
   * proposer's approval (1 of {@link RECOVERY_THRESHOLD}).
   */
  encodeProposeRecovery(newOwner: string): string {
    return encodeFunctionData({
      abi: AIRACCOUNT_ABI_PARSED,
      functionName: "proposeRecovery",
      args: [newOwner as Address],
    });
  }

  /**
   * Encode `approveRecovery()` calldata. **Another guardian** approves the
   * active proposal, setting its bit in `approvalBitmap`.
   */
  encodeApproveRecovery(): string {
    return encodeFunctionData({
      abi: AIRACCOUNT_ABI_PARSED,
      functionName: "approveRecovery",
      args: [],
    });
  }

  /**
   * Encode `cancelRecovery()` calldata. **Guardians only** — each call is one
   * vote; recovery is dropped once {@link RECOVERY_THRESHOLD} cancel votes are
   * reached. The owner cannot cancel.
   */
  encodeCancelRecovery(): string {
    return encodeFunctionData({
      abi: AIRACCOUNT_ABI_PARSED,
      functionName: "cancelRecovery",
      args: [],
    });
  }

  /**
   * Encode `executeRecovery()` calldata. **Anyone** may call, but it only
   * succeeds once the timelock has elapsed and the approval threshold is met.
   * Rotates the account owner to the proposed `newOwner`.
   */
  encodeExecuteRecovery(): string {
    return encodeFunctionData({
      abi: AIRACCOUNT_ABI_PARSED,
      functionName: "executeRecovery",
      args: [],
    });
  }

  // ── On-chain reads (against the account address) ──────────────────

  /**
   * Read and decode the account's `activeRecovery()` struct.
   * Returns derived `approvalCount`, `cancellationCount`, `executeAfter`, and
   * `isActive` alongside the raw fields.
   *
   * @param account The AirAccount address to query.
   */
  async getActiveRecovery(account: string): Promise<ActiveRecovery> {
    const [newOwner, proposedAt, approvalBitmap, cancellationBitmap] =
      (await this.client.readContract({
        address: account as Address,
        abi: AIRACCOUNT_ABI_PARSED,
        functionName: "activeRecovery",
      })) as readonly [Address, bigint, bigint, bigint];

    const proposedAtBn = BigInt(proposedAt);
    const approvalBitmapBn = BigInt(approvalBitmap);
    const cancellationBitmapBn = BigInt(cancellationBitmap);

    return {
      newOwner: newOwner as string,
      proposedAt: proposedAtBn,
      approvalBitmap: approvalBitmapBn,
      cancellationBitmap: cancellationBitmapBn,
      approvalCount: popcount(approvalBitmapBn),
      cancellationCount: popcount(cancellationBitmapBn),
      executeAfter: proposedAtBn + RECOVERY_TIMELOCK_SECONDS,
      isActive: (newOwner as string).toLowerCase() !== zeroAddress,
    };
  }

  /**
   * Read the number of registered guardians via `guardianCount()`.
   *
   * @param account The AirAccount address to query.
   */
  async getGuardianCount(account: string): Promise<number> {
    const count = (await this.client.readContract({
      address: account as Address,
      abi: AIRACCOUNT_ABI_PARSED,
      functionName: "guardianCount",
    })) as number | bigint;
    return Number(count);
  }

  /**
   * Read the full guardian address list.
   *
   * The V7 account exposes positional `guardians(uint256 i)` (3 packed slots) plus
   * `guardianCount()` — there is no single `getGuardians()` getter on the account
   * (that exists only on `AirAccountDelegate`, the EIP-7702 path). This reads slots
   * `0..guardianCount-1` and returns the non-zero guardian addresses.
   *
   * @param account The AirAccount address to query.
   */
  async getGuardians(account: string): Promise<string[]> {
    const count = Number(
      (await this.client.readContract({
        address: account as Address,
        abi: AIRACCOUNT_ABI_PARSED,
        functionName: "guardianCount",
      })) as number | bigint
    );
    const guardians: string[] = [];
    for (let i = 0; i < count; i++) {
      const g = (await this.client.readContract({
        address: account as Address,
        abi: AIRACCOUNT_ABI_PARSED,
        functionName: "guardians",
        args: [BigInt(i)],
      })) as string;
      if (g.toLowerCase() !== zeroAddress) guardians.push(g);
    }
    return guardians;
  }
}
