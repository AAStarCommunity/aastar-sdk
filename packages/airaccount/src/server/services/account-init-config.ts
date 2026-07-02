import { type Address, type Hex } from "viem";
import { buildInitConfig, type GuardianSpec, type InitConfig, type TokenConfig } from "@aastar/core";
import type { AccountRecord } from "../interfaces/storage-adapter";

/**
 * Shared helpers for the FULL-config (8-field `InitConfig`) account-creation path —
 * the only factory path that can install P-256 (passkey) guardian keys at deploy time
 * (airaccount-contract v0.20.0 / #120, #118).
 *
 * ## Why a dedicated path (not `createAccountWithDefaults`)
 * The factory exposes two account-creation entrypoints with DIFFERENT salt + acceptance
 * semantics (verified against `AAStarAirAccountFactoryV7.sol`):
 *
 *   - `createAccountWithDefaults(owner, salt, g1, g1Sig, g2, g2Sig, dailyLimit)` — ECDSA-only.
 *     CREATE2 salt = `keccak256(owner, salt)` (does NOT bind the config), so the contract
 *     REQUIRES each ECDSA guardian's `ACCEPT_GUARDIAN` acceptance signature to stop a
 *     front-runner from seizing the counterfactual address with different guardians. This is
 *     the existing `AccountManager.createAccountWithGuardians` path; it has no InitConfig and
 *     thus no way to set `guardianP256X/Y`.
 *
 *   - `createAccount(owner, salt, config)` — full 8-field `InitConfig`. CREATE2 salt =
 *     `keccak256(owner, salt, keccak256(InitConfig))` (`_getSalt` over `_getConfigHash`),
 *     so the address is BOUND to the exact config. Because any config change yields a
 *     different address, the contract performs NO guardian-acceptance check on this path —
 *     for either ECDSA or P-256 guardians (`_initAccount` installs every slot directly).
 *     P-256 guardian bootstrap is owner-only and acceptance-sig-free by design (#110④):
 *     a single guardian cannot form a recovery quorum, so no consent ceremony is needed.
 *
 * Consequence: the deploy-time initCode MUST embed the BYTE-IDENTICAL `InitConfig` used to
 * predict the address, or the deployed account lands at a different CREATE2 address. These
 * helpers build the config once (via the core `buildInitConfig`) and reconstruct it
 * deterministically from the persisted record at first-UserOp deploy time so the two match.
 */

/** A P-256 (passkey) guardian public key — SEC1 affine coordinates, each a 32-byte hex word. */
export interface P256GuardianKey {
  x: Hex;
  y: Hex;
}

/** Inputs for the full-config (8-field `InitConfig`) account-creation path. */
export interface FullConfigGuardianParams {
  /** P-256 (passkey) guardians installed at deploy time. Owner-bootstrap — NO acceptance sig. */
  p256Guardians: P256GuardianKey[];
  /**
   * Optional ECDSA guardians, installed via the SAME full-config path. NOTE: on this path the
   * contract does not verify ECDSA acceptance signatures (the config-hash-in-salt binding stands
   * in for them), so none are required or accepted here.
   */
  ecdsaGuardians?: Address[];
  /** Daily spend limit (wei). MUST be > 0 — a guardian set enables the on-chain GUARD. */
  dailyLimit: bigint;
  /** Validator algorithm ids approved at init. Defaults (in buildInitConfig) to ECDSA (+P-256). */
  approvedAlgIds?: number[];
  /** Floor the daily limit may be lowered to via the guard. Defaults to 0. */
  minDailyLimit?: bigint;
  /**
   * ERC-20 tokens to pre-register with the guard at birth (index-aligned with `initialTokenConfigs`).
   * NOTE: these are per-TOKEN spend limits — they do NOT set the account's NATIVE-ETH tier1/tier2
   * (those live in account storage slots 10/11, set via `setTierLimits`, not in InitConfig). #266.
   */
  initialTokens?: readonly Address[];
  /** Per-token `{ tier1Limit, tier2Limit, dailyLimit }` (wei), 1:1 with `initialTokens`. */
  initialTokenConfigs?: readonly TokenConfig[];
}

/** A guardian slot serialized for JSON persistence on the {@link AccountRecord}. */
export type SerializedGuardianSpec = { ecdsa: string } | { p256: { x: string; y: string } };

