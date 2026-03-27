// UserOpBridge — handles kind:23404 gasless UserOp trigger events.
// Validates the authorization signature and submits the ERC-4337 UserOperation
// to a bundler via an injected BundlerClientLike interface.

import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import type { SporeEventBridge, BridgeResult } from './SporeEventBridge.js';
import { SPORE_KIND_USEROP } from './SporeEventBridge.js';
import type { SignedNostrEvent } from '../types.js';
import type { NonceStore } from './NonceStore.js';
import { InMemoryNonceStore } from './NonceStore.js';

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
  /**
   * Nonce store for triggerNonce replay protection.
   * Defaults to InMemoryNonceStore (state lost on restart).
   * In production, inject a persistent store (SQLite, Redis, etc.).
   */
  nonceStore?: NonceStore;
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

  private readonly nonceStore: NonceStore;

  constructor(private readonly config: UserOpBridgeConfig) {
    this.nonceStore = config.nonceStore ?? new InMemoryNonceStore();
  }

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

    const { userOp, authorizationSig, triggerNonce } = content;

    // Step 1b: Verify authorizationSig — proves the sender authorized this specific UserOp.
    // Signing payload: keccak256(abi.encode(chainId, entryPoint, userOpHash, triggerNonce))
    // Skipped in 'open' mode (explicit no-auth, testing only).
    const authMode = this.config.authMode ?? 'self_only';
    if (authMode !== 'open') {
      if (!this.verifyAuthorizationSig(authorizationSig, userOp, entryPoint, Number(chainId), triggerNonce)) {
        return { success: false, error: 'invalid_authorization_sig' };
      }
    }

    // Step 2: Authorization mode check BEFORE nonce claim.
    // Checking auth mode first prevents an attacker from consuming a victim's triggerNonce
    // by submitting an event with an incorrect sender (denial-of-service on nonce).
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

    // Step 3: Atomic replay protection — claim nonce AFTER auth checks pass.
    // claim() is atomic: prevents TOCTOU under concurrent async stores.
    const nonceKey = `${chainId}:${triggerNonce}`;
    if (!(await this.nonceStore.claim(nonceKey))) {
      return { success: false, error: 'trigger_nonce_replayed' };
    }

    // Step 4: Prompt injection defense — contract and selector whitelist (unchanged)
    // callData layout for ERC-4337 execute(address target, uint256 value, bytes calldata data):
    //   [0:4]   selector of execute() itself  (0xb61d27f6 or similar)
    //   [4:36]  target address (padded to 32 bytes) → bytes [16:36] = 20-byte address
    //   [36:68] value (uint256)
    //   [68:]   inner calldata
    if (this.config.allowedSelectors !== undefined || this.config.allowedContracts !== undefined) {
      const callData = userOp['callData'] ?? '';
      const callBytes = hexToBytes(callData);

      // Extract the target contract from callData[4:36] (first ABI param = address, right-aligned)
      const target = callBytes.length >= 36
        ? ('0x' + Buffer.from(callBytes.slice(16, 36)).toString('hex')).toLowerCase()
        : userOp['sender']?.toLowerCase(); // fallback: sender itself

      // Extract the inner selector from callData[68:72]
      const innerSelector = callBytes.length >= 72
        ? '0x' + Buffer.from(callBytes.slice(68, 72)).toString('hex')
        : callData.slice(0, 10); // fallback: outer selector

      if (target && this.config.allowedContracts && !this.config.allowedContracts.has(target)) {
        return { success: false, error: 'contract_not_allowed' };
      }

      if (target && this.config.allowedSelectors) {
        const allowedForTarget = this.config.allowedSelectors.get(target);
        if (allowedForTarget !== undefined && !allowedForTarget.includes(innerSelector)) {
          return { success: false, error: 'selector_not_allowed' };
        }
      }
    }

    // Step 5: Submit UserOp to bundler (nonce already claimed in step 3)
    try {
      const { userOpHash } = await this.config.bundlerClient.sendUserOperation(
        userOp,
        entryPoint
      );

      // Nonce already claimed atomically in step 2 before submission
      return {
        success: true,
        txHash: userOpHash,
        replyContent: { success: true, userOpHash },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Verify the authorizationSig proves the account owner authorized this UserOp trigger.
   *
   * Signing payload per M2 spec:
   *   keccak256(chainId_32B || entryPoint_32B || userOpHash_32B || triggerNonce_32B)
   *
   * userOpHash = keccak256(sender || nonce || callData) — lightweight content hash
   * (not the full ERC-4337 on-chain hash; bundler validates the UserOp independently).
   */
  private verifyAuthorizationSig(
    authorizationSig: string,
    userOp: Record<string, string>,
    entryPoint: string,
    chainId: number,
    triggerNonce: string
  ): boolean {
    try {
      // Content hash of UserOp key fields — decoded from hex for case-insensitive matching
      const parts = [
        hexToBytes(userOp['sender'] ?? '0x'),
        hexToBytes(userOp['nonce'] ?? '0x'),
        hexToBytes(userOp['callData'] ?? '0x'),
      ];
      const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
      const combined = new Uint8Array(totalLen);
      let offset = 0;
      for (const part of parts) {
        combined.set(part, offset);
        offset += part.length;
      }
      const userOpHash = keccak_256(combined);

      // 128-byte signing payload: [chainId:32][entryPoint:32][userOpHash:32][triggerNonce:32]
      const payload = new Uint8Array(128);
      const chainView = new DataView(payload.buffer, 24, 8);
      chainView.setBigUint64(0, BigInt(chainId), false);
      const epBytes = hexToBytes(entryPoint);
      payload.set(epBytes.slice(-20), 44); // right-align 20-byte address in 32-byte slot
      payload.set(userOpHash, 64);
      const nonceBytes = hexToBytes(triggerNonce);
      payload.set(nonceBytes.slice(0, 32), 96);

      const digest = keccak_256(payload);

      // ecrecover
      const sigBytes = hexToBytes(authorizationSig);
      if (sigBytes.length !== 65) return false;
      const r = sigBytes.slice(0, 32);
      const s = sigBytes.slice(32, 64);
      const v = sigBytes[64]!;
      // EIP-155 recovery: 27 → 0, 28 → 1, otherwise raw
      let recovery: number;
      if (v === 27) recovery = 0;
      else if (v === 28) recovery = 1;
      else recovery = v;

      const sig = new secp256k1.Signature(bytesToBigInt(r), bytesToBigInt(s)).addRecoveryBit(recovery);
      const recoveredPubkey = sig.recoverPublicKey(digest).toRawBytes(false);
      const pubHash = keccak_256(recoveredPubkey.slice(1)); // keccak256(x || y)
      const recoveredAddress = '0x' + Buffer.from(pubHash.slice(12)).toString('hex');

      const sender = userOp['sender'] ?? '';
      return recoveredAddress.toLowerCase() === sender.toLowerCase();
    } catch {
      return false;
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const result = new Uint8Array(Math.ceil(h.length / 2));
  for (let i = 0; i < result.length; i++) {
    result[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return result;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) result = (result << 8n) | BigInt(byte);
  return result;
}
