import axios from "axios";
import {
  packSignature as packSignatureViem,
  packCumulativeT2Signature as packCumulativeT2SignatureViem,
  packCumulativeT3Signature as packCumulativeT3SignatureViem,
  generateMessagePoint as generateMessagePointViem,
} from "../../migration/viem/bls-packing";
import {
  BLSConfig,
  BLSNode,
  BLSSignatureData,
  CumulativeT2SignatureData,
  CumulativeT3SignatureData,
} from "./types";

export class BLSManager {
  private config: BLSConfig;

  constructor(config: BLSConfig) {
    this.config = config;
  }

  /**
   * Discover available BLS nodes from seed nodes (Gossip network)
   */
  async getAvailableNodes(): Promise<BLSNode[]> {
    const { seedNodes, discoveryTimeout = 5000 } = this.config;

    for (const seedEndpoint of seedNodes) {
      try {
        // Try to get peers from gossip endpoint
        const response = await axios.get(`${seedEndpoint}/gossip/peers`, {
          timeout: discoveryTimeout,
        });

        const peers = response.data.peers || [];

        // Filter active nodes with proper structure
        const activeNodes: BLSNode[] = peers
          .filter((p: any) => p.status === "active" && p.apiEndpoint && p.publicKey)
          .map((p: any, index: number) => ({
            index: index + 1, // 1-based index likely expected by contract if using bitmap
            nodeId: p.nodeId,
            nodeName: p.nodeName,
            apiEndpoint: p.apiEndpoint,
            status: "active",
            publicKey: p.publicKey,
          }));

        if (activeNodes.length > 0) {
          return activeNodes;
        }
      } catch {
        // Try next seed node
        continue;
      }
    }

    return [];
  }

  /**
   * Helper to pack the full signature for ERC-4337 UserOp
   * Format: [nodeIdsLength][nodeIds...][blsSignature][messagePoint][aaSignature][messagePointSignature]
   */
  packSignature(data: BLSSignatureData): string {
    // Delegates to the proven byte-exact viem implementation.
    return packSignatureViem(data);
  }

  /**
   * Calculate the MessagePoint G2 point for a given message (UserOpHash)
   */
  async generateMessagePoint(message: string | Uint8Array): Promise<string> {
    // Delegates to the proven byte-exact viem implementation.
    return generateMessagePointViem(message);
  }

  /**
   * Pack cumulative Tier 2 signature (algId 0x04): P256 + BLS.
   *
   * Format:
   *   [algId=0x04 (1)] [P256 r (32)] [P256 s (32)]
   *   [nodeIdsLength (32)] [nodeIds (N×32)]
   *   [blsAggregateSig (256)] [messagePoint (256)]
   *   [messagePointECDSA (65)]
   */
  packCumulativeT2Signature(data: CumulativeT2SignatureData): string {
    // Delegates to the proven byte-exact viem implementation.
    return packCumulativeT2SignatureViem(data);
  }

  /**
   * Pack cumulative Tier 3 signature (algId 0x05): P256 + BLS + Guardian.
   *
   * Format:
   *   [algId=0x05 (1)] [P256 r (32)] [P256 s (32)]
   *   [nodeIdsLength (32)] [nodeIds (N×32)]
   *   [blsAggregateSig (256)] [messagePoint (256)]
   *   [messagePointECDSA (65)] [guardianECDSA (65)]
   */
  packCumulativeT3Signature(data: CumulativeT3SignatureData): string {
    // Delegates to the proven byte-exact viem implementation.
    return packCumulativeT3SignatureViem(data);
  }

  /**
   * Request signature from a single node
   */
  async requestNodeSignature(
    node: BLSNode,
    message: string
  ): Promise<{ signature: string; publicKey: string }> {
    const response = await axios.post(`${node.apiEndpoint}/signature/sign`, {
      message,
    });

    const signatureEIP = response.data.signature;
    // Prefer compact if available, logic copied from legacy service
    const signature = response.data.signatureCompact || signatureEIP;

    return {
      signature: signature.startsWith("0x") ? signature : `0x${signature}`,
      publicKey: response.data.publicKey,
    };
  }

  /**
   * Request aggregation from a node
   */
  async aggregateSignatures(node: BLSNode, signatures: string[]): Promise<string> {
    const response = await axios.post(`${node.apiEndpoint}/signature/aggregate`, {
      signatures,
    });

    const sig = response.data.signature;
    return sig.startsWith("0x") ? sig : `0x${sig}`;
  }
}