/**
 * Map the public params to core {@link GuardianSpec}s in a DETERMINISTIC order
 * (ECDSA slots first, then P-256). Order is consensus-critical: it determines both the
 * predicted CREATE2 address and the guardian slot index each key occupies on-chain.
 */
export function toGuardianSpecs(p: FullConfigGuardianParams): GuardianSpec[] {
  const specs: GuardianSpec[] = [];
  for (const e of p.ecdsaGuardians ?? []) specs.push({ ecdsa: e });
  for (const k of p.p256Guardians) specs.push({ p256: { x: k.x, y: k.y } });
  return specs;
}

/**
 * Build the full 8-field `InitConfig` for the create path. Delegates to the core
 * `buildInitConfig` (the 0.22.0 builder) so the P-256 slots, sentinel handling, and
 * approvedAlgId defaulting are produced by ONE audited implementation — never hand-rolled.
 */
export function buildFullInitConfig(p: FullConfigGuardianParams): InitConfig {
  return buildInitConfig({
    guardians: toGuardianSpecs(p),
    dailyLimit: p.dailyLimit,
    ...(p.approvedAlgIds ? { approvedAlgIds: p.approvedAlgIds } : {}),
    ...(p.minDailyLimit !== undefined ? { minDailyLimit: p.minDailyLimit } : {}),
    ...(p.initialTokens ? { initialTokens: p.initialTokens } : {}),
    ...(p.initialTokenConfigs ? { initialTokenConfigs: p.initialTokenConfigs } : {}),
  });
}

/**
 * Flatten a typed {@link InitConfig} into the POSITIONAL tuple the local human-readable
 * factory ABI (`AIRACCOUNT_FACTORY_ABI`, fed through viem `parseAbi`) expects as the
 * `config` argument of `getAddress` / `createAccount`. Field order is consensus-critical
 * and matches `AAStarAirAccountBase.InitConfig` exactly.
 */
export function initConfigToTuple(c: InitConfig): readonly unknown[] {
  return [
    c.guardians,
    c.guardianP256X,
    c.guardianP256Y,
    c.dailyLimit,
    c.approvedAlgIds,
    c.minDailyLimit,
    c.initialTokens,
    c.initialTokenConfigs.map((t) => [t.tier1Limit, t.tier2Limit, t.dailyLimit]),
  ];
}

/** Serialize core {@link GuardianSpec}s for JSON storage on the account record. */
export function serializeGuardianSpecs(specs: readonly GuardianSpec[]): SerializedGuardianSpec[] {
  return specs.map((s) =>
    s.p256 ? { p256: { x: s.p256.x, y: s.p256.y } } : { ecdsa: s.ecdsa as string }
  );
}

/**
 * Reconstruct the BYTE-IDENTICAL `InitConfig` from a persisted record at deploy time.
 *
 * Re-derivation is exact because the record persists the RESOLVED `approvedAlgIds`,
 * `minDailyLimit`, and `dailyLimit` (not just the create-time inputs), and `buildInitConfig`
 * is a pure function of its arguments. The resulting config therefore hashes to the same
 * `_getConfigHash`, yielding the same CREATE2 address that was predicted at create time.
 *
 * @throws if the record carries no `guardianSpecs` (i.e. it is not a full-config account).
 */
export function initConfigFromRecord(record: AccountRecord): InitConfig {
  if (!record.guardianSpecs || record.guardianSpecs.length === 0) {
    throw new Error(
      "initConfigFromRecord: record has no guardianSpecs (not a full-config / P-256 account)"
    );
  }
  const guardians: GuardianSpec[] = record.guardianSpecs.map((s) =>
    "p256" in s
      ? { p256: { x: s.p256.x as Hex, y: s.p256.y as Hex } }
      : { ecdsa: s.ecdsa as Address }
  );
  return buildInitConfig({
    guardians,
    dailyLimit: record.dailyLimit ? BigInt(record.dailyLimit) : 0n,
    ...(record.approvedAlgIds ? { approvedAlgIds: record.approvedAlgIds } : {}),
    ...(record.minDailyLimit !== undefined ? { minDailyLimit: BigInt(record.minDailyLimit) } : {}),
  });
}
