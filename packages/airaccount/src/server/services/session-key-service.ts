import {
  getContract,
  encodeFunctionData,
  zeroAddress,
  type Abi,
  type PublicClient,
} from "viem";
// parseAbi is required to feed the local human-readable string[] ABIs to viem's
// getContract / encodeFunctionData during the ethers->viem migration. These
// validator ABIs are not available in @aastar/core.
// eslint-disable-next-line no-restricted-imports
import { parseAbi } from "viem";
import {
  SESSION_KEY_VALIDATOR_ABI,
} from "../constants/entrypoint";
import { type ViemContract } from "../providers/ethereum-provider";
import { readBuildGrantHash, readBuildP256GrantHash } from "../providers/typed-reads";

// Parse the local human-readable ABI once. Widened to `Abi` so viem treats the
// call args loosely (plain address strings / numbers) — matching the previous
// ethers.Interface ergonomics without per-call `0x${string}` casts.
const SESSION_KEY_VALIDATOR_VIEM_ABI = parseAbi(SESSION_KEY_VALIDATOR_ABI) as Abi;

/**
 * The M7 "agent session" methods below are deprecated no-ops that throw: airaccount-contract v0.27.0
 * confirmed (Seeder CC-16 / #282) there is no deployed `AgentSessionKeyValidator` and no distinct agent
 * algId — an agent session reuses `SessionKeyValidator` (algId `0x08`) with a scoped `Session`. These
 * methods previously produced calldata that reverts on-chain; they now fail closed with a clear error.
 */
function agentSessionUnsupported(method: string): never {
  throw new Error(
    `SessionKeyService.${method} is not supported: no AgentSessionKeyValidator contract is deployed ` +
    `(airaccount-contract v0.27.0, #282). Agent sessions reuse SessionKeyValidator (algId 0x08) — use ` +
    `the M6 session methods (grantSession / grantP256Session) with a scoped Session instead.`
  );
}

// ─── M6 SessionKeyValidator ──────────────────────────────────────

export interface GrantSessionParams {
  /** Account that owns the session */
  account: string;
  /** The session key address (ephemeral EOA) */
  sessionKey: string;
  /** Expiry unix timestamp (max 7 days from now) */
  expiry: number;
  /** address(0) = any destination allowed */
  contractScope?: string;
  /** bytes4(0) = any selector allowed */
  selectorScope?: string;
  /** Max calls per velocityWindow (0 = unlimited). Session struct field. */
  velocityLimit?: number;
  /** Velocity window in seconds (0 = no window). Session struct field. */
  velocityWindow?: number;
  /** Allowed destination addresses ([] = any). Session struct field. */
  callTargets?: string[];
  /** Allowed selectors ([] = any). Session struct field. */
  selectorAllowlist?: string[];
  /** Owner signature over buildGrantHash() — omit if calling directly from account */
  ownerSig?: string;
}

export interface SessionInfo {
  expiry: number;
  contractScope: string;
  selectorScope: string;
  revoked: boolean;
  velocityLimit: number;
  velocityWindow: number;
  callTargets: string[];
  selectorAllowlist: string[];
  active: boolean;
}

export interface GrantP256SessionParams {
  /** Account that owns the session */
  account: string;
  /** P256 public key X coordinate (0x-prefixed 32-byte hex) */
  keyX: string;
  /** P256 public key Y coordinate (0x-prefixed 32-byte hex) */
  keyY: string;
  /** Expiry unix timestamp (max 7 days from now) */
  expiry: number;
  /** address(0) = any destination allowed */
  contractScope?: string;
  /** bytes4(0) = any selector allowed */
  selectorScope?: string;
  /** Max calls per velocityWindow (0 = unlimited). Session struct field. */
  velocityLimit?: number;
  /** Velocity window in seconds (0 = no window). Session struct field. */
  velocityWindow?: number;
  /** Allowed destination addresses ([] = any). Session struct field. */
  callTargets?: string[];
  /** Allowed selectors ([] = any). Session struct field. */
  selectorAllowlist?: string[];
  /** Owner signature over buildP256GrantHash() — omit if calling directly from the owner EOA */
  ownerSig?: string;
}

