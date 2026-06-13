import { ethers } from "ethers";

// ForceExitModule ABI — minimal subset for SDK use
const FORCE_EXIT_ABI = [
  // ERC-7579 module lifecycle
  "function onInstall(bytes calldata data) external",
  "function onUninstall(bytes calldata data) external",
  "function isInitialized(address smartAccount) external view returns (bool)",
  // Proposal lifecycle
  "function proposeForceExit(address target, uint256 value, bytes calldata data) external",
  "function approveForceExit(address account, bytes calldata guardianSig) external",
  "function executeForceExit(address account) external",
  "function cancelForceExit(address account) external",
  // State readers
  "function getPendingExit(address account) external view returns (address target, uint256 value, bytes memory data, uint256 proposedAt, uint256 approvalBitmap, address[3] memory guardians)",
  "function accountL2Type(address account) external view returns (uint8)",
  // Constants
  "function APPROVAL_THRESHOLD() external view returns (uint8)",
  "function MODULE_VERSION() external view returns (string)",
  // Errors (for decoding reverts)
  "error AlreadyApproved()",
  "error AlreadyProposed()",
  "error ForceExitCallFailed()",
  "error IncompatibleAccount()",
  "error InvalidGuardianSig()",
  "error NoProposal()",
  "error NotEnoughApprovals()",
  "error NotInstalled()",
  "error NotOwner()",
  "error SignerNoLongerGuardian()",
  "error UnsupportedL2Type()",
];

export const L2_TYPE = {
  OPTIMISM: 1,
  ARBITRUM: 2,
} as const;

export type L2Type = (typeof L2_TYPE)[keyof typeof L2_TYPE];

export interface PendingExit {
  target: string;
  value: bigint;
  data: string;
  proposedAt: bigint;
  approvalBitmap: bigint;
  guardians: [string, string, string];
}

/**
 * ForceExitService — typed wrappers for ForceExitModule ERC-7579 emergency L2→L1 exit.
 *
 * Flow:
 *   1. Owner installs module via account.installModule(2, forceExitModuleAddr, encodeOnInstall(L2_TYPE.OPTIMISM))
 *   2. Any party calls proposeForceExit(target, value, data) to submit a bridge-out proposal
 *   3. 2-of-3 guardians each call approveForceExit(account, guardianSig) within their window
 *   4. Anyone calls executeForceExit(account) once threshold is met — triggers L2→L1 bridge call
 *
 * The module is an ERC-7579 Executor (moduleTypeId=2) — call installModule on the account, not here.
 */
export class ForceExitService {
  private readonly contract: ethers.Contract;
  private readonly iface: ethers.Interface;

  constructor(
    private readonly moduleAddress: string,
    providerOrSigner: ethers.Provider | ethers.Signer
  ) {
    this.contract = new ethers.Contract(moduleAddress, FORCE_EXIT_ABI, providerOrSigner);
    this.iface = new ethers.Interface(FORCE_EXIT_ABI);
  }

  // ── On-chain reads ──────────────────────────────────────────────

  async isInitialized(smartAccount: string): Promise<boolean> {
    return this.contract.isInitialized(smartAccount) as Promise<boolean>;
  }

  async getPendingExit(account: string): Promise<PendingExit> {
    const [target, value, data, proposedAt, approvalBitmap, guardians] =
      await this.contract.getPendingExit(account);
    return {
      target: target as string,
      value: BigInt(value),
      data: data as string,
      proposedAt: BigInt(proposedAt),
      approvalBitmap: BigInt(approvalBitmap),
      guardians: guardians as [string, string, string],
    };
  }

  async getAccountL2Type(account: string): Promise<number> {
    return Number(await this.contract.accountL2Type(account));
  }

  async getApprovalThreshold(): Promise<number> {
    return Number(await this.contract.APPROVAL_THRESHOLD());
  }

  async getModuleVersion(): Promise<string> {
    return this.contract.MODULE_VERSION() as Promise<string>;
  }

  // ── Calldata encoders (for UserOp or direct tx submission) ─────

  /**
   * Encode onInstall calldata for installModule() call on the smart account.
   * Must be submitted by the account owner, with moduleTypeId=2 (EXECUTOR).
   *
   * @param l2Type - L2_TYPE.OPTIMISM (1) or L2_TYPE.ARBITRUM (2)
   * @example
   * const calldata = forceExit.encodeOnInstall(L2_TYPE.OPTIMISM);
   * // account.installModule(2, forceExitModuleAddress, calldata)
   */
  encodeOnInstall(l2Type: L2Type): string {
    return this.iface.encodeFunctionData("onInstall", [
      ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [l2Type]),
    ]);
  }

  encodeOnUninstall(): string {
    return this.iface.encodeFunctionData("onUninstall", ["0x"]);
  }

  /**
   * Encode calldata for proposeForceExit — the exit payload to bridge out of L2.
   * `target` is the L2→L1 bridge contract; `data` is the bridge call payload.
   */
  encodeProposeForceExit(target: string, value: bigint, data: string): string {
    return this.iface.encodeFunctionData("proposeForceExit", [target, value, data]);
  }

  /**
   * Encode calldata for approveForceExit — guardian signs off on the pending proposal.
   * `guardianSig` must be an EIP-191 personal_sign over the proposal hash.
   */
  encodeApproveForceExit(account: string, guardianSig: string): string {
    return this.iface.encodeFunctionData("approveForceExit", [account, guardianSig]);
  }

  encodeExecuteForceExit(account: string): string {
    return this.iface.encodeFunctionData("executeForceExit", [account]);
  }

  encodeCancelForceExit(account: string): string {
    return this.iface.encodeFunctionData("cancelForceExit", [account]);
  }

  // ── Convenience: send transactions (requires Signer) ──────────

  async proposeForceExit(
    target: string,
    value: bigint,
    data: string
  ): Promise<ethers.TransactionResponse> {
    return (this.contract as ethers.Contract & {
      proposeForceExit: (t: string, v: bigint, d: string) => Promise<ethers.TransactionResponse>;
    }).proposeForceExit(target, value, data);
  }

  async approveForceExit(
    account: string,
    guardianSig: string
  ): Promise<ethers.TransactionResponse> {
    return (this.contract as ethers.Contract & {
      approveForceExit: (a: string, s: string) => Promise<ethers.TransactionResponse>;
    }).approveForceExit(account, guardianSig);
  }

  async executeForceExit(account: string): Promise<ethers.TransactionResponse> {
    return (this.contract as ethers.Contract & {
      executeForceExit: (a: string) => Promise<ethers.TransactionResponse>;
    }).executeForceExit(account);
  }

  async cancelForceExit(account: string): Promise<ethers.TransactionResponse> {
    return (this.contract as ethers.Contract & {
      cancelForceExit: (a: string) => Promise<ethers.TransactionResponse>;
    }).cancelForceExit(account);
  }
}
