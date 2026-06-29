import { hexToBytes } from "viem";
import { keccak256 } from "../../migration/viem/hashing";
import axios from "axios";

/**
 * Minimal guardian signer surface (was `ethers.Signer`): an external signer that
 * performs an EIP-191 personal-sign over raw bytes and returns a 0x-prefixed
 * 65-byte hex signature. Structural — any ethers/viem signer with this method fits.
 */
export interface GuardianSigner {
  signMessage(message: Uint8Array): Promise<string>;
}
import {
  BLSManager,
  BLSSignatureData,
  CumulativeT2SignatureData,
  CumulativeT3SignatureData,
} from "../../core/bls";
import { TierLevel } from "../../core/tier";
import { EthereumProvider } from "../providers/ethereum-provider";
import { IStorageAdapter } from "../interfaces/storage-adapter";
import { ISignerAdapter, SignerAuthContext } from "../interfaces/signer-adapter";
import { ILogger, ConsoleLogger } from "../interfaces/logger";
import { ServerConfig } from "../config";

/**
 * Raised when a DVT node (aNode YetAnotherAA-Validator ≥ v1.3.0, running with
 * `CONFIRM_ENABLED=true`) withholds its co-signature on a high-value op pending
 * out-of-band approval. The node returns `{ status: "pending_confirmation",
 * userOpHash }` instead of a signature; the withheld co-sign is released by
 * `POST /signature/confirm { userOpHash, token }` once the user approves over an
 * independent channel (single-use token, TTL, fail-closed). The SDK surfaces this
 * as a typed error rather than silently dropping the node so callers can drive the
 * confirm flow. Default-off nodes never emit this (behaviour == v1.2.0).
 */
export class DvtPendingConfirmationError extends Error {
  constructor(
    public readonly userOpHash: string,
    public readonly nodeEndpoint: string
  ) {
    super(
      `DVT node ${nodeEndpoint} withheld its co-signature pending out-of-band ` +
        `confirmation for userOpHash ${userOpHash}; release it via POST /signature/confirm.`
    );
    this.name = "DvtPendingConfirmationError";
  }
}

/**
 * Type guard for a DVT v1.3.0 `/signature/sign` response that withheld its
 * co-signature pending out-of-band confirmation (`{ status: "pending_confirmation",
 * userOpHash }`). Used at every sign call site so a high-value-op withhold is
 * surfaced, not mistaken for a signature-less failure. Default-off nodes never
 * return this shape.
 */
export function isPendingConfirmation(
  data: unknown
): data is { status: "pending_confirmation"; userOpHash?: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { status?: unknown }).status === "pending_confirmation"
  );
}

/**
 * BLS signature service — extracted from NestJS BlsService.
 * Uses lazy initialization instead of onModuleInit.
 */
export class BLSSignatureService {
  private blsManager: BLSManager | null = null;
  private readonly logger: ILogger;

  constructor(
    private readonly config: ServerConfig,
    private readonly ethereum: EthereumProvider,
    private readonly storage: IStorageAdapter,
    private readonly signer: ISignerAdapter,
    logger?: ILogger
  ) {
    this.logger = logger ?? new ConsoleLogger("[BLSSignatureService]");
  }

  /** Lazy-initialize BLSManager on first use. */
  private async ensureInitialized(): Promise<BLSManager> {
    if (this.blsManager) return this.blsManager;

    const blsConfig = await this.storage.getBlsConfig();
    const seedNodes =
      this.config.blsSeedNodes ?? blsConfig?.discovery?.seedNodes?.map(n => n.endpoint) ?? [];

    this.blsManager = new BLSManager({
      seedNodes,
      discoveryTimeout: this.config.blsDiscoveryTimeout ?? 10000,
    });

    return this.blsManager;
  }

  async getActiveSignerNodes(): Promise<unknown[]> {
    const manager = await this.ensureInitialized();
    const nodes = await manager.getAvailableNodes();

    if (nodes.length > 0) {
      try {
        await this.storage.updateSignerNodesCache(nodes);
      } catch {
        // Non-critical
      }
    }

    return nodes;
  }

