import { ethers } from "ethers";
import {
  SESSION_KEY_VALIDATOR_ABI,
  AGENT_SESSION_KEY_VALIDATOR_ABI,
} from "../constants/entrypoint";

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
  /** Owner signature over buildGrantHash() — omit if calling directly from account */
  ownerSig?: string;
}

export interface SessionInfo {
  expiry: number;
  contractScope: string;
  selectorScope: string;
  revoked: boolean;
  active: boolean;
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
  private readonly provider: ethers.JsonRpcProvider;
  private readonly skValidator: ethers.Contract;
  private readonly askValidator: ethers.Contract;

  constructor(
    provider: ethers.JsonRpcProvider,
    sessionKeyValidatorAddress: string,
    agentSessionKeyValidatorAddress: string,
  ) {
    this.provider = provider;
    this.skValidator = new ethers.Contract(
      sessionKeyValidatorAddress,
      SESSION_KEY_VALIDATOR_ABI,
      provider,
    );
    this.askValidator = new ethers.Contract(
      agentSessionKeyValidatorAddress,
      AGENT_SESSION_KEY_VALIDATOR_ABI,
      provider,
    );
  }

  // ── M6: Basic Session Keys ────────────────────────────────────

  /**
   * Build the hash that the account owner must sign to grant a session key.
   * Use grantSession() with this sig, or grantSessionDirect() from the account itself.
   */
  async buildGrantHash(params: Omit<GrantSessionParams, "ownerSig">): Promise<string> {
    return this.skValidator.buildGrantHash(
      params.account,
      params.sessionKey,
      params.expiry,
      params.contractScope ?? ethers.ZeroAddress,
      params.selectorScope ?? "0x00000000",
    ) as Promise<string>;
  }

  /** Query an ECDSA session key state. */
  async getSession(account: string, sessionKey: string): Promise<SessionInfo> {
    const [expiry, contractScope, selectorScope, revoked] =
      await this.skValidator.sessions(account, sessionKey);
    const now = Math.floor(Date.now() / 1000);
    return {
      expiry: Number(expiry),
      contractScope,
      selectorScope,
      revoked,
      active: Number(expiry) > now && !revoked,
    };
  }

  /** Check if an ECDSA session is currently active. */
  async isSessionActive(account: string, sessionKey: string): Promise<boolean> {
    return this.skValidator.isSessionActive(account, sessionKey) as Promise<boolean>;
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
    const iface = new ethers.Interface(SESSION_KEY_VALIDATOR_ABI);
    if (params.ownerSig) {
      return iface.encodeFunctionData("grantSession", [
        params.account,
        params.sessionKey,
        params.expiry,
        params.contractScope ?? ethers.ZeroAddress,
        params.selectorScope ?? "0x00000000",
        params.ownerSig,
      ]);
    }
    // grantSessionDirect — owner EOA direct tx only (NOT for UserOp/gasless flows).
    return iface.encodeFunctionData("grantSessionDirect", [
      params.account,
      params.sessionKey,
      params.expiry,
      params.contractScope ?? ethers.ZeroAddress,
      params.selectorScope ?? "0x00000000",
    ]);
  }

  /** Encode calldata for revokeSession(). */
  encodeRevokeSession(account: string, sessionKey: string): string {
    const iface = new ethers.Interface(SESSION_KEY_VALIDATOR_ABI);
    return iface.encodeFunctionData("revokeSession", [account, sessionKey]);
  }

  // ── M7: Agent Session Keys ────────────────────────────────────

  /**
   * Encode calldata for grantAgentSession().
   * Must be called from the account (via UserOp or direct execute).
   * The contract uses msg.sender as the account — no account param needed.
   */
  encodeGrantAgentSession(sessionKey: string, cfg: AgentSessionConfig): string {
    const iface = new ethers.Interface(AGENT_SESSION_KEY_VALIDATOR_ABI);
    return iface.encodeFunctionData("grantAgentSession", [
      sessionKey,
      {
        expiry: cfg.expiry,
        velocityLimit: cfg.velocityLimit,
        velocityWindow: cfg.velocityWindow,
        revoked: false,
        callTargets: cfg.callTargets,
        selectorAllowlist: cfg.selectorAllowlist,
      },
    ]);
  }

  /**
   * Encode calldata for delegateSession() — sub-agent delegation.
   * The sub-agent config must be a strict subset of the parent session's scope.
   * Called by the parent session key (not the account owner).
   * @param account The smart account under which the parent session was granted.
   */
  encodeDelegateSession(account: string, subKey: string, subCfg: AgentSessionConfig): string {
    const iface = new ethers.Interface(AGENT_SESSION_KEY_VALIDATOR_ABI);
    return iface.encodeFunctionData("delegateSession", [
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
    ]);
  }

  /** Encode calldata for revokeAgentSession(). */
  encodeRevokeAgentSession(sessionKey: string): string {
    const iface = new ethers.Interface(AGENT_SESSION_KEY_VALIDATOR_ABI);
    return iface.encodeFunctionData("revokeAgentSession", [sessionKey]);
  }

  /** Query agent session config + runtime state. */
  async getAgentSession(account: string, sessionKey: string): Promise<AgentSessionInfo> {
    const [expiry, velocityLimit, velocityWindow, revoked, callTargets, selectorAllowlist] =
      await this.askValidator.agentSessions(account, sessionKey);
    const [callCount, windowStart] =
      await this.askValidator.sessionStates(account, sessionKey);
    return {
      expiry: Number(expiry),
      velocityLimit: Number(velocityLimit),
      velocityWindow: Number(velocityWindow),
      callTargets,
      selectorAllowlist,
      revoked,
      callCount: BigInt(callCount),
      windowStart: BigInt(windowStart),
    };
  }

  /** Check if an agent session is active (not expired, not revoked). */
  async isAgentSessionActive(account: string, sessionKey: string): Promise<boolean> {
    const session = await this.getAgentSession(account, sessionKey);
    return session.expiry > Math.floor(Date.now() / 1000) && !session.revoked;
  }

  /** Return the parent account of a delegated session key. */
  async getSessionKeyOwner(sessionKey: string): Promise<string> {
    return this.askValidator.sessionKeyOwner(sessionKey) as Promise<string>;
  }

  /** Return the parent key that delegated to subKey, or ZeroAddress if not delegated. */
  async getDelegatedBy(account: string, subKey: string): Promise<string> {
    return this.askValidator.delegatedBy(account, subKey) as Promise<string>;
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
