/**
 * eip1193.ts — EIP-1193 compatible provider wrapping AirAccount M7.
 *
 * Intercepts eth_sendTransaction and converts it to an ERC-4337 v0.7
 * PackedUserOperation submitted to the bundler via eth_sendUserOperation.
 * All other JSON-RPC methods are forwarded to the public RPC.
 */

import {
  createPublicClient,
  encodeFunctionData,
  hashMessage,
  hashTypedData,
  hexToBytes,
  http,
  type Address,
  type Hex,
} from "viem";

// AirAccount execute() — ERC-4337 smart account entry point for single calls
const EXECUTE_ABI = [
  {
    name: "execute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dest", type: "address" },
      { name: "value", type: "uint256" },
      { name: "func", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

// EntryPoint v0.7 getNonce + getUserOpHash
const ENTRYPOINT_ABI = [
  {
    name: "getNonce",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "sender", type: "address" },
      { name: "key", type: "uint192" },
    ],
    outputs: [{ name: "nonce", type: "uint256" }],
  },
  {
    name: "getUserOpHash",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "packedUserOp",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [{ type: "bytes32" }],
  },
] as const;

const DEFAULT_ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;

export interface AirAccountProviderConfig {
  /** EVM chain ID */
  chainId: number;
  /** Public JSON-RPC URL */
  rpcUrl: string;
  /** ERC-4337 bundler URL */
  bundlerUrl: string;
  /** EntryPoint v0.7 address (defaults to canonical) */
  entryPoint?: Address;
  /** The user's AirAccount smart contract address */
  accountAddress: Address;
  /**
   * Signs the UserOp hash and returns a 65-byte hex signature.
   * For passkey/ECDSA, format as M7 composite validator signature.
   */
  signer: (userOpHash: Hex) => Promise<Hex>;
}

type EthSendTransactionParams = {
  from?: Address;
  to: Address;
  data?: Hex;
  value?: Hex;
  gas?: Hex;
};

/**
 * AirAccountEIP1193Provider — drop-in EIP-1193 wallet backed by an AirAccount M7 smart account.
 *
 * Usage:
 * ```ts
 * const provider = new AirAccountEIP1193Provider({
 *   chainId: 11155111,
 *   rpcUrl: 'https://rpc.sepolia.org',
 *   bundlerUrl: 'https://api.pimlico.io/v2/11155111/rpc?apikey=...',
 *   accountAddress: '0x...',
 *   signer: async (hash) => passkeySign(hash),
 * });
 * // Pass to wagmi, ethers.js BrowserProvider, or window.ethereum
 * ```
 */
export class AirAccountEIP1193Provider {
  private readonly config: AirAccountProviderConfig;
  private readonly client: ReturnType<typeof createPublicClient>;
  private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  constructor(config: AirAccountProviderConfig) {
    this.config = config;
    this.client = createPublicClient({ transport: http(config.rpcUrl) });
  }

  async request({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
    switch (method) {
      case "eth_chainId":
        return `0x${this.config.chainId.toString(16)}`;

      case "eth_accounts":
      case "eth_requestAccounts":
        return [this.config.accountAddress];

      case "eth_sendTransaction": {
        const tx = (params as [EthSendTransactionParams])[0];
        return this._sendTransaction(tx);
      }

      case "personal_sign": {
        // params: [hexData, address] — sign raw bytes with EIP-191 prefix
        const [data] = params as [Hex, Address];
        const hash = hashMessage({ raw: hexToBytes(data) });
        return this.config.signer(hash);
      }

      case "eth_signTypedData_v4": {
        // params: [address, typedDataJson] — sign EIP-712 typed data
        const [, typedDataJson] = params as [Address, string];
        const typedData = JSON.parse(typedDataJson) as {
          domain: Parameters<typeof hashTypedData>[0]["domain"];
          types: Parameters<typeof hashTypedData>[0]["types"];
          primaryType: string;
          message: Record<string, unknown>;
        };
        const hash = hashTypedData({
          domain: typedData.domain,
          types: typedData.types,
          primaryType: typedData.primaryType,
          message: typedData.message,
        });
        return this.config.signer(hash);
      }

      default:
        return this._forwardToRpc(method, params);
    }
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  }

  removeListener(event: string, listener: (...args: unknown[]) => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  // ── Private ──────────────────────────────────────────────────────

  private async _sendTransaction(tx: EthSendTransactionParams): Promise<Hex> {
    const entryPoint = this.config.entryPoint ?? DEFAULT_ENTRYPOINT;

    // Encode execute(to, value, data) for the AirAccount
    const callData = encodeFunctionData({
      abi: EXECUTE_ABI,
      functionName: "execute",
      args: [tx.to, BigInt(tx.value ?? "0x0"), tx.data ?? "0x"],
    });

    // Fetch nonce and gas fees in parallel
    const [nonce, feeData] = await Promise.all([
      this.client.readContract({
        address: entryPoint,
        abi: ENTRYPOINT_ABI,
        functionName: "getNonce",
        args: [this.config.accountAddress, 0n],
      }) as Promise<bigint>,
      this.client.estimateFeesPerGas(),
    ]);

    const maxFeePerGas = feeData.maxFeePerGas ?? 1_000_000_000n;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 100_000_000n;

    // Pack gas limits into bytes32 fields (ERC-4337 v0.7 packed format)
    const verificationGasLimit = 200_000n;
    const callGasLimit = BigInt(tx.gas ?? "0x30000");
    const accountGasLimits = `0x${((verificationGasLimit << 128n) | callGasLimit).toString(16).padStart(64, "0")}` as Hex;
    const gasFees = `0x${((maxPriorityFeePerGas << 128n) | maxFeePerGas).toString(16).padStart(64, "0")}` as Hex;

    const userOp = {
      sender: this.config.accountAddress,
      nonce,
      initCode: "0x" as Hex,
      callData,
      accountGasLimits,
      preVerificationGas: 50_000n,
      gasFees,
      paymasterAndData: "0x" as Hex,
      signature: "0x" as Hex,
    };

    // Get UserOp hash from EntryPoint
    const userOpHash = await this.client.readContract({
      address: entryPoint,
      abi: ENTRYPOINT_ABI,
      functionName: "getUserOpHash",
      args: [userOp],
    }) as Hex;

    // Sign and attach
    userOp.signature = await this.config.signer(userOpHash);

    // Submit to bundler
    const resp = await fetch(this.config.bundlerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendUserOperation",
        params: [
          {
            sender: userOp.sender,
            nonce: `0x${userOp.nonce.toString(16)}`,
            initCode: userOp.initCode,
            callData: userOp.callData,
            accountGasLimits: userOp.accountGasLimits,
            preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
            gasFees: userOp.gasFees,
            paymasterAndData: userOp.paymasterAndData,
            signature: userOp.signature,
          },
          entryPoint,
        ],
      }),
    });

    const result = (await resp.json()) as { result?: Hex; error?: { message: string } };
    if (result.error) throw new Error(result.error.message);
    return result.result!;
  }

  private async _forwardToRpc(method: string, params?: unknown[]): Promise<unknown> {
    const resp = await fetch(this.config.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
    });
    const result = (await resp.json()) as { result?: unknown; error?: { message: string } };
    if (result.error) throw new Error(result.error.message);
    return result.result;
  }
}