  async generateBLSSignature(
    userId: string,
    userOpHash: string,
    ctx?: SignerAuthContext,
    options?: {
      /**
       * Skip the owner ECDSA over `userOpHash` (`aaSignature`). The cumulative
       * Tier-2 (algId 0x04) / Tier-3 (0x05) packings do NOT include it — they
       * carry only `messagePointSignature` (owner intent comes from the P256
       * passkey signature) — so computing it there is a wasted owner signature.
       * Under the WebAuthn-ceremony KMS path that wasted signature is also a
       * wasted user gesture, so tiered callers set this to `true`.
       */
      skipOwnerOpSignature?: boolean;
    }
  ): Promise<BLSSignatureData> {
    const manager = await this.ensureInitialized();

    const activeNodes = await this.getActiveSignerNodes();
    if (activeNodes.length < 1) {
      throw new Error("No active BLS signer nodes available");
    }

    const selectedNodes = activeNodes.slice(0, Math.min(3, activeNodes.length)) as Array<{
      apiEndpoint: string;
    }>;

    const signerNodeSignatures: string[] = [];
    const signerNodeIds: string[] = [];

    for (const node of selectedNodes) {
      try {
        const response = await axios.post(`${node.apiEndpoint}/signature/sign`, {
          message: userOpHash,
        });

        // DVT v1.3.0: a CONFIRM_ENABLED node withholds its co-sign on a high-value
        // op until out-of-band approval. Surface it instead of treating the
        // signature-less response as a node failure to be skipped.
        if (isPendingConfirmation(response.data)) {
          throw new DvtPendingConfirmationError(response.data.userOpHash ?? userOpHash, node.apiEndpoint);
        }

        const signatureForAggregation = response.data.signatureCompact || response.data.signature;
        const formatted = signatureForAggregation.startsWith("0x")
          ? signatureForAggregation
          : `0x${signatureForAggregation}`;

        signerNodeSignatures.push(formatted);
        signerNodeIds.push(response.data.nodeId);
      } catch (err) {
        if (err instanceof DvtPendingConfirmationError) throw err;
        // Continue with other nodes
      }
    }

    if (signerNodeSignatures.length === 0) {
      throw new Error("Failed to get signatures from any BLS signer nodes");
    }

    let aggregatedSignature: string;
    if (signerNodeSignatures.length > 1) {
      const aggregateResponse = await axios.post(
        `${selectedNodes[0].apiEndpoint}/signature/aggregate`,
        { signatures: signerNodeSignatures }
      );
      aggregatedSignature = aggregateResponse.data.signature.startsWith("0x")
        ? aggregateResponse.data.signature
        : `0x${aggregateResponse.data.signature}`;
    } else {
      // Single signature — re-request in EIP format
      const singleSignResponse = await axios.post(
        `${selectedNodes[0].apiEndpoint}/signature/sign`,
        { message: userOpHash }
      );
      if (isPendingConfirmation(singleSignResponse.data)) {
        throw new DvtPendingConfirmationError(
          singleSignResponse.data.userOpHash ?? userOpHash,
          selectedNodes[0].apiEndpoint
        );
      }
      aggregatedSignature = singleSignResponse.data.signature.startsWith("0x")
        ? singleSignResponse.data.signature
        : `0x${singleSignResponse.data.signature}`;
    }

    // Generate message point
    const messagePoint = await manager.generateMessagePoint(userOpHash);

    // Get user account and wallet for ECDSA signatures
    const account = await this.storage.findAccountByUserId(userId);
    if (!account) {
      throw new Error(`User account not found for userId: ${userId}`);
    }

    const walletAddress = await this.signer.getAddress(userId);

    if (walletAddress.toLowerCase() !== account.signerAddress.toLowerCase()) {
      throw new Error(
        `Wallet address mismatch! Wallet: ${walletAddress}, Expected: ${account.signerAddress}`
      );
    }

    // `aaSignature` (owner ECDSA over userOpHash) is only consumed by the legacy
    // non-tiered packSignature format; Tier-2/3 packings omit it. Skip it for
    // tiered callers to avoid a wasted owner signature (and, under the ceremony
    // KMS path, a wasted user gesture). Empty string is safe: the tiered packers
    // never read it.
    const aaSignature = options?.skipOwnerOpSignature
      ? "0x"
      : await this.signer.signMessage(userId, hexToBytes(userOpHash as `0x${string}`), ctx);
    const messagePointHash = keccak256(messagePoint as `0x${string}`);
    const messagePointSignature = await this.signer.signMessage(
      userId,
      hexToBytes(messagePointHash as `0x${string}`),
      ctx
    );

    return {
      nodeIds: signerNodeIds,
      signature: aggregatedSignature,
      messagePoint,
      aaAddress: account.signerAddress,
      aaSignature,
      messagePointSignature,
    };
  }

