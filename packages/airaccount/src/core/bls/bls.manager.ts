import axios from "axios";
import { ethers } from "ethers";
import { bls12_381 as bls } from "@noble/curves/bls12-381.js";
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
    if (!data.nodeIds || !data.aaSignature || !data.messagePointSignature) {
      throw new Error("Missing required signature components");
    }

    const nodeIdsLength = ethers.solidityPacked(["uint256"], [data.nodeIds.length]);
    const nodeIdsBytes = ethers.solidityPacked(
      Array(data.nodeIds.length).fill("bytes32"),
      data.nodeIds
    );

    return ethers.solidityPacked(
      ["bytes", "bytes", "bytes", "bytes", "bytes", "bytes"],
      [
        nodeIdsLength,
        nodeIdsBytes,
        data.signature,
        data.messagePoint,
        data.aaSignature,
        data.messagePointSignature,
      ]
    );
  }

  /**
   * Calculate the MessagePoint G2 point for a given message (UserOpHash)
   */
  async generateMessagePoint(message: string | Uint8Array): Promise<string> {
    const messageBytes = typeof message === "string" ? ethers.getBytes(message) : message;
    const DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";

    const messagePointBLS = await bls.G2.hashToCurve(messageBytes, { DST });
    const messageG2EIP = this.encodeG2Point(messagePointBLS);

    return "0x" + Buffer.from(messageG2EIP).toString("hex");
  }

  /**
   * Encode G2 Point to bytes for EIP-2537 format
   */
  private encodeG2Point(point: any): Uint8Array {
    const result = new Uint8Array(256);
    const affine = point.toAffine();

    const x0Bytes = this.hexToBytes(affine.x.c0.toString(16).padStart(96, "0"));
    const x1Bytes = this.hexToBytes(affine.x.c1.toString(16).padStart(96, "0"));
    const y0Bytes = this.hexToBytes(affine.y.c0.toString(16).padStart(96, "0"));
    const y1Bytes = this.hexToBytes(affine.y.c1.toString(16).padStart(96, "0"));

    result.set(x0Bytes, 16);
    result.set(x1Bytes, 80);
    result.set(y0Bytes, 144);
    result.set(y1Bytes, 208);
    return result;
  }

  private hexToBytes(hex: string): Uint8Array {
    if (hex.startsWith("0x")) hex = hex.slice(2);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
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
    const nodeIdsLength = ethers.solidityPacked(["uint256"], [data.nodeIds.length]);
    const nodeIdsBytes = ethers.solidityPacked(
      Array(data.nodeIds.length).fill("bytes32"),
      data.nodeIds
    );

    return ethers.solidityPacked(
      ["bytes1", "bytes", "bytes", "bytes", "bytes", "bytes", "bytes"],
      [
        "0x04",
        data.p256Signature,
        nodeIdsLength,
        nodeIdsBytes,
        data.blsSignature,
        data.messagePoint,
        data.messagePointSignature,
      ]
    );
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
    const nodeIdsLength = ethers.solidityPacked(["uint256"], [data.nodeIds.length]);
    const nodeIdsBytes = ethers.solidityPacked(
      Array(data.nodeIds.length).fill("bytes32"),
      data.nodeIds
    );

    return ethers.solidityPacked(
      ["bytes1", "bytes", "bytes", "bytes", "bytes", "bytes", "bytes", "bytes"],
      [
        "0x05",
        data.p256Signature,
        nodeIdsLength,
        nodeIdsBytes,
        data.blsSignature,
        data.messagePoint,
        data.messagePointSignature,
        data.guardianSignature,
      ]
    );
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