/**
 * The on-chain `Session` struct (8 fields), passed as a single tuple arg to the
 * grant/build functions and returned by getSession/getP256Session. Field order
 * MUST match SessionKeyValidator.sol and packages/core/src/abis/SessionKeyValidator.json:
 *   (uint48 expiry, address contractScope, bytes4 selectorScope, bool revoked,
 *    uint16 velocityLimit, uint32 velocityWindow, address[] callTargets, bytes4[] selectorAllowlist)
 */
interface SessionStruct {
  expiry: number;
  contractScope: string;
  selectorScope: string;
  revoked: boolean;
  velocityLimit: number;
  velocityWindow: number;
  callTargets: string[];
  selectorAllowlist: string[];
}

/** Build the Session tuple from grant params; `revoked` is always false on grant. */
function buildSessionStruct(params: {
  expiry: number;
  contractScope?: string;
  selectorScope?: string;
  velocityLimit?: number;
  velocityWindow?: number;
  callTargets?: string[];
  selectorAllowlist?: string[];
}): SessionStruct {
  return {
    expiry: params.expiry,
    contractScope: params.contractScope ?? zeroAddress,
    selectorScope: params.selectorScope ?? "0x00000000",
    revoked: false,
    velocityLimit: params.velocityLimit ?? 0,
    velocityWindow: params.velocityWindow ?? 0,
    callTargets: params.callTargets ?? [],
    selectorAllowlist: params.selectorAllowlist ?? [],
  };
}

/**
 * The raw 8-field Session tuple as decoded by viem. Because the on-chain return
 * type names every tuple component (uint48 expiry, address contractScope, ...),
 * viem returns a NAMED object (not an array), so we read by field name. uint
 * fields come back as `bigint`.
 */
interface RawSession {
  expiry: bigint | number;
  contractScope: string;
  selectorScope: string;
  revoked: boolean;
  velocityLimit: bigint | number;
  velocityWindow: bigint | number;
  callTargets: readonly string[];
  selectorAllowlist: readonly string[];
}

/**
 * Decode the 8-field Session tuple returned by getSession/getP256Session into
 * a SessionInfo, computing the derived `active` flag.
 */
function decodeSessionInfo(session: unknown): SessionInfo {
  const s = session as RawSession;
  const expiry = Number(s.expiry);
  const now = Math.floor(Date.now() / 1000);
  return {
    expiry,
    contractScope: s.contractScope,
    selectorScope: s.selectorScope,
    revoked: s.revoked,
    velocityLimit: Number(s.velocityLimit),
    velocityWindow: Number(s.velocityWindow),
    callTargets: [...(s.callTargets ?? [])],
    selectorAllowlist: [...(s.selectorAllowlist ?? [])],
    active: expiry > now && !s.revoked,
  };
}

// ─── M7 AgentSessionKeyValidator (DEPRECATED — no deployed contract, #282) ───

/** @deprecated No AgentSessionKeyValidator is deployed (airaccount-contract v0.27.0, #282). Use a scoped M6 {@link GrantSessionParams} instead. */
export interface AgentSessionConfig {
  expiry: number;               // Unix timestamp
  velocityLimit: number;        // Max calls per velocityWindow (0 = unlimited)
  velocityWindow: number;       // Window in seconds
  callTargets: string[];        // Allowed dest addresses (empty = any)
  selectorAllowlist: string[];  // Allowed selectors (empty = any)
}

/** @deprecated No AgentSessionKeyValidator is deployed (#282). See {@link AgentSessionConfig}. */
export interface AgentSessionInfo extends AgentSessionConfig {
  revoked: boolean;
  callCount: bigint;
  windowStart: bigint;
}

/**
 * SessionKeyService — manage M6 session keys on `SessionKeyValidator` (algId `0x08`):
 * time-limited ECDSA/P256 keys with optional contract+selector scope, for standard delegated
 * actions (hot wallet, automated tasks, and — via a scoped Session — agent delegation).
 *
 * The M7 "agent session" methods (grantAgentSession/delegateSession/…) are **deprecated and throw**:
 * airaccount-contract v0.27.0 confirmed there is no deployed `AgentSessionKeyValidator` and no distinct
 * agent algId (Seeder CC-16 / #282). Use the M6 methods with a scoped Session instead.
 */
