export interface BLSNode {
  index?: number;
  nodeId: string;
  nodeName: string;
  apiEndpoint: string;
  status: "active" | "inactive";
  publicKey?: string;
  lastSeen?: Date;
}

export interface BLSSignatureData {
  nodeIds: string[];
  signatures?: string[]; // Individual node signatures (before aggregation)
  publicKeys?: string[]; // Individual node public keys
  signature: string; // Aggregated BLS signature
  messagePoint: string;
  aaAddress: string;
  aaSignature: string; // ECDSA signature of userOpHash
  messagePointSignature: string; // ECDSA signature of messagePoint
  aggregatedSignature?: string; // Alias for aggregated signature
}

export interface BLSConfig {
  seedNodes: string[];
  discoveryTimeout?: number;
}

// ─── Cumulative Signature Data (M4) ────────────────────────────

/**
 * Data for cumulative Tier 2 signature (algId 0x04): P256 + BLS.
 */
export interface CumulativeT2SignatureData {
  p256Signature: string; // 64 bytes: [r(32)][s(32)]
  nodeIds: string[];
  blsSignature: string; // EIP-2537 aggregate BLS signature
  messagePoint: string; // EIP-2537 G2 message point
  messagePointSignature: string; // 65-byte ECDSA of keccak256(messagePoint)
}

/**
 * Data for cumulative Tier 3 signature (algId 0x05): P256 + BLS + Guardian.
 */
export interface CumulativeT3SignatureData extends CumulativeT2SignatureData {
  guardianSignature: string; // 65-byte ECDSA of userOpHash by guardian
}
