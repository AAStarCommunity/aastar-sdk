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

    // #257/#258: each externally-reachable seed (e.g. https://dvt1.aastar.io) is ONE DVT node whose
    // registered `apiEndpoint` is its INTERNAL address (http://localhost:400x) — NOT reachable from an SDK
    // consumer. So we treat each SEED URL as the node's external apiEndpoint and iterate ALL seeds (the
    // old logic returned only the first seed's peer list → 1 localhost node → Tier-3 (needs >= 2) couldn't
    // aggregate).
    //
    // #258 review H1: dedupe by the EXTERNAL ENDPOINT, NEVER by a peer nodeId. The DVT has no self-identity
    // endpoint, and /gossip/peers is not guaranteed self-first, so picking a peer's nodeId as "this seed's
    // identity" can be wrong; keying nodes by that nodeId would then blacklist and silently drop a correct
    // seed. The nodeId here is ADVISORY metadata only — the authoritative per-node nodeId used for BLS
    // aggregation comes from each /signature/sign RESPONSE (see _coordinateBlsAggregate), so a best-effort
    // value cannot corrupt aggregation.
    const nodes: BLSNode[] = [];
    const seenEndpoints = new Set<string>();

    for (const seedEndpoint of seedNodes) {
      const endpoint = seedEndpoint.replace(/\/+$/, "");
      if (seenEndpoints.has(endpoint)) continue;
      try {
        const response = await axios.get(`${endpoint}/gossip/peers`, { timeout: discoveryTimeout });
        const peers: Array<{ status?: string; nodeId?: string; nodeName?: string; publicKey?: string }> =
          response.data.peers || [];
        // Require at least one ACTIVE BLS identity (nodeId + publicKey) so we don't add a dead endpoint.
        // Best-effort self identity: when the node reports a single active peer (the current DVT deployment)
        // it is unambiguous; otherwise the first active is advisory (authoritative nodeId comes from signing).
        const active = peers.filter((p) => p.status === "active" && p.nodeId && p.publicKey);
        if (active.length === 0) continue;
        const self = active[0];
        seenEndpoints.add(endpoint);
        nodes.push({
          index: nodes.length + 1, // 1-based ordering
          nodeId: self.nodeId,
          nodeName: self.nodeName,
          apiEndpoint: endpoint, // EXTERNAL seed URL, NOT the peer's localhost apiEndpoint
          status: "active",
          publicKey: self.publicKey,
        } as BLSNode);
      } catch {
        continue; // seed unreachable — try the next
      }
    }

    return nodes;
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