export class SessionKeyService {
  private readonly skValidator: ViemContract;

  /**
   * @param provider viem PublicClient for reads.
   * @param sessionKeyValidatorAddress the M6 `SessionKeyValidator` (algId 0x08).
   * @param _agentSessionKeyValidatorAddress @deprecated ignored — no AgentSessionKeyValidator is
   *   deployed (#282). Accepted for one minor to keep the 3-arg call sites compiling.
   */
  constructor(
    provider: PublicClient,
    sessionKeyValidatorAddress: string,
    _agentSessionKeyValidatorAddress?: string,
  ) {
    this.skValidator = getContract({
      address: sessionKeyValidatorAddress as `0x${string}`,
      abi: SESSION_KEY_VALIDATOR_VIEM_ABI,
      client: provider,
    }) as unknown as ViemContract;
  }

  // ── M6: Basic Session Keys ────────────────────────────────────

  /**
   * Build the hash that the account owner must sign to grant a session key.
   * Use grantSession() with this sig, or grantSessionDirect() from the account itself.
   */
  async buildGrantHash(params: Omit<GrantSessionParams, "ownerSig">): Promise<string> {
    return readBuildGrantHash(
      this.skValidator,
      params.account,
      params.sessionKey,
      buildSessionStruct(params)
    );
  }

  /** Query an ECDSA session key state (decodes the 8-field Session tuple). */
  async getSession(account: string, sessionKey: string): Promise<SessionInfo> {
    const session = await this.skValidator.read.getSession([account, sessionKey]);
    return decodeSessionInfo(session);
  }

  /** Check if an ECDSA session is currently active. */
  async isSessionActive(account: string, sessionKey: string): Promise<boolean> {
    return this.skValidator.read.isSessionActive([account, sessionKey]) as Promise<boolean>;
  }

  /**
   * Encode calldata for session grant.
   *
   * - **With ownerSig** → `grantSession()` — for gasless/UserOp flows.
   *   Owner signs the GRANT_SESSION_V2 typed hash via KMS `sign-grant-session`,
   *   then the relayer calls `grantSession(account, key, cfg, ownerSig)` on-chain.
   *   This is the ONLY path for ERC-4337 sponsored / gasless grant flows.
   *
   * - **Without ownerSig** → `grantSessionDirect()` — **owner EOA direct-send only**.
   *   Since v0.17.2 round 3, `grantSessionDirect` requires `msg.sender == ownerOf(account)`.
   *   It does NOT accept `msg.sender == account` (removed in round 3 — confused-deputy fix).
   *   Do NOT encode this for a UserOp callData; the EntryPoint is not the owner EOA.
   */
  encodeGrantSession(params: GrantSessionParams): string {
    const cfg = buildSessionStruct(params);
    if (params.ownerSig) {
      return encodeFunctionData({
        abi: SESSION_KEY_VALIDATOR_VIEM_ABI,
        functionName: "grantSession",
        args: [params.account, params.sessionKey, cfg, params.ownerSig],
      });
    }
    // grantSessionDirect — owner EOA direct tx only (NOT for UserOp/gasless flows).
    return encodeFunctionData({
      abi: SESSION_KEY_VALIDATOR_VIEM_ABI,
      functionName: "grantSessionDirect",
      args: [params.account, params.sessionKey, cfg],
    });
  }

  /** Encode calldata for revokeSession(). */
  encodeRevokeSession(account: string, sessionKey: string): string {
    return encodeFunctionData({
      abi: SESSION_KEY_VALIDATOR_VIEM_ABI,
      functionName: "revokeSession",
      args: [account, sessionKey],
    });
  }

  // ── M6: P256 / Passkey Session Keys ───────────────────────────

  /**
   * Build the hash that the account owner must sign to grant a P256/passkey session key.
   * Use grantP256Session() with this sig, or grantP256SessionDirect() from the owner EOA itself.
   * The owner/KMS signs this hash to authorize a gasless grantP256Session().
   */
  async buildP256GrantHash(
    params: Omit<GrantP256SessionParams, "ownerSig">,
  ): Promise<string> {
    return readBuildP256GrantHash(
      this.skValidator,
      params.account,
      params.keyX,
      params.keyY,
      buildSessionStruct(params)
    );
  }

