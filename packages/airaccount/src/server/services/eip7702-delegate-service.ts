import { ethers } from "ethers";

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
 *   1. Build SET_CODE authorization payload (call signer.signAuthorization externally — viem/ethers)
 *   2. Build initialize() calldata for the first UserOp / direct tx
 *   3. Submit both via integrator's relay
 */
export class EIP7702DelegateService {
  private readonly iface: ethers.Interface;
  private readonly contract: ethers.Contract;

  constructor(
    private readonly delegateAddress: string = AIR_ACCOUNT_DELEGATE_ADDRESS,
    providerOrSigner?: ethers.Provider | ethers.Signer
  ) {
    this.iface = new ethers.Interface(DELEGATE_ABI);
    if (providerOrSigner) {
      this.contract = new ethers.Contract(delegateAddress, DELEGATE_ABI, providerOrSigner);
    } else {
      // Read-only placeholder — encoding methods still work without a provider
      this.contract = new ethers.Contract(delegateAddress, DELEGATE_ABI);
    }
  }

  // ── Calldata encoders ─────────────────────────────────────────

  /**
   * Encode initialize() calldata for the first post-delegation UserOp.
   * Must be the callData of a UserOp sent immediately after the SET_CODE delegation activates.
   * Guardian acceptance sigs follow the same EIP-712 scheme as AirAccountV7 createAccount.
   */
  encodeInitialize(params: DelegateInitParams): string {
    return this.iface.encodeFunctionData("initialize", [
      params.guardian1,
      params.guardian1Sig,
      params.guardian2,
      params.guardian2Sig,
      params.dailyLimit,
    ]);
  }

  encodeExecute(dest: string, value: bigint, data: string): string {
    return this.iface.encodeFunctionData("execute", [dest, value, data]);
  }

  encodeExecuteBatch(
    dests: string[],
    values: bigint[],
    datas: string[]
  ): string {
    return this.iface.encodeFunctionData("executeBatch", [dests, values, datas]);
  }

  // ── EIP-7702 authorization hash construction ──────────────────

  /**
   * Compute the EIP-7702 SET_CODE authorization hash that the EOA must sign.
   *
   * Hash = keccak256(0x05 || RLP([chainId, address, nonce]))
   *
   * This is the hash the private key signs to delegate code execution to
   * AirAccountDelegate. Use this hash with your KMS sign-hash endpoint or
   * local ethers Signer.
   *
   * @param chainId - Target chain ID (11155111 for Sepolia)
   * @param nonce - EOA's current transaction nonce
   * @returns 32-byte hash (0x-prefixed) ready for signing
   */
  buildAuthorizationHash(chainId: number, nonce: bigint): string {
    const encoded = ethers.encodeRlp([
      chainId === 0 ? "0x" : ethers.toBeHex(chainId),
      this.delegateAddress,
      nonce === 0n ? "0x" : ethers.toBeHex(nonce),
    ]);
    return ethers.keccak256(ethers.concat(["0x05", encoded]));
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
   */
  verifyAuthorization(
    eoa: string,
    chainId: number,
    nonce: bigint,
    signature: string
  ): boolean {
    const hash = this.buildAuthorizationHash(chainId, nonce);
    const recovered = ethers.recoverAddress(hash, signature);
    return recovered.toLowerCase() === eoa.toLowerCase();
  }

  // ── On-chain reads (requires provider) ───────────────────────

  async isInitialized(eoa: string): Promise<boolean> {
    const provider = this.contract.runner as ethers.Provider | null;
    if (!provider) throw new Error("EIP7702DelegateService: provider required for on-chain reads");
    const c = new ethers.Contract(eoa, DELEGATE_ABI, provider);
    return c.isInitialized() as Promise<boolean>;
  }

  async getOwner(eoa: string): Promise<string> {
    const provider = this.contract.runner as ethers.Provider | null;
    if (!provider) throw new Error("EIP7702DelegateService: provider required for on-chain reads");
    const c = new ethers.Contract(eoa, DELEGATE_ABI, provider);
    return c.owner() as Promise<string>;
  }

  async getGuardians(eoa: string): Promise<[string, string, string]> {
    const provider = this.contract.runner as ethers.Provider | null;
    if (!provider) throw new Error("EIP7702DelegateService: provider required for on-chain reads");
    const c = new ethers.Contract(eoa, DELEGATE_ABI, provider);
    return c.getGuardians() as Promise<[string, string, string]>;
  }
}
