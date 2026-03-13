import { ethers } from "ethers";
import axios from "axios";
import {
  BLSManager,
  BLSSignatureData,
  CumulativeT2SignatureData,
  CumulativeT3SignatureData,
} from "../../core/bls";
import { TierLevel } from "../../core/tier";
import { EthereumProvider } from "../providers/ethereum-provider";
import { IStorageAdapter } from "../interfaces/storage-adapter";
import { ISignerAdapter, PasskeyAssertionContext } from "../interfaces/signer-adapter";
import { ILogger, ConsoleLogger } from "../interfaces/logger";
import { ServerConfig } from "../config";

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
    ctx?: PasskeyAssertionContext
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

        const signatureForAggregation = response.data.signatureCompact || response.data.signature;
        const formatted = signatureForAggregation.startsWith("0x")
          ? signatureForAggregation
          : `0x${signatureForAggregation}`;

        signerNodeSignatures.push(formatted);
        signerNodeIds.push(response.data.nodeId);
      } catch {
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

    const wallet = await this.signer.getSigner(userId, ctx);
    const walletAddress = await wallet.getAddress();

    if (walletAddress.toLowerCase() !== account.signerAddress.toLowerCase()) {
      throw new Error(
        `Wallet address mismatch! Wallet: ${walletAddress}, Expected: ${account.signerAddress}`
      );
    }

    const aaSignature = await wallet.signMessage(ethers.getBytes(userOpHash));
    const messagePointHash = ethers.keccak256(messagePoint);
    const messagePointSignature = await wallet.signMessage(ethers.getBytes(messagePointHash));

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
   * @param guardianSigner - Guardian ethers.Signer (required for tier 3)
   * @param ctx - Optional passkey assertion context for KMS signing
   */
  async generateTieredSignature(params: {
    tier: TierLevel;
    userId: string;
    userOpHash: string;
    p256Signature?: string;
    guardianSigner?: ethers.Signer;
    ctx?: PasskeyAssertionContext;
  }): Promise<string> {
    const { tier, userId, userOpHash, p256Signature, guardianSigner, ctx } = params;
    const manager = await this.ensureInitialized();

    if (tier === 1) {
      // Tier 1: raw ECDSA signature (65 bytes, no algId prefix)
      const account = await this.storage.findAccountByUserId(userId);
      if (!account) throw new Error(`User account not found for userId: ${userId}`);

      const wallet = await this.signer.getSigner(userId, ctx);
      return wallet.signMessage(ethers.getBytes(userOpHash));
    }

    // Tier 2 and 3 both need BLS + P256
    if (!p256Signature) {
      throw new Error(`P256 signature required for Tier ${tier}`);
    }

    // Get BLS components (reuse existing generateBLSSignature for node signing + aggregation)
    const blsData = await this.generateBLSSignature(userId, userOpHash, ctx);

    if (tier === 2) {
      const t2Data: CumulativeT2SignatureData = {
        p256Signature,
        nodeIds: blsData.nodeIds,
        blsSignature: blsData.signature,
        messagePoint: blsData.messagePoint,
        messagePointSignature: blsData.messagePointSignature,
      };
      return manager.packCumulativeT2Signature(t2Data);
    }

    // Tier 3: also needs guardian signature
    if (!guardianSigner) {
      throw new Error("Guardian signer required for Tier 3");
    }

    const guardianSignature = await guardianSigner.signMessage(ethers.getBytes(userOpHash));

    const t3Data: CumulativeT3SignatureData = {
      p256Signature,
      nodeIds: blsData.nodeIds,
      blsSignature: blsData.signature,
      messagePoint: blsData.messagePoint,
      messagePointSignature: blsData.messagePointSignature,
      guardianSignature,
    };
    return manager.packCumulativeT3Signature(t3Data);
  }
}