  /**
   * Query a P256 session key state (decodes the 8-field Session tuple).
   * @param keyHash The keccak256 hash of (keyX, keyY) used as the on-chain session id.
   */
  async getP256Session(account: string, keyHash: string): Promise<SessionInfo> {
    const session = await this.skValidator.read.getP256Session([account, keyHash]);
    return decodeSessionInfo(session);
  }

  /** Check if a P256 session is currently active. */
  async isP256SessionActive(account: string, keyX: string, keyY: string): Promise<boolean> {
    return this.skValidator.read.isP256SessionActive([account, keyX, keyY]) as Promise<boolean>;
  }

  /**
   * Encode calldata for a P256/passkey session grant.
   *
   * - **With ownerSig** → `grantP256Session()` — for gasless/UserOp flows.
   *   Owner signs the buildP256GrantHash() digest via KMS `sign-p256-grant-session`,
   *   then the relayer calls `grantP256Session(account, keyX, keyY, cfg, ownerSig)` on-chain.
   *   This is the ONLY path for ERC-4337 sponsored / gasless P256 grant flows.
   *
   * - **Without ownerSig** → `grantP256SessionDirect()` — **owner EOA direct-send only**.
   *   Since v0.17.2 round 3, `grantP256SessionDirect` requires `msg.sender == ownerOf(account)`.
   *   It does NOT accept `msg.sender == account` (removed in round 3 — confused-deputy fix).
   *   Do NOT encode this for a UserOp callData; the EntryPoint is not the owner EOA.
   */
  encodeGrantP256Session(params: GrantP256SessionParams): string {
    const cfg = buildSessionStruct(params);
    if (params.ownerSig) {
      return encodeFunctionData({
        abi: SESSION_KEY_VALIDATOR_VIEM_ABI,
        functionName: "grantP256Session",
        args: [params.account, params.keyX, params.keyY, cfg, params.ownerSig],
      });
    }
    // grantP256SessionDirect — owner EOA direct tx only (NOT for UserOp/gasless flows).
    return encodeFunctionData({
      abi: SESSION_KEY_VALIDATOR_VIEM_ABI,
      functionName: "grantP256SessionDirect",
      args: [params.account, params.keyX, params.keyY, cfg],
    });
  }

  /** Encode calldata for revokeP256Session(). */
  encodeRevokeP256Session(account: string, keyX: string, keyY: string): string {
    return encodeFunctionData({
      abi: SESSION_KEY_VALIDATOR_VIEM_ABI,
      functionName: "revokeP256Session",
      args: [account, keyX, keyY],
    });
  }

  // ── M7: Agent Session Keys (DEPRECATED — no deployed contract, #282) ──
  //
  // These methods target a phantom `AgentSessionKeyValidator` (grantAgentSession/delegateSession/…)
  // that does NOT exist on-chain (airaccount-contract v0.27.0, Seeder CC-16). They previously produced
  // calldata / reads that revert against a real deployment. They now FAIL CLOSED (throw) so callers get
  // a clear error instead of a silent on-chain revert. Use the M6 methods (grantSession /
  // grantP256Session) with a scoped Session for agent delegation. Removed in the next major.

  /** @deprecated No AgentSessionKeyValidator is deployed (#282) — throws. Use {@link encodeGrantSession} with a scoped Session. */
  encodeGrantAgentSession(_sessionKey: string, _cfg: AgentSessionConfig): string {
    return agentSessionUnsupported("encodeGrantAgentSession");
  }

  /** @deprecated No AgentSessionKeyValidator is deployed (#282) — throws. */
  encodeDelegateSession(_account: string, _subKey: string, _subCfg: AgentSessionConfig): string {
    return agentSessionUnsupported("encodeDelegateSession");
  }

  /** @deprecated No AgentSessionKeyValidator is deployed (#282) — throws. Use {@link encodeRevokeSession}. */
  encodeRevokeAgentSession(_sessionKey: string): string {
    return agentSessionUnsupported("encodeRevokeAgentSession");
  }

