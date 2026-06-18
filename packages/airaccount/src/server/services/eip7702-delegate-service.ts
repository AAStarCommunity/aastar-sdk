import { encodeFunctionData, type Abi, type Address, type Hex, type PublicClient } from "viem";
// DELEGATE_ABI is a local human-readable signature array (not in @aastar/core);
// parseAbi is required to feed it to viem encodeFunctionData / readContract during
// the ethers->viem migration.
// eslint-disable-next-line no-restricted-imports
import { parseAbi } from "viem";
import {
  buildAuthorizationHash as buildAuthorizationHashViem,
  verifyAuthorization as verifyAuthorizationViem,
} from "../../migration/viem/signatures";

// AirAccountDelegate ABI — subset for SDK use
const DELEGATE_ABI = [
  "function initialize(address guardian1, bytes calldata g1Sig, address guardian2, bytes calldata g2Sig, uint256 dailyLimit) external",
  "function owner() external view returns (address)",
  "function isInitialized() external view returns (bool)",
  "function entryPoint() external view returns (address)",
  "function getGuardians() external view returns (address[3] memory)",
  "function getDeposit() external view returns (uint256)",
  "function execute(address dest, uint256 value, bytes calldata data) external",
  "function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata data) external",
  "function validateUserOp((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) calldata userOp, bytes32 userOpHash, uint256 missingFunds) external returns (uint256)",
  "function initiateRescue(address rescueTo) external",
  "function approveRescue() external",
  "function cancelRescue() external",
  "function executeRescue() external",
  "function addDeposit() external payable",
  "function withdrawDepositTo(address to, uint256 amount) external",
  "error AlreadyInitialized()",
  "error NotInitialized()",
  "error InvalidAddress()",
  "error InvalidGuardianSignature()",
];

// Sepolia AirAccountDelegate singleton deployment (unchanged since beta.1)
export const AIR_ACCOUNT_DELEGATE_ADDRESS = "0x8603AAF6C3f07fdae810B323c95a198D796EC52E";

export interface DelegateInitParams {
  /** Guardian 1 address */
  guardian1: string;
  /** EIP-712 acceptance signature from guardian 1 */
  guardian1Sig: string;
  /** Guardian 2 address */
  guardian2: string;
  /** EIP-712 acceptance signature from guardian 2 */
  guardian2Sig: string;
  /** Daily ETH spend limit in wei */
  dailyLimit: bigint;
}

export interface EIP7702Authorization {
  /** Chain ID (e.g. 11155111 for Sepolia) */
  chainId: number;
  /** The delegation target — AirAccountDelegate singleton address */
  address: string;
  /** EOA nonce at time of signing */
  nonce: bigint;
  /** Signature over the EIP-7702 authorization hash (65 bytes, R||S||V) */
  signature: string;
}

/**
 * EIP7702DelegateService — Path A: SDK payload construction for AirAccountDelegate.
 *
 * Path A applies when the integrator controls the private key (KMS, server-side signer,
 * embedded wallet). The EOA signs a SET_CODE authorization offline; the integrator's relay
 * submits a Type-4 transaction to activate the delegation.
 *
 * This service does NOT submit transactions — it produces signed payloads for relay.
 *
 * Deployed address: AirAccountDelegate singleton at AIR_ACCOUNT_DELEGATE_ADDRESS (Sepolia).
 * The user's EOA address does NOT change — only its bytecode pointer changes to 0xef0100||addr.
 *
 * Usage:
 *   1. Build SET_CODE authorization payload (call signer.signAuthorization externally — viem)
 *   2. Build initialize() calldata for the first UserOp / direct tx
 *   3. Submit both via integrator's relay
 */
export class EIP7702DelegateService {
  /** Parsed ABI (loose viem `Abi` shape) used for encoding calldata and on-chain reads. */
  private readonly abi: Abi;
  /** Optional viem read client (was `ethers.Provider | ethers.Signer`). Required only for on-chain reads. */
  private readonly client?: PublicClient;

