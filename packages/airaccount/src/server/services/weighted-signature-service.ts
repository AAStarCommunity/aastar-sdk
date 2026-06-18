import { encodeFunctionData, type Hex, type PublicClient } from "viem";
// The weighted-signature ABI below is a local human-readable `string[]` signature set
// (not available in @aastar/core), so parseAbi is required to feed it to viem's
// encodeFunctionData/readContract during the ethers->viem migration.
// eslint-disable-next-line no-restricted-imports
import { parseAbi } from "viem";

// AAStarAirAccount weighted-signature governance ABI — minimal subset for SDK use.
// These functions live on the ACCOUNT itself (algId 0x07 / AirAccountExtension),
// NOT on a separate ERC-7579 module. The WeightConfig tuple field order is
// authoritative and matches packages/core/src/abis/AAStarAirAccountV7.json exactly.
const WEIGHTED_SIGNATURE_ABI = [
  // Direct owner set (first-time / strengthening only)
  "function setWeightConfig((uint8 passkeyWeight, uint8 ecdsaWeight, uint8 blsWeight, uint8 guardian0Weight, uint8 guardian1Weight, uint8 guardian2Weight, uint8 _padding, uint8 tier1Threshold, uint8 tier2Threshold, uint8 tier3Threshold) config) external",
  // Guardian-governed change flow (required for any weakening)
  "function proposeWeightChange((uint8 passkeyWeight, uint8 ecdsaWeight, uint8 blsWeight, uint8 guardian0Weight, uint8 guardian1Weight, uint8 guardian2Weight, uint8 _padding, uint8 tier1Threshold, uint8 tier2Threshold, uint8 tier3Threshold) proposed) external",
  "function approveWeightChange() external",
  "function cancelWeightChange() external",
  "function executeWeightChange() external",
  // State readers
  "function weightConfig() external view returns (uint8 passkeyWeight, uint8 ecdsaWeight, uint8 blsWeight, uint8 guardian0Weight, uint8 guardian1Weight, uint8 guardian2Weight, uint8 _padding, uint8 tier1Threshold, uint8 tier2Threshold, uint8 tier3Threshold)",
  "function pendingWeightChange() external view returns ((uint8 passkeyWeight, uint8 ecdsaWeight, uint8 blsWeight, uint8 guardian0Weight, uint8 guardian1Weight, uint8 guardian2Weight, uint8 _padding, uint8 tier1Threshold, uint8 tier2Threshold, uint8 tier3Threshold) proposed, uint256 proposedAt, uint256 approvalBitmap)",
  // Errors (for decoding reverts)
  "error InsecureWeightConfig()",
  "error WeakeningRequiresProposal()",
  "error WeightChangePending()",
  "error NoWeightChangeProposal()",
  "error WeightChangeAlreadyApproved()",
  "error WeightChangeNotApproved()",
  "error WeightChangeTimelockNotExpired()",
];

// Parsed (loosely-typed `Abi`) form for viem encodeFunctionData/readContract.
const WEIGHTED_SIGNATURE_ABI_PARSED = parseAbi(WEIGHTED_SIGNATURE_ABI as readonly string[]);

/** Timelock that must elapse after a proposal before executeWeightChange() succeeds (WEIGHT_CHANGE_TIMELOCK = 2 days). */
export const WEIGHT_CHANGE_TIMELOCK_SECONDS = 2 * 24 * 60 * 60;
/** Guardian approvals required to execute a pending weight change (WEIGHT_CHANGE_THRESHOLD = 2-of-3). */
export const WEIGHT_CHANGE_THRESHOLD = 2;
/** A proposal expires this long after it is proposed; approvals/execution after expiry revert (WEIGHT_CHANGE_EXPIRY = 30 days). */
export const WEIGHT_CHANGE_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

