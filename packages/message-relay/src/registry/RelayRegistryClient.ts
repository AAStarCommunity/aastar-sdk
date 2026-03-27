// RelayRegistryClient: on-chain interface for SporeRelayRegistry.sol (Optimism)
// Allows relay operators to register, update, deactivate, and query relay listings.

import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { optimism } from 'viem/chains';
import type { PrivateKeyAccount } from 'viem/accounts';

// ─── Types ────────────────────────────────────────────────────────────────

export interface RelayInfo {
  operator: `0x${string}`;
  wsUrl: string;
  minFeeUsdc: bigint;
  supportedKinds: number[];
  active: boolean;
  registeredAt: number;
  updatedAt: number;
}

export interface RegisterParams {
  wsUrl: string;
  minFeeUsdc: bigint;
  supportedKinds: number[];
}

// ─── ABI ──────────────────────────────────────────────────────────────────
// Minimal ABI for SporeRelayRegistry.sol (from M3 design doc)
const RELAY_REGISTRY_ABI = [
  {
    name: 'registerRelay',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'wsUrl', type: 'string' },
      { name: 'minFeeUsdc', type: 'uint256' },
      { name: 'supportedKinds', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    name: 'updateRelay',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'wsUrl', type: 'string' },
      { name: 'minFeeUsdc', type: 'uint256' },
      { name: 'supportedKinds', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    name: 'deactivateRelay',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'getActiveRelays',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'operator', type: 'address' },
          { name: 'wsUrl', type: 'string' },
          { name: 'minFeeUsdc', type: 'uint256' },
          { name: 'supportedKinds', type: 'uint256[]' },
          { name: 'active', type: 'bool' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'updatedAt', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'getMyRelays',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'operator', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'operator', type: 'address' },
          { name: 'wsUrl', type: 'string' },
          { name: 'minFeeUsdc', type: 'uint256' },
          { name: 'supportedKinds', type: 'uint256[]' },
          { name: 'active', type: 'bool' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'updatedAt', type: 'uint256' },
        ],
      },
    ],
  },
] as const;

// ─── Client ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPublicClient = PublicClient<any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWalletClient = WalletClient<any, any, any>;

export class RelayRegistryClient {
  private publicClient: AnyPublicClient;
  private account: PrivateKeyAccount | undefined;
  private rpcUrl: string;
  private registryAddress: `0x${string}`;

  constructor(
    registryAddress: `0x${string}`,
    rpcUrl: string,
    account?: PrivateKeyAccount
  ) {
    this.registryAddress = registryAddress;
    this.rpcUrl = rpcUrl;
    this.account = account;

    this.publicClient = createPublicClient({
      chain: optimism,
      transport: http(rpcUrl),
    }) as unknown as AnyPublicClient;
  }

  private getWalletClient(): AnyWalletClient {
    if (!this.account) {
      throw new Error('walletClient requires an account — pass a PrivateKeyAccount to the constructor');
    }
    return createWalletClient({
      account: this.account,
      chain: optimism,
      transport: http(this.rpcUrl),
    }) as AnyWalletClient;
  }

  /**
   * Register this relay on-chain.
   * @returns transaction hash
   */
  async register(params: RegisterParams): Promise<`0x${string}`> {
    const wc = this.getWalletClient();
    const { request } = await this.publicClient.simulateContract({
      account: this.account,
      address: this.registryAddress,
      abi: RELAY_REGISTRY_ABI,
      functionName: 'registerRelay',
      args: [params.wsUrl, params.minFeeUsdc, params.supportedKinds.map(BigInt)],
    });
    return wc.writeContract(request);
  }

  /**
   * Update an existing relay registration.
   * @returns transaction hash
   */
  async update(params: RegisterParams): Promise<`0x${string}`> {
    const wc = this.getWalletClient();
    const { request } = await this.publicClient.simulateContract({
      account: this.account,
      address: this.registryAddress,
      abi: RELAY_REGISTRY_ABI,
      functionName: 'updateRelay',
      args: [params.wsUrl, params.minFeeUsdc, params.supportedKinds.map(BigInt)],
    });
    return wc.writeContract(request);
  }

  /**
   * Deactivate the caller's relay registration.
   * @returns transaction hash
   */
  async deactivate(): Promise<`0x${string}`> {
    const wc = this.getWalletClient();
    const { request } = await this.publicClient.simulateContract({
      account: this.account,
      address: this.registryAddress,
      abi: RELAY_REGISTRY_ABI,
      functionName: 'deactivateRelay',
      args: [],
    });
    return wc.writeContract(request);
  }

  /**
   * Query paginated list of active relay registrations.
   */
  async getActiveRelays(offset = 0, limit = 20): Promise<RelayInfo[]> {
    const rows = await this.publicClient.readContract({
      address: this.registryAddress,
      abi: RELAY_REGISTRY_ABI,
      functionName: 'getActiveRelays',
      args: [BigInt(offset), BigInt(limit)],
    });
    return (rows as RawRelayRow[]).map(normalizeRow);
  }

  /**
   * Query relay registrations owned by a specific operator address.
   */
  async getMyRelays(operatorAddress: `0x${string}`): Promise<RelayInfo[]> {
    const rows = await this.publicClient.readContract({
      address: this.registryAddress,
      abi: RELAY_REGISTRY_ABI,
      functionName: 'getMyRelays',
      args: [operatorAddress],
    });
    return (rows as RawRelayRow[]).map(normalizeRow);
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────

interface RawRelayRow {
  operator: `0x${string}`;
  wsUrl: string;
  minFeeUsdc: bigint;
  supportedKinds: bigint[];
  active: boolean;
  registeredAt: bigint;
  updatedAt: bigint;
}

function normalizeRow(row: RawRelayRow): RelayInfo {
  return {
    operator: row.operator,
    wsUrl: row.wsUrl,
    minFeeUsdc: row.minFeeUsdc,
    supportedKinds: row.supportedKinds.map(Number),
    active: row.active,
    registeredAt: Number(row.registeredAt),
    updatedAt: Number(row.updatedAt),
  };
}
