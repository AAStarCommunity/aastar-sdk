import type { Address, Hex } from "viem";
import type { ViemContract } from "./ethereum-provider";

/**
 * Audited boundary for HIGH-risk contract reads.
 *
 * Background: the ethers->viem migration loads the EntryPoint / AirAccount /
 * validator / guard ABIs from human-readable signatures via `parseAbi`, then
 * widens them to the loose `Abi` shape (`ViemContract.read` is a bare
 * `Record<string, (...args) => Promise<unknown>>`). On that surface a wrong
 * function name, a wrong argument type (e.g. a JS `number` where a `uint256`
 * `bigint` is required, which can silently truncate outside the 53-bit safe
 * range), or a wrong decode shape is NOT caught at compile time.
 *
 * This module confines every such cast to one reviewable place. It only wraps
 * reads whose result flows into a money-movement / signing / authorization
 * decision (per the risk framework): gas math that gets signed, the
 * counterfactual account address that holds funds, the guard / tier / algorithm
 * gates that allow or deny a transfer, and the grant hashes the account owner
 * signs to authorize a session key. Pure display / logging reads are
 * deliberately left on the loose surface to keep this boundary small.
 *
 * Each wrapper declares explicit parameter types (bigint for every uint256) and
 * an explicit return type next to the on-chain function name it targets, so the
 * single `as` cast is documented against the real ABI signature.
 */

/** Resolve a loosely-typed read method by name. The only cast escape hatch. */
function readFn(contract: ViemContract, name: string): (args: readonly unknown[]) => Promise<unknown> {
  return contract.read[name] as (args: readonly unknown[]) => Promise<unknown>;
}

// ── Validator: gas estimate folded into the signed UserOp gas budget ──────────

/**
 * `getGasEstimate(uint256 nodeCount) view returns (uint256)`.
 * `nodeCount` MUST be a bigint — the loose surface would accept a JS number and
 * risk silent truncation for a uint256 arg.
 */
export function readValidatorGasEstimate(
  validator: ViemContract,
  nodeCount: bigint
): Promise<bigint> {
  return readFn(validator, "getGasEstimate")([nodeCount]) as Promise<bigint>;
}

// ── Factory: counterfactual account address (= fund-custody address) ──────────

/**
 * `getAddress(address owner, uint256 salt, InitConfig config, bytes32 ownerP256X, bytes32 ownerP256Y)
 *  view returns (address)` (v0.22.0 — 5-arg). The predicted address is where user funds are sent
 * before deployment, so it MUST bind the SAME `ownerP256X/Y` the deploy uses (the salt folds them in).
 * Omit them (default 0) for accounts deployed WITHOUT a birth-injected passkey — the common path.
 */
const TR_ZERO_BYTES32 = `0x${"00".repeat(32)}` as `0x${string}`;
export function readPredictedAddress(
  factory: ViemContract,
  owner: string,
  salt: bigint,
  config: readonly unknown[],
  ownerP256X: `0x${string}` = TR_ZERO_BYTES32,
  ownerP256Y: `0x${string}` = TR_ZERO_BYTES32
): Promise<Address> {
  return readFn(factory, "getAddress")([owner, salt, config, ownerP256X, ownerP256Y]) as Promise<Address>;
}

/**
 * `getAddressWithDefaults(address owner, uint256 salt, address guardian1,
 *  address guardian2, uint256 dailyLimit) view returns (address)`.
 * Both `salt` and `dailyLimit` are uint256 and MUST be bigint.
 */
export function readPredictedAddressWithDefaults(
  factory: ViemContract,
  owner: string,
  salt: bigint,
  guardian1: string,
  guardian2: string,
  dailyLimit: bigint
): Promise<Address> {
  return readFn(factory, "getAddressWithDefaults")([
    owner,
    salt,
    guardian1,
    guardian2,
    dailyLimit,
  ]) as Promise<Address>;
}

// ── Account: authorization gates consumed by GuardChecker.preCheck ────────────