/**
 * WeightConfig — the weighted multi-signature policy for an AAStarAirAccount (algId 0x07).
 *
 * Each signer type / guardian contributes its weight; a transaction is authorized when the
 * summed weight of present signatures meets the relevant tier threshold. tier1 is the base
 * (required, non-zero) threshold; tier2/tier3 gate higher-value operations and, when set,
 * must be monotonically non-decreasing (tier1 <= tier2 <= tier3).
 *
 * Field order MUST match the on-chain struct exactly (see AAStarAirAccountV7.json):
 * passkeyWeight, ecdsaWeight, blsWeight, guardian0Weight, guardian1Weight, guardian2Weight,
 * _padding, tier1Threshold, tier2Threshold, tier3Threshold.
 */
export interface WeightConfig {
  /** Weight granted by a valid passkey (P256/WebAuthn) signature. */
  passkeyWeight: number;
  /** Weight granted by a valid ECDSA (secp256k1 owner) signature. */
  ecdsaWeight: number;
  /** Weight granted by a valid BLS signature. */
  blsWeight: number;
  /** Weight granted by guardian slot 0. */
  guardian0Weight: number;
  /** Weight granted by guardian slot 1. */
  guardian1Weight: number;
  /** Weight granted by guardian slot 2. */
  guardian2Weight: number;
  /** Reserved padding byte (storage packing); keep 0. */
  _padding: number;
  /** Base threshold; must be non-zero and strictly greater than every individual weight. */
  tier1Threshold: number;
  /** Tier-2 threshold (0 = disabled); when set must be >= tier1Threshold. */
  tier2Threshold: number;
  /** Tier-3 threshold (0 = disabled); when set requires tier2 set and must be >= tier2Threshold. */
  tier3Threshold: number;
}

/** A pending weight-change proposal awaiting guardian approval + timelock. */
export interface PendingWeightChange {
  /** The proposed new WeightConfig. */
  proposed: WeightConfig;
  /** Unix timestamp when the proposal was created; 0 means no active proposal. */
  proposedAt: bigint;
  /** Bitmap of guardian indices that have approved (bit i set => guardian i approved). */
  approvalBitmap: bigint;
}

// Canonical field order of the WeightConfig tuple as encoded on-chain.
const WEIGHT_CONFIG_FIELDS = [
  "passkeyWeight",
  "ecdsaWeight",
  "blsWeight",
  "guardian0Weight",
  "guardian1Weight",
  "guardian2Weight",
  "_padding",
  "tier1Threshold",
  "tier2Threshold",
  "tier3Threshold",
] as const;

function toConfigTuple(config: WeightConfig): number[] {
  return WEIGHT_CONFIG_FIELDS.map((f) => config[f]);
}

function fromConfigResult(result: unknown): WeightConfig {
  const r = result as Record<string, unknown> & unknown[];
  // viem decodes a named-component tuple into an object (named access) while a
  // list of separate outputs decodes into an array (positional access); support both.
  const pick = (name: string, idx: number): number =>
    Number((r[name] ?? r[idx]) as number | bigint);
  return {
    passkeyWeight: pick("passkeyWeight", 0),
    ecdsaWeight: pick("ecdsaWeight", 1),
    blsWeight: pick("blsWeight", 2),
    guardian0Weight: pick("guardian0Weight", 3),
    guardian1Weight: pick("guardian1Weight", 4),
    guardian2Weight: pick("guardian2Weight", 5),
    _padding: pick("_padding", 6),
    tier1Threshold: pick("tier1Threshold", 7),
    tier2Threshold: pick("tier2Threshold", 8),
    tier3Threshold: pick("tier3Threshold", 9),
  };
}