  async packSignature(blsData: BLSSignatureData): Promise<string> {
    // The legacy non-tiered format embeds the owner ECDSA over userOpHash. Reject a
    // signature produced with `skipOwnerOpSignature` (aaSignature === "0x"), which is
    // only valid for the Tier-2/3 packers that omit it — otherwise this would silently
    // pack an invalid signature.
    if (!blsData.aaSignature || blsData.aaSignature === "0x") {
      throw new Error(
        "packSignature requires aaSignature; this BLSSignatureData was generated with " +
          "skipOwnerOpSignature (Tier-2/3 only). Use packCumulativeT2/T3Signature instead."
      );
    }
    const manager = await this.ensureInitialized();
    return manager.packSignature(blsData);
  }

  // ── Tiered Signature Support (M4) ─────────────────────────────

  /**
   * Generate a tiered signature based on the required tier level.
   *
   * - Tier 1: raw 65-byte ECDSA (no algId prefix, backwards-compat)
   * - Tier 2: algId 0x04 — P256 + BLS aggregate + messagePoint ECDSA
   * - Tier 3: algId 0x05 — P256 + BLS + messagePoint ECDSA + Guardian ECDSA
   *
   * @param tier - Required tier level (1, 2, or 3)
   * @param userId - User ID for account lookup
   * @param userOpHash - The UserOp hash to sign
   * @param p256Signature - P256 passkey signature (64 bytes, required for tier 2/3)
   * @param guardianSigner - Guardian signer (required for tier 3)
   * @param ctx - Optional passkey assertion context for KMS signing
   */
  async generateTieredSignature(params: {
    tier: TierLevel;
    userId: string;
    userOpHash: string;
    p256Signature?: string;
    guardianSigner?: GuardianSigner;
    ctx?: SignerAuthContext;
  }): Promise<string> {
    const { tier, userId, userOpHash, p256Signature, guardianSigner, ctx } = params;
    const manager = await this.ensureInitialized();

    if (tier === 1) {
      // Tier 1: raw ECDSA signature (65 bytes, no algId prefix)
      const account = await this.storage.findAccountByUserId(userId);
      if (!account) throw new Error(`User account not found for userId: ${userId}`);

      return this.signer.signMessage(userId, hexToBytes(userOpHash as `0x${string}`), ctx);
    }

    // Tier 2 and 3 both need BLS + P256
    if (!p256Signature) {
      throw new Error(`P256 signature required for Tier ${tier}`);
    }

    // Get BLS components (reuse existing generateBLSSignature for node signing + aggregation).
    // Tier-2/3 packings omit the owner ECDSA over userOpHash (aaSignature), so skip it —
    // saves one owner signature (and one WebAuthn ceremony gesture under the KMS ceremony path).
    const blsData = await this.generateBLSSignature(userId, userOpHash, ctx, {
      skipOwnerOpSignature: true,
    });

    // messagePoint / messagePointSignature are intentionally NOT included: contract issue #45 Fix 1
    // removed them from the cumulative format (the account recomputes the message point on-chain), so
    // the packed signature carries only P256 + the BLS [nodeIds][blsSig] block (+ guardian for T3).
    if (tier === 2) {
      const t2Data: CumulativeT2SignatureData = {
        p256Signature,
        nodeIds: blsData.nodeIds,
        blsSignature: blsData.signature,
      };
      return manager.packCumulativeT2Signature(t2Data);
    }

    // Tier 3: also needs guardian signature
    if (!guardianSigner) {
      throw new Error("Guardian signer required for Tier 3");
    }

    const guardianSignature = await guardianSigner.signMessage(
      hexToBytes(userOpHash as `0x${string}`)
    );

    const t3Data: CumulativeT3SignatureData = {
      p256Signature,
      nodeIds: blsData.nodeIds,
      blsSignature: blsData.signature,
      guardianSignature,
    };
    return manager.packCumulativeT3Signature(t3Data);
  }
}
