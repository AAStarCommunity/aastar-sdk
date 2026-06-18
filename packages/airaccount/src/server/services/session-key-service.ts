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
  AGENT_SESSION_KEY_VALIDATOR_ABI,
} from "../constants/entrypoint";
import { type ViemContract } from "../providers/ethereum-provider";
import { readBuildGrantHash, readBuildP256GrantHash } from "../providers/typed-reads";

// Parse the local human-readable ABIs once. Widened to `Abi` so viem treats the
// call args loosely (plain address strings / numbers) — matching the previous
// ethers.Interface ergonomics without per-call `0x${string}` casts.
const SESSION_KEY_VALIDATOR_VIEM_ABI = parseAbi(SESSION_KEY_VALIDATOR_ABI) as Abi;
const AGENT_SESSION_KEY_VALIDATOR_VIEM_ABI = parseAbi(AGENT_SESSION_KEY_VALIDATOR_ABI) as Abi;

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

// ─── M7 AgentSessionKeyValidator ─────────────────────────────────

export interface AgentSessionConfig {
  expiry: number;               // Unix timestamp
  velocityLimit: number;        // Max calls per velocityWindow (0 = unlimited)
  velocityWindow: number;       // Window in seconds
  callTargets: string[];        // Allowed dest addresses (empty = any)
  selectorAllowlist: string[];  // Allowed selectors (empty = any)
}

export interface AgentSessionInfo extends AgentSessionConfig {
  revoked: boolean;
  callCount: bigint;
  windowStart: bigint;
}

/**
 * SessionKeyService — manage M6 (basic) and M7 (agent) session keys.
 *
 * M6 SessionKeyValidator (algId=0x08):
 *   Simple time-limited ECDSA/P256 key with optional contract+selector scope.
 *   Used for standard delegated actions (hot wallet, automated tasks).
 *
 * M7 AgentSessionKeyValidator (algId=0x09):
 *   Rich session key for AI agents: velocity limits, spend caps, call allowlists,
 *   hierarchical delegation (parent → sub-agent with scope narrowing).
 */
export class SessionKeyService {
  private readonly skValidator: ViemContract;
  private readonly askValidator: ViemContract;

  constructor(
    provider: PublicClient,
    sessionKeyValidatorAddress: string,
    agentSessionKeyValidatorAddress: string,
  ) {
    this.skValidator = getContract({
      address: sessionKeyValidatorAddress as `0x${string}`,
      abi: SESSION_KEY_VALIDATOR_VIEM_ABI,
      client: provider,
    }) as unknown as ViemContract;
    this.askValidator = getContract({
      address: agentSessionKeyValidatorAddress as `0x${string}`,
      abi: AGENT_SESSION_KEY_VALIDATOR_VIEM_ABI,
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

  // ── M7: Agent Session Keys ────────────────────────────────────

  /**
   * Encode calldata for grantAgentSession().
   * Must be called from the account (via UserOp or direct execute).
   * The contract uses msg.sender as the account — no account param needed.
   */
  encodeGrantAgentSession(sessionKey: string, cfg: AgentSessionConfig): string {
    return encodeFunctionData({
      abi: AGENT_SESSION_KEY_VALIDATOR_VIEM_ABI,
      functionName: "grantAgentSession",
      args: [
        sessionKey,
        {
          expiry: cfg.expiry,
          velocityLimit: cfg.velocityLimit,
          velocityWindow: cfg.velocityWindow,
          revoked: false,
          callTargets: cfg.callTargets,
          selectorAllowlist: cfg.selectorAllowlist,
        },
      ],
    });
  }

  /**
   * Encode calldata for delegateSession() — sub-agent delegation.
   * The sub-agent config must be a strict subset of the parent session's scope.
   * Called by the parent session key (not the account owner).
   * @param account The smart account under which the parent session was granted.
   */
  encodeDelegateSession(account: string, subKey: string, subCfg: AgentSessionConfig): string {
    return encodeFunctionData({
      abi: AGENT_SESSION_KEY_VALIDATOR_VIEM_ABI,
      functionName: "delegateSession",
      args: [
        account,
        subKey,
        {
          expiry: subCfg.expiry,
          velocityLimit: subCfg.velocityLimit,
          velocityWindow: subCfg.velocityWindow,
          revoked: false,
          callTargets: subCfg.callTargets,
          selectorAllowlist: subCfg.selectorAllowlist,
        },
      ],
    });
  }

  /** Encode calldata for revokeAgentSession(). */
  encodeRevokeAgentSession(sessionKey: string): string {
    return encodeFunctionData({
      abi: AGENT_SESSION_KEY_VALIDATOR_VIEM_ABI,
      functionName: "revokeAgentSession",
      args: [sessionKey],
    });
  }

  /** Query agent session config + runtime state. */
  async getAgentSession(account: string, sessionKey: string): Promise<AgentSessionInfo> {
    // Multi-output view fns are returned by viem as a positional array.
    const [expiry, velocityLimit, velocityWindow, revoked, callTargets, selectorAllowlist] =
      (await this.askValidator.read.agentSessions([account, sessionKey])) as readonly unknown[];
    const [callCount, windowStart] =
      (await this.askValidator.read.sessionStates([account, sessionKey])) as readonly unknown[];
    return {
      expiry: Number(expiry),
      velocityLimit: Number(velocityLimit),
      velocityWindow: Number(velocityWindow),
      callTargets: callTargets as string[],
      selectorAllowlist: selectorAllowlist as string[],
      revoked: revoked as boolean,
      callCount: BigInt(callCount as bigint),
      windowStart: BigInt(windowStart as bigint),
    };
  }

  /** Check if an agent session is active (not expired, not revoked). */
  async isAgentSessionActive(account: string, sessionKey: string): Promise<boolean> {
    const session = await this.getAgentSession(account, sessionKey);
    return session.expiry > Math.floor(Date.now() / 1000) && !session.revoked;
  }

  /** Return the parent account of a delegated session key. */
  async getSessionKeyOwner(sessionKey: string): Promise<string> {
    return this.askValidator.read.sessionKeyOwner([sessionKey]) as Promise<string>;
  }

  /** Return the parent key that delegated to subKey, or ZeroAddress if not delegated. */
  async getDelegatedBy(account: string, subKey: string): Promise<string> {
    return this.askValidator.read.delegatedBy([account, subKey]) as Promise<string>;
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
