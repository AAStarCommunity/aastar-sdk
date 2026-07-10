import type { Hex, Address } from 'viem';

/** Which class of node is being onboarded — the flow forks on where the BLS key lives. */
export type NodeKind = 'local' | 'kms-tee';

export type StepStatus = 'pending' | 'active' | 'doing' | 'done' | 'error';

export interface PortalConfig {
  network: 'sepolia' | 'op-sepolia';
  nodeKind: NodeKind;
  /** KMS base URL (only for kms-tee nodes), e.g. http://127.0.0.1:3100. */
  kmsUrl: string;
  /** Optional DVT service base URL for /recipe and /identity reads. */
  dvtUrl: string;
}

/** The PoP tuple, mirroring @aastar/sdk DvtPop. */
export interface Pop {
  publicKey: Hex;
  popPoint: Hex;
  popSig: Hex;
  nodeId: Hex;
}

export interface WalletConn {
  address: Address;
  chainId: number;
}