  /** @deprecated No AgentSessionKeyValidator is deployed (#282) — throws. Use {@link getSession}. */
  async getAgentSession(_account: string, _sessionKey: string): Promise<AgentSessionInfo> {
    return agentSessionUnsupported("getAgentSession");
  }

  /** @deprecated No AgentSessionKeyValidator is deployed (#282) — throws. Use {@link isSessionActive}. */
  async isAgentSessionActive(_account: string, _sessionKey: string): Promise<boolean> {
    return agentSessionUnsupported("isAgentSessionActive");
  }

  /** @deprecated No AgentSessionKeyValidator is deployed (#282) — throws. */
  async getSessionKeyOwner(_sessionKey: string): Promise<string> {
    return agentSessionUnsupported("getSessionKeyOwner");
  }

  /** @deprecated No AgentSessionKeyValidator is deployed (#282) — throws. */
  async getDelegatedBy(_account: string, _subKey: string): Promise<string> {
    return agentSessionUnsupported("getDelegatedBy");
  }
}

// ─── UserOp Signature Packing (v0.17.2+) ────────────────────────

/**
 * Pack a secp256k1 session key signature into the 106-byte UserOp.signature format.
 *
 * Layout: [0x08][account(20)][sessionKey(20)][r(32)][s(32)][v(1)]
 *
 * @param account - The AirAccount address (20 bytes, with or without 0x)
 * @param sessionKey - The ephemeral EOA session key address (20 bytes)
 * @param signature - 65-byte hex signature from KMS sign-grant-session (R||S||V)
 * @returns 106-byte hex string (0x-prefixed) suitable as UserOp.signature
 */
export function packSecp256k1SessionSignature(
  account: string,
  sessionKey: string,
  signature: string
): string {
  const acc = account.startsWith("0x") ? account.slice(2) : account;
  const key = sessionKey.startsWith("0x") ? sessionKey.slice(2) : sessionKey;
  const sig = signature.startsWith("0x") ? signature.slice(2) : signature;

  if (acc.length !== 40) throw new Error("account must be 20 bytes (40 hex chars)");
  if (key.length !== 40) throw new Error("sessionKey must be 20 bytes (40 hex chars)");
  if (sig.length !== 130) throw new Error("signature must be 65 bytes (130 hex chars)");

  // [0x08][account(20)][sessionKey(20)][r(32)][s(32)][v(1)] = 106 bytes
  return `0x08${acc}${key}${sig}`;
}

/**
 * Pack a P256 session key signature into the 149-byte UserOp.signature format.
 *
 * Layout: [0x08][account(20)][keyX(32)][keyY(32)][r(32)][s(32)]
 *
 * @param account - The AirAccount address (20 bytes)
 * @param keyX - P256 public key X coordinate (32 bytes hex, without 0x)
 * @param keyY - P256 public key Y coordinate (32 bytes hex, without 0x)
 * @param signature - 64-byte hex signature from KMS sign-p256-grant-session (R||S, no V)
 * @returns 149-byte hex string (0x-prefixed) suitable as UserOp.signature
 */
export function packP256SessionSignature(
  account: string,
  keyX: string,
  keyY: string,
  signature: string
): string {
  const acc = account.startsWith("0x") ? account.slice(2) : account;
  const x = keyX.startsWith("0x") ? keyX.slice(2) : keyX;
  const y = keyY.startsWith("0x") ? keyY.slice(2) : keyY;
  const sig = signature.startsWith("0x") ? signature.slice(2) : signature;

  if (acc.length !== 40) throw new Error("account must be 20 bytes (40 hex chars)");
  if (x.length !== 64) throw new Error("keyX must be 32 bytes (64 hex chars)");
  if (y.length !== 64) throw new Error("keyY must be 32 bytes (64 hex chars)");
  if (sig.length !== 128) throw new Error("P256 signature must be 64 bytes (128 hex chars, R||S)");

  // [0x08][account(20)][keyX(32)][keyY(32)][r(32)][s(32)] = 149 bytes
  return `0x08${acc}${x}${y}${sig}`;
}