  constructor(
    private readonly delegateAddress: string = AIR_ACCOUNT_DELEGATE_ADDRESS,
    client?: PublicClient
  ) {
    this.abi = parseAbi(DELEGATE_ABI);
    this.client = client;
  }

  // ── Calldata encoders ─────────────────────────────────────────

  /**
   * Encode initialize() calldata for the first post-delegation UserOp.
   * Must be the callData of a UserOp sent immediately after the SET_CODE delegation activates.
   * Guardian acceptance sigs follow the same EIP-712 scheme as AirAccountV7 createAccount.
   */
  encodeInitialize(params: DelegateInitParams): string {
    return encodeFunctionData({
      abi: this.abi,
      functionName: "initialize",
      args: [
        params.guardian1,
        params.guardian1Sig,
        params.guardian2,
        params.guardian2Sig,
        params.dailyLimit,
      ],
    });
  }

  encodeExecute(dest: string, value: bigint, data: string): string {
    return encodeFunctionData({
      abi: this.abi,
      functionName: "execute",
      args: [dest, value, data],
    });
  }

  encodeExecuteBatch(
    dests: string[],
    values: bigint[],
    datas: string[]
  ): string {
    return encodeFunctionData({
      abi: this.abi,
      functionName: "executeBatch",
      args: [dests, values, datas],
    });
  }

  // ── EIP-7702 authorization hash construction ──────────────────

  /**
   * Compute the EIP-7702 SET_CODE authorization hash that the EOA must sign.
   *
   * Hash = keccak256(0x05 || RLP([chainId, address, nonce]))
   *
   * This is the hash the private key signs to delegate code execution to
   * AirAccountDelegate. Use this hash with your KMS sign-hash endpoint or
   * local viem account.
   *
   * @param chainId - Target chain ID (11155111 for Sepolia)
   * @param nonce - EOA's current transaction nonce
   * @returns 32-byte hash (0x-prefixed) ready for signing
   */
  buildAuthorizationHash(chainId: number, nonce: bigint): string {
    return buildAuthorizationHashViem(chainId, nonce, this.delegateAddress as Address);
  }

  /**
   * Build the full EIP-7702 authorization object for relay submission.
   * The caller must sign `buildAuthorizationHash()` externally and pass the result here.
   *
   * @param chainId - Target chain ID
   * @param nonce - EOA's current nonce
   * @param signature - 65-byte ECDSA signature (R||S||V) over the authorization hash
   */
  buildAuthorization(
    chainId: number,
    nonce: bigint,
    signature: string
  ): EIP7702Authorization {
    return {
      chainId,
      address: this.delegateAddress,
      nonce,
      signature,
    };
  }

  /**
   * Verify that a signature is a valid EIP-7702 authorization for the given EOA address.
   * Recovers the signer from the authorization hash and checks it matches `eoa`.
   *
   * NOTE: now async — viem's `recoverAddress` is asynchronous (ethers' was sync).
   */
  verifyAuthorization(
    eoa: string,
    chainId: number,
    nonce: bigint,
    signature: string
  ): Promise<boolean> {
    return verifyAuthorizationViem(
      eoa as Address,
      chainId,
      nonce,
      signature as Hex,
      this.delegateAddress as Address
    );
  }

  // ── On-chain reads (requires provider) ───────────────────────

  async isInitialized(eoa: string): Promise<boolean> {
    if (!this.client) throw new Error("EIP7702DelegateService: provider required for on-chain reads");
    return (await this.client.readContract({
      address: eoa as Address,
      abi: this.abi,
      functionName: "isInitialized",
    })) as boolean;
  }

  async getOwner(eoa: string): Promise<string> {
    if (!this.client) throw new Error("EIP7702DelegateService: provider required for on-chain reads");
    return (await this.client.readContract({
      address: eoa as Address,
      abi: this.abi,
      functionName: "owner",
    })) as string;
  }

  async getGuardians(eoa: string): Promise<[string, string, string]> {
    if (!this.client) throw new Error("EIP7702DelegateService: provider required for on-chain reads");
    return (await this.client.readContract({
      address: eoa as Address,
      abi: this.abi,
      functionName: "getGuardians",
    })) as [string, string, string];
  }
}
