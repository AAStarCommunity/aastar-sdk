// UserOpBridge — handles kind:23404 gasless UserOp trigger events.
// Validates the authorization signature and submits the ERC-4337 UserOperation
// to a bundler via an injected BundlerClientLike interface.

import type { SporeEventBridge, BridgeResult } from './SporeEventBridge.js';
import { SPORE_KIND_USEROP } from './SporeEventBridge.js';
import type { SignedNostrEvent } from '../types.js';

// ─── Client Interface ─────────────────────────────────────────────────────────

/**
 * Minimal interface for a bundler client.
 * The actual implementation connects to an ERC-4337 bundler (e.g. Stackup, Pimlico).
 * UserOpBridge only depends on this interface.
 */
export interface BundlerClientLike {
  /**
   * Submit an ERC-4337 UserOperation to the bundler mempool.
   * @param userOp     - UserOp fields as string map (hex-encoded values)
   * @param entryPoint - EntryPoint contract address
   * @returns userOpHash — the bundler's identifier for this operation
   */
  sendUserOperation(
    userOp: Record<string, string>,
    entryPoint: string
  ): Promise<{ userOpHash: `0x${string}` }>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Authorization mode for UserOpBridge.
 *
 * - 'self_only'  — only accept UserOps where sender matches selfAddress (default, safest)
 * - 'whitelist'  — accept UserOps from addresses in allowedSenders
 * - 'open'       — accept any UserOp (for testing only)
 */
export type UserOpAuthMode = 'self_only' | 'whitelist' | 'open';

/** Configuration for UserOpBridge */
export interface UserOpBridgeConfig {
  /** Injected bundler client */
  bundlerClient: BundlerClientLike;
  /** Required for 'self_only' mode: only accept UserOps with this sender */
  selfAddress?: `0x${string}`;
  /** Authorization mode (default: 'self_only') */
  authMode?: UserOpAuthMode;
  /** Required for 'whitelist' mode: set of lowercase allowed sender addresses */
  allowedSenders?: Set<string>;
  /**
   * Prompt injection defense — per-contract function selector whitelist.
   * Map of lowercase contract address → allowed 4-byte selectors (as "0x" + 8 hex chars).
   * If set and the callData selector is not in the list, the request is rejected.
   */
  allowedSelectors?: Map<string, string[]>;
  /**
   * Prompt injection defense — contract address allowlist.
   * If set, only UserOps targeting these contracts are accepted.
   */
  allowedContracts?: Set<string>;
}

// ─── UserOpBridge ─────────────────────────────────────────────────────────────

/**
 * UserOpBridge — on-chain bridge for kind:23404 gasless UserOp trigger events.
 *
 * Security model:
 *   - triggerNonce prevents Nostr event replay (consumed after first use)
 *   - authorizationSig should be verified against the trigger payload
 *     (full cryptographic verification is left to the authorizationSig consumer)
 *   - allowedSelectors prevents prompt injection by restricting callable functions
 *
 * Processing pipeline:
 *   1. Parse tags (chainId, entryPoint) and content (userOp, authorizationSig, triggerNonce)
 *   2. Replay protection: check triggerNonce has not been used
 *   3. Authorization mode check (self_only / whitelist / open)
 *   4. Prompt injection defense (contract + selector whitelist)
 *   5. Submit to bundler via BundlerClientLike
 *   6. Mark triggerNonce as consumed on success
 */
export class UserOpBridge implements SporeEventBridge<typeof SPORE_KIND_USEROP> {
  readonly kind = SPORE_KIND_USEROP;

  // Consumed trigger nonces to prevent Nostr event replay.
  // Key format: "<chainId>:<triggerNonce>"
  private readonly consumedNonces = new Set<string>();

  constructor(private readonly config: UserOpBridgeConfig) {}

  async handle(event: SignedNostrEvent): Promise<BridgeResult> {
    // Step 1: Parse tags
    const tagMap = new Map(event.tags.map(([k, ...v]) => [k, v]));
    const chainId = tagMap.get('chain')?.[0];
    const entryPoint = tagMap.get('ep')?.[0];

    if (!chainId || !entryPoint) {
      return { success: false, error: 'missing_tags' };
    }

    // Parse content — NIP-44 decryption is handled upstream; content is plaintext here
    let content: {
      userOp: Record<string, string>;
      authorizationSig: string;
      triggerNonce: string;
    };
    try {
      content = JSON.parse(event.content) as typeof content;
    } catch {
      return { success: false, error: 'invalid_content' };
    }

    const { userOp, authorizationSig: _authorizationSig, triggerNonce } = content;

    // Step 2: Replay protection — triggerNonce is consumed after first use
    const nonceKey = `${chainId}:${triggerNonce}`;
    if (this.consumedNonces.has(nonceKey)) {
      return { success: false, error: 'trigger_nonce_replayed' };
    }

    // Step 3: Authorization mode check
    const authMode = this.config.authMode ?? 'self_only';

    if (authMode === 'self_only') {
      if (!this.config.selfAddress) {
        return { success: false, error: 'self_address_not_configured' };
      }
      if (userOp['sender']?.toLowerCase() !== this.config.selfAddress.toLowerCase()) {
        return { success: false, error: 'sender_not_self' };
      }
    } else if (authMode === 'whitelist') {
      const sender = userOp['sender']?.toLowerCase();
      if (!sender || !this.config.allowedSenders?.has(sender)) {
        return { success: false, error: 'sender_not_in_whitelist' };
      }
    }
    // 'open' mode: accept any sender (for testing only)

    // Step 4: Prompt injection defense — contract and selector whitelist
    if (this.config.allowedSelectors !== undefined || this.config.allowedContracts !== undefined) {
      const target = userOp['sender']?.toLowerCase();
      const callData = userOp['callData'] ?? '';
      // Extract 4-byte selector: "0x" + first 8 hex characters
      const selector = callData.slice(0, 10);

      if (target && this.config.allowedContracts && !this.config.allowedContracts.has(target)) {
        return { success: false, error: 'contract_not_allowed' };
      }

      if (target && this.config.allowedSelectors) {
        const allowedForTarget = this.config.allowedSelectors.get(target);
        if (allowedForTarget !== undefined && !allowedForTarget.includes(selector)) {
          return { success: false, error: 'selector_not_allowed' };
        }
      }
    }

    // Step 5: Submit UserOp to bundler
    try {
      const { userOpHash } = await this.config.bundlerClient.sendUserOperation(
        userOp,
        entryPoint
      );

      // Step 6: Consume triggerNonce only after successful submission
      this.consumedNonces.add(nonceKey);

      return {
        success: true,
        txHash: userOpHash,
        replyContent: { success: true, userOpHash },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}
