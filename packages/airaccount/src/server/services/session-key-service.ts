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
  spendToken: string;           // address(0) = no spend cap
  spendCap: bigint;             // 0 = no cap
  callTargets: string[];        // Allowed dest addresses (empty = any)
  selectorAllowlist: string[];  // Allowed selectors (empty = any)
}

export interface AgentSessionInfo extends AgentSessionConfig {
  revoked: boolean;
  callCount: bigint;
  windowStart: bigint;
  totalSpent: bigint;
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
   * Encode calldata for grantSession() — submit via UserOp from the account.
   * ownerSig is the account owner's signature over buildGrantHash().
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
        spendToken: cfg.spendToken,
        spendCap: cfg.spendCap,
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
   */
  encodeDelegateSession(subKey: string, subCfg: AgentSessionConfig): string {
    const iface = new ethers.Interface(AGENT_SESSION_KEY_VALIDATOR_ABI);
    return iface.encodeFunctionData("delegateSession", [
      subKey,
      {
        expiry: subCfg.expiry,
        velocityLimit: subCfg.velocityLimit,
        velocityWindow: subCfg.velocityWindow,
        spendToken: subCfg.spendToken,
        spendCap: subCfg.spendCap,
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
    const [expiry, velocityLimit, velocityWindow, spendToken, spendCap, revoked, callTargets, selectorAllowlist] =
      await this.askValidator.agentSessions(account, sessionKey);
    const [callCount, windowStart, totalSpent] =
      await this.askValidator.sessionStates(account, sessionKey);
    return {
      expiry: Number(expiry),
      velocityLimit: Number(velocityLimit),
      velocityWindow: Number(velocityWindow),
      spendToken,
      spendCap: BigInt(spendCap),
      callTargets,
      selectorAllowlist,
      revoked,
      callCount: BigInt(callCount),
      windowStart: BigInt(windowStart),
      totalSpent: BigInt(totalSpent),
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
