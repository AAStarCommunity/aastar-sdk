import { hexToBytes } from "viem";
import { keccak256 } from "../../migration/viem/hashing";
import axios from "axios";
import {
  BLSManager,
  BLSSignatureData,
  CumulativeT2SignatureData,
  CumulativeT3SignatureData,
} from "../../core/bls";
import {
  packWebAuthnBlob,
  packBlsPayload,
  packCumulativeT2WA,
  packCumulativeT3WA,
  packEcdsaAlgId,
} from "../../migration/viem/bls-packing";
import { TierLevel } from "../../core/tier";
import { EthereumProvider } from "../providers/ethereum-provider";
import { IStorageAdapter } from "../interfaces/storage-adapter";
import { ISignerAdapter, SignerAuthContext } from "../interfaces/signer-adapter";
import { ILogger, ConsoleLogger } from "../interfaces/logger";
import { ServerConfig } from "../config";

/**
 * Minimal guardian signer surface (was `ethers.Signer`): an external signer that
 * performs an EIP-191 personal-sign over raw bytes and returns a 0x-prefixed
 * 65-byte hex signature. Structural — any ethers/viem signer with this method fits.
 */
export interface GuardianSigner {
  signMessage(message: Uint8Array): Promise<string>;
}

/**
 * #257: transport payload the redeployed DVT (v1.7) requires on `/signature/sign`. `userOp` is the
 * PACKED ERC-4337 UserOperation in RPC (hex) form; `ownerAuth` is the owner's EIP-191 signature over
 * `userOpHash` (the DVT validates owner authorization before co-signing). Built by the SUBMIT flow and
 * threaded through the tiered-signature path as a pure transport credential — it is NOT part of the
 * on-chain composite signature.
 */
export interface DvtSignRequest {
  userOp: Record<string, unknown>;
  ownerAuth: string;
}

/**
 * Device WebAuthn assertion (the three `AuthenticatorAssertionResponse` fields the frontend gets
 * from `navigator.credentials.get()` with `challenge = userOpHash`). Used by the WebAuthn cumulative
 * Tier-2/3 path — the SDK derives the on-chain passkey factor (algId 0x09/0x0a) from it.
 */