/**
 * WeightedSignatureService — typed wrappers for AAStarAirAccount weighted-signature
 * governance (algId 0x07).
 *
 * Governance model:
 *   - setWeightConfig(config): OWNER only. Used for the first-time config and for
 *     *strengthening* changes (no individual weight or tier threshold decreased).
 *     Reverts WeakeningRequiresProposal-equivalent path is enforced by the contract:
 *     a weakening passed here reverts; route weakenings through proposeWeightChange.
 *     Also reverts if a proposal is already pending (WeightChangePending).
 *   - proposeWeightChange(config): OWNER only. Required when the new config *weakens*
 *     security (lowers any weight or threshold). Opens a guardian-approved proposal.
 *   - approveWeightChange(): GUARDIAN only (any of the 3 guardian slots). Each guardian
 *     may approve once; approvals are tracked in approvalBitmap.
 *   - executeWeightChange(): ANYONE, but only succeeds once BOTH conditions hold:
 *       (1) approvals >= WEIGHT_CHANGE_THRESHOLD (2-of-3 guardians), and
 *       (2) WEIGHT_CHANGE_TIMELOCK (2 days) has elapsed since proposedAt.
 *     A proposal also expires after WEIGHT_CHANGE_EXPIRY (30 days).
 *   - cancelWeightChange(): OWNER or any GUARDIAN may cancel a pending proposal.
 *
 * Unlike ForceExitService (an ERC-7579 module), these calls target the ACCOUNT itself.
 * Construct with the account address; encode* methods return calldata for a UserOp or
 * direct tx, and reads use the contract directly.
 */
export class WeightedSignatureService {
  private readonly address: `0x${string}`;

  constructor(
    private readonly accountAddress: string,
    private readonly client: PublicClient
  ) {
    this.address = accountAddress as `0x${string}`;
  }

  // ── On-chain reads ──────────────────────────────────────────────

  /** Read the account's current active WeightConfig. */
  async getWeightConfig(): Promise<WeightConfig> {
    const result = await this.client.readContract({
      address: this.address,
      abi: WEIGHTED_SIGNATURE_ABI_PARSED,
      functionName: "weightConfig",
    });
    return fromConfigResult(result);
  }

  /**
   * Read the pending weight-change proposal. When `proposedAt === 0n` there is no
   * active proposal (the returned `proposed` config will be all zeros).
   */
  async getPendingWeightChange(): Promise<PendingWeightChange> {
    const [proposed, proposedAt, approvalBitmap] = (await this.client.readContract({
      address: this.address,
      abi: WEIGHTED_SIGNATURE_ABI_PARSED,
      functionName: "pendingWeightChange",
    })) as [unknown, bigint, bigint];
    return {
      proposed: fromConfigResult(proposed),
      proposedAt: BigInt(proposedAt),
      approvalBitmap: BigInt(approvalBitmap),
    };
  }

  // ── Calldata encoders (for UserOp or direct tx submission) ─────

  /**
   * Encode setWeightConfig calldata. OWNER only; for first-time setup or strengthening.
   * Weakening an existing config must go through encodeProposeWeightChange instead.
   */
  encodeSetWeightConfig(config: WeightConfig): Hex {
    return encodeFunctionData({
      abi: WEIGHTED_SIGNATURE_ABI_PARSED,
      functionName: "setWeightConfig",
      args: [toConfigTuple(config)],
    });
  }

  /**
   * Encode proposeWeightChange calldata. OWNER only; opens a guardian-governed proposal
   * (required for any weakening). Subject to 2-of-3 approval + 2-day timelock before execute.
   */
  encodeProposeWeightChange(config: WeightConfig): Hex {
    return encodeFunctionData({
      abi: WEIGHTED_SIGNATURE_ABI_PARSED,
      functionName: "proposeWeightChange",
      args: [toConfigTuple(config)],
    });
  }

  /** Encode approveWeightChange calldata. GUARDIAN only; each guardian may approve once. */
  encodeApproveWeightChange(): Hex {
    return encodeFunctionData({
      abi: WEIGHTED_SIGNATURE_ABI_PARSED,
      functionName: "approveWeightChange",
    });
  }

  /** Encode cancelWeightChange calldata. OWNER or any GUARDIAN may cancel a pending proposal. */
  encodeCancelWeightChange(): Hex {
    return encodeFunctionData({
      abi: WEIGHTED_SIGNATURE_ABI_PARSED,
      functionName: "cancelWeightChange",
    });
  }

  /**
   * Encode executeWeightChange calldata. Callable by anyone, but only succeeds once the
   * threshold (2-of-3) and timelock (2 days) are both satisfied and the proposal has not expired.
   */
  encodeExecuteWeightChange(): Hex {
    return encodeFunctionData({
      abi: WEIGHTED_SIGNATURE_ABI_PARSED,
      functionName: "executeWeightChange",
    });
  }
}