/**
 * `tier1Limit()` / `tier2Limit()` (both uint256). These resolve the transfer
 * tier -> signing algId, gating which algorithm may authorize the transfer.
 */
export async function readAccountTierLimits(
  account: ViemContract
): Promise<{ tier1Limit: bigint; tier2Limit: bigint }> {
  const [tier1Limit, tier2Limit] = await Promise.all([
    readFn(account, "tier1Limit")([]) as Promise<bigint>,
    readFn(account, "tier2Limit")([]) as Promise<bigint>,
  ]);
  return { tier1Limit, tier2Limit };
}

/**
 * `approvedAlgorithms(uint8 algId) view returns (bool)`. Gates whether the
 * signing algorithm for the resolved tier is allowed to authorize the tx.
 * `algId` is a uint8 (small enum), so a JS number is the correct ABI type.
 */
export function readAlgorithmApproved(account: ViemContract, algId: number): Promise<boolean> {
  return readFn(account, "approvedAlgorithms")([algId]) as Promise<boolean>;
}

/**
 * `guard()` -> the per-account AAStarGlobalGuard address (zero when no guard is enforced); this is what
 * decides whether the per-account spending guard is enforced at all.
 *
 * #254 regression fix: this used to read `getConfigDescription().guardAddress`, but v0.22.0 accounts
 * REMOVED `getConfigDescription()` (only ForceExitModule exposes one, with different semantics). The call
 * reverted on every v0.22.0 account, and guard-checker / `prepareTransfer` run this on EVERY transfer +
 * config op — bricking all of them. The guard is exposed directly via `guard()` (same value the struct's
 * `guardAddress` field carried), already used by guard-state-reader. Read it directly.
 */
export async function readAccountGuardAddress(account: ViemContract): Promise<Address> {
  return (await readFn(account, "guard")([])) as Address;
}

// ── Guard: daily spend allowance gate ─────────────────────────────────────────

/**
 * `dailyLimit()` / `remainingDailyAllowance()` (both uint256). These cap the
 * value that may move per day; comparing the wrong (mistyped) value would let an
 * over-limit transfer through the pre-check.
 */
export async function readGuardDailyAllowance(
  guard: ViemContract
): Promise<{ dailyLimit: bigint; dailyRemaining: bigint }> {
  const [dailyLimit, dailyRemaining] = await Promise.all([
    readFn(guard, "dailyLimit")([]) as Promise<bigint>,
    readFn(guard, "remainingDailyAllowance")([]) as Promise<bigint>,
  ]);
  return { dailyLimit, dailyRemaining };
}

// ── SessionKeyValidator: grant hashes the account owner SIGNS ─────────────────

/** The on-chain `Session` struct passed to the grant-hash builders. */
export interface SessionGrantConfig {
  expiry: number;
  contractScope: string;
  selectorScope: string;
  revoked: boolean;
  velocityLimit: number;
  velocityWindow: number;
  callTargets: string[];
  selectorAllowlist: string[];
}

/**
 * `buildGrantHash(address account, address sessionKey, Session cfg) view returns (bytes32)`.
 * The returned digest is signed by the account owner to authorize the grant — a
 * wrong function name or decode shape would have the owner sign the wrong hash.
 */
export function readBuildGrantHash(
  validator: ViemContract,
  account: string,
  sessionKey: string,
  cfg: SessionGrantConfig
): Promise<Hex> {
  return readFn(validator, "buildGrantHash")([account, sessionKey, cfg]) as Promise<Hex>;
}

/**
 * `buildP256GrantHash(address account, bytes32 keyX, bytes32 keyY, Session cfg)
 *  view returns (bytes32)`. Owner-signed authorization digest for a P256 grant.
 */
export function readBuildP256GrantHash(
  validator: ViemContract,
  account: string,
  keyX: string,
  keyY: string,
  cfg: SessionGrantConfig
): Promise<Hex> {
  return readFn(validator, "buildP256GrantHash")([account, keyX, keyY, cfg]) as Promise<Hex>;
}