export interface DeviceWebAuthnAssertion {
  authenticatorData: `0x${string}` | Uint8Array;
  clientDataJSON: `0x${string}` | Uint8Array | string;
  signature: `0x${string}` | Uint8Array; // DER-encoded P-256 signature
}

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
      /**
       * #257: the redeployed DVT (v1.7) validates OWNER AUTHORIZATION before co-signing, so the sign
       * request is `{ userOp, ownerAuth }` (ownerAuth = the owner's EIP-191 sig over userOpHash).
       * This is a TRANSPORT credential produced by the SUBMIT flow and threaded through — the composite
       * signature (P256 + BLS + guardian) does NOT include it and this method does NOT produce it.
       */
      dvtRequest?: DvtSignRequest;
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

    // ── COORDINATION SEAM (SDK-coordinator strategy) — #257 / P2P-migration ───────────────────────
    // Gather per-node BLS signatures and aggregate. Today the SDK is the coordinator (discover → fan
    // out → aggregate). A future P2P deployment (nodes self-discover + self-organize) swaps JUST this
    // call for a submit-once-to-the-network transport; everything below (message point, owner ECDSA,
    // the tiered packers, the contract format) is unchanged.
    const { nodeIds: signerNodeIds, signature: aggregatedSignature } =
      await this._coordinateBlsAggregate(selectedNodes, userOpHash, options?.dvtRequest);

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

    // `aaSignature` (owner ECDSA over userOpHash) and `messagePointSignature` are only consumed by the
    // legacy non-tiered packSignature format; the Tier-2/3 cumulative packings omit BOTH. Skip them for
    // tiered callers — beyond saving wasted signatures, under the KMS WebAuthn-ceremony path the ceremony
    // assertion is SINGLE-USE, and the submit flow already spends it on the DVT `ownerAuth`
    // (buildDvtRequest); a second ctx sign here would reuse a consumed assertion and fail (#258 review M1).
    // Empty strings are safe: the tiered packers never read either field.
    const aaSignature = options?.skipOwnerOpSignature
      ? "0x"
      : await this.signer.signMessage(userId, hexToBytes(userOpHash as `0x${string}`), ctx);
    const messagePointHash = keccak256(messagePoint as `0x${string}`);
    const messagePointSignature = options?.skipOwnerOpSignature
      ? "0x"
      : await this.signer.signMessage(userId, hexToBytes(messagePointHash as `0x${string}`), ctx);

    return {
      nodeIds: signerNodeIds,
      signature: aggregatedSignature,
      messagePoint,
      aaAddress: account.signerAddress,
      aaSignature,
      messagePointSignature,
    };
  }

  /**
   * COORDINATION SEAM (#257 / P2P-migration). The SDK-coordinator BLS transport: POST the sign request
   * to each selected node, then aggregate. The redeployed DVT (v1.7) rejects the legacy `{ message }`
   * body and validates OWNER AUTHORIZATION before co-signing, so the body is `{ userOp, ownerAuth }`
   * (`ownerAuth` = the owner's EIP-191 sig over userOpHash, produced by the submit flow — this layer
   * only transports it).
   *
   * This is the ONLY place that talks to the DVT nodes. A future P2P deployment (nodes self-discover +
   * self-organize) provides an alternative implementation of this single method — a submit-once-to-the-
   * network transport that returns the same `{ nodeIds, signature }` — with NO change to the composite
   * signature assembly, the tiered packers, or the contract format.
   */
  private async _coordinateBlsAggregate(
    selectedNodes: Array<{ apiEndpoint: string }>,
    userOpHash: string,
    dvtRequest?: DvtSignRequest
  ): Promise<{ nodeIds: string[]; signature: string }> {
    if (!dvtRequest) {
      throw new Error(
        "BLS signing requires a dvtRequest { userOp, ownerAuth } — the redeployed DVT (v1.7) validates " +
          "owner authorization before co-signing. Produce ownerAuth (owner EIP-191 over userOpHash) in the " +
          "submit flow and thread it through."
      );
    }
    const body = { userOp: dvtRequest.userOp, ownerAuth: dvtRequest.ownerAuth };

    const signerNodeSignatures: string[] = [];
    const signerNodeIds: string[] = [];
    for (const node of selectedNodes) {
      try {
        const response = await axios.post(`${node.apiEndpoint}/signature/sign`, body);
        // A CONFIRM_ENABLED node withholds its co-sign on a high-value op until out-of-band approval.
        if (isPendingConfirmation(response.data)) {
          throw new DvtPendingConfirmationError(response.data.userOpHash ?? userOpHash, node.apiEndpoint);
        }
        const sig = response.data.signatureCompact || response.data.signature;
        signerNodeSignatures.push(sig.startsWith("0x") ? sig : `0x${sig}`);
        signerNodeIds.push(response.data.nodeId);
      } catch (err) {
        if (err instanceof DvtPendingConfirmationError) throw err;
        // Node unreachable / rejected — continue with the others.
      }
    }

    if (signerNodeSignatures.length === 0) {
      throw new Error("Failed to get signatures from any BLS signer nodes");
    }

    if (signerNodeSignatures.length === 1) {
      // Single co-signer: its signature IS the aggregate.
      return { nodeIds: signerNodeIds, signature: signerNodeSignatures[0] };
    }
    const aggregateResponse = await axios.post(
      `${selectedNodes[0].apiEndpoint}/signature/aggregate`,
      { signatures: signerNodeSignatures }
    );
    const agg = aggregateResponse.data.signature;
    return { nodeIds: signerNodeIds, signature: agg.startsWith("0x") ? agg : `0x${agg}` };
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
   * - Tier 1: algId 0x02 — single ECDSA ([0x02][r][s][v] = 66 bytes). airaccount-contract
   *   v0.25.0 removed the raw-65 fallback, so the leading 0x02 is now REQUIRED (#273). This
   *   matches the Ledger path (auth/hardware/ledger.ts) and the compositeValidator ECDSA path.
   * - Tier 2: algId 0x04 — P256 + BLS aggregate (contract #45: no messagePoint/mpSig)
   * - Tier 3: algId 0x05 — P256 + BLS aggregate + Guardian ECDSA (contract #45: no messagePoint/mpSig)
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
    /** #257 transport: { userOp, ownerAuth } for the DVT — produced by the submit flow, threaded through. */
    dvtRequest?: DvtSignRequest;
  }): Promise<string> {
    const { tier, userId, userOpHash, p256Signature, guardianSigner, ctx, dvtRequest } = params;
    const manager = await this.ensureInitialized();

    if (tier === 1) {
      // Tier 1: single ECDSA, packed as [algId 0x02][r(32)][s(32)][v(1)] = 66 bytes.
      // airaccount-contract v0.25.0 dropped the raw-65 fallback, so the 0x02 algId prefix is
      // mandatory (#273); prior to that we returned the owner sig verbatim. packEcdsaAlgId validates
      // the signer returned a bare 65-byte sig (guards against double-prefixing).
      const account = await this.storage.findAccountByUserId(userId);
      if (!account) throw new Error(`User account not found for userId: ${userId}`);

      const rawEcdsa = await this.signer.signMessage(
        userId,
        hexToBytes(userOpHash as `0x${string}`),
        ctx
      );
      return packEcdsaAlgId(rawEcdsa as `0x${string}`);
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
      dvtRequest,
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

  /**
   * Generate a WebAuthn cumulative Tier-2/3 signature (algId 0x09 / 0x0a) from a DEVICE passkey
   * assertion — the integrator-zero-packing path (#234). The frontend runs one WebAuthn ceremony
   * with `challenge = userOpHash`; the SDK derives the on-chain passkey factor from the assertion,
   * fetches + aggregates the DVT BLS co-signatures itself, and packs the composite. No KMS owner
   * signature is involved (the device passkey IS the owner factor; cumulative = P256 + BLS [+ guardian]).
   *
   * @param tier 2 or 3 (tier 1 is plain ECDSA — not this path).
   * @param deviceWebAuthn the `navigator.credentials.get()` response fields (challenge MUST be userOpHash).
   * @param guardianSigner required for tier 3.
   */
  async generateWebAuthnTieredSignature(params: {
    tier: TierLevel;
    userId: string;
    userOpHash: string;
    deviceWebAuthn: DeviceWebAuthnAssertion;
    guardianSigner?: GuardianSigner;
    /**
     * #257 transport: { userOp, ownerAuth } for the DVT — the owner authorization the redeployed nodes
     * validate before co-signing. Produced by the SUBMIT flow (where owner authorization belongs) and
     * threaded through; it is NOT part of the on-chain composite (this function stays a pure composite
     * assembler — P256 + BLS + guardian).
     */
    dvtRequest?: DvtSignRequest;
  }): Promise<string> {
    const { tier, userId, userOpHash, deviceWebAuthn, guardianSigner, dvtRequest } = params;
    if (tier !== 2 && tier !== 3) {
      throw new Error(`generateWebAuthnTieredSignature: tier must be 2 or 3, got ${tier}`);
    }
    // Tier-3 needs a guardian — check BEFORE the DVT round-trip so a missing guardian fails fast
    // (no wasted /signature/sign network call). #240 PK finding.
    if (tier === 3 && !guardianSigner) {
      throw new Error("Guardian signer required for Tier 3 (WebAuthn)");
    }

    // 1) On-chain passkey factor from the device assertion (verifies challenge == userOpHash,
    //    decodes DER → r/s + low-S; throws in-SDK if the assertion doesn't bind userOpHash).
    const waBlob = packWebAuthnBlob(deviceWebAuthn, userOpHash as `0x${string}`);

    // 2) DVT BLS aggregate — fetched + aggregated by the SDK-coordinator (dvtRequest carries the owner
    //    authorization the nodes require). No owner ECDSA in the cumulative composite itself.
    const blsData = await this.generateBLSSignature(userId, userOpHash, undefined, {
      skipOwnerOpSignature: true,
      dvtRequest,
    });
    const blsPayload = packBlsPayload(blsData.nodeIds as `0x${string}`[], blsData.signature as `0x${string}`);

    if (tier === 2) {
      return packCumulativeT2WA(waBlob, blsPayload);
    }

    // 3) Tier 3 — guardian ECDSA over userOpHash (guardianSigner presence already checked above).
    const guardianSignature = await guardianSigner!.signMessage(hexToBytes(userOpHash as `0x${string}`));
    return packCumulativeT3WA(waBlob, blsPayload, guardianSignature as `0x${string}`);
  }
}
