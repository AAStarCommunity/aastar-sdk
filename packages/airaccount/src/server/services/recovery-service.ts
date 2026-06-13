import { ethers } from "ethers";
import { AIRACCOUNT_ABI } from "../constants/entrypoint";

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
  private readonly iface: ethers.Interface;

  constructor(
    private readonly providerOrSigner: ethers.Provider | ethers.Signer
  ) {
    this.iface = new ethers.Interface(AIRACCOUNT_ABI);
  }

  // ── Calldata encoders (submit TO the account address) ─────────────

  /**
   * Encode `addGuardian(guardian)` calldata. **Owner only.**
   * Registers a recovery guardian; reverts once 3 guardians are set, or if the
   * guardian is `address(0)`, the owner, or already registered.
   */
  encodeAddGuardian(guardian: string): string {
    return this.iface.encodeFunctionData("addGuardian", [guardian]);
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
    return this.iface.encodeFunctionData("removeGuardian", [index, guardianSigs]);
  }

  /**
   * Encode `proposeRecovery(newOwner)` calldata. **Any guardian** may call.
   * Starts the {@link RECOVERY_TIMELOCK_SECONDS} timelock and records the
   * proposer's approval (1 of {@link RECOVERY_THRESHOLD}).
   */
  encodeProposeRecovery(newOwner: string): string {
    return this.iface.encodeFunctionData("proposeRecovery", [newOwner]);
  }

  /**
   * Encode `approveRecovery()` calldata. **Another guardian** approves the
   * active proposal, setting its bit in `approvalBitmap`.
   */
  encodeApproveRecovery(): string {
    return this.iface.encodeFunctionData("approveRecovery", []);
  }

  /**
   * Encode `cancelRecovery()` calldata. **Guardians only** — each call is one
   * vote; recovery is dropped once {@link RECOVERY_THRESHOLD} cancel votes are
   * reached. The owner cannot cancel.
   */
  encodeCancelRecovery(): string {
    return this.iface.encodeFunctionData("cancelRecovery", []);
  }

  /**
   * Encode `executeRecovery()` calldata. **Anyone** may call, but it only
   * succeeds once the timelock has elapsed and the approval threshold is met.
   * Rotates the account owner to the proposed `newOwner`.
   */
  encodeExecuteRecovery(): string {
    return this.iface.encodeFunctionData("executeRecovery", []);
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
    const contract = new ethers.Contract(account, AIRACCOUNT_ABI, this.providerOrSigner);
    const [newOwner, proposedAt, approvalBitmap, cancellationBitmap] =
      await contract.activeRecovery();

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
      isActive: (newOwner as string) !== ethers.ZeroAddress,
    };
  }

  /**
   * Read the number of registered guardians via `guardianCount()`.
   *
   * @param account The AirAccount address to query.
   */
  async getGuardianCount(account: string): Promise<number> {
    const contract = new ethers.Contract(account, AIRACCOUNT_ABI, this.providerOrSigner);
    return Number(await contract.guardianCount());
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
    const contract = new ethers.Contract(account, AIRACCOUNT_ABI, this.providerOrSigner);
    const count = Number(await contract.guardianCount());
    const guardians: string[] = [];
    for (let i = 0; i < count; i++) {
      const g = (await contract.guardians(i)) as string;
      if (g !== ethers.ZeroAddress) guardians.push(g);
    }
    return guardians;
  }
}
