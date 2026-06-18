import {
  getContract,
  encodeFunctionData,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
// FORCE_EXIT_ABI is a local human-readable signature array (not in @aastar/core);
// parseAbi is required to feed it to viem's getContract / encodeFunctionData during
// the ethers->viem migration.
// eslint-disable-next-line no-restricted-imports
import { parseAbi } from "viem";
import { encodeAbiParams } from "../../migration/viem/abi-encoding";
import type { ViemContract } from "../providers/ethereum-provider";

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

// Parsed once at module load — fed to getContract (reads/writes) and encodeFunctionData.
const FORCE_EXIT_PARSED_ABI = parseAbi(FORCE_EXIT_ABI as readonly string[]);

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
 * A viem client capable of backing the ForceExit contract. A `PublicClient`
 * alone enables the on-chain reads; a `WalletClient` (or the `{ public, wallet }`
 * pair) is required for the state-changing `proposeForceExit`/`approveForceExit`/
 * etc. transactions. This replaces the old `ethers.Provider | ethers.Signer`
 * argument (provider = reads, signer = reads + writes).
 */
export type ForceExitClient =
  | PublicClient
  | WalletClient
  | { public: PublicClient; wallet: WalletClient };

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
  private readonly contract: ViemContract;

  constructor(
    private readonly moduleAddress: string,
    client: ForceExitClient
  ) {
    this.contract = getContract({
      address: moduleAddress as Address,
      abi: FORCE_EXIT_PARSED_ABI,
      // viem inspects the client's actions at runtime to expose read/write; the
      // cast only satisfies the static union — a wallet client still yields writes.
      client: client as unknown as PublicClient,
    }) as unknown as ViemContract;
  }

  // ── On-chain reads ──────────────────────────────────────────────

  async isInitialized(smartAccount: string): Promise<boolean> {
    return (await this.contract.read.isInitialized([smartAccount as Address])) as boolean;
  }

  async getPendingExit(account: string): Promise<PendingExit> {
    const [target, value, data, proposedAt, approvalBitmap, guardians] =
      (await this.contract.read.getPendingExit([account as Address])) as [
        string,
        bigint,
        string,
        bigint,
        bigint,
        [string, string, string],
      ];
    return {
      target,
      value: BigInt(value),
      data,
      proposedAt: BigInt(proposedAt),
      approvalBitmap: BigInt(approvalBitmap),
      guardians,
    };
  }

  async getAccountL2Type(account: string): Promise<number> {
    return Number(await this.contract.read.accountL2Type([account as Address]));
  }

  async getApprovalThreshold(): Promise<number> {
    return Number(await this.contract.read.APPROVAL_THRESHOLD([]));
  }

  async getModuleVersion(): Promise<string> {
    return (await this.contract.read.MODULE_VERSION([])) as string;
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
    return encodeFunctionData({
      abi: FORCE_EXIT_PARSED_ABI,
      functionName: "onInstall",
      args: [encodeAbiParams(["uint8"], [l2Type])],
    });
  }

  encodeOnUninstall(): string {
    return encodeFunctionData({
      abi: FORCE_EXIT_PARSED_ABI,
      functionName: "onUninstall",
      args: ["0x"],
    });
  }

  /**
   * Encode calldata for proposeForceExit — the exit payload to bridge out of L2.
   * `target` is the L2→L1 bridge contract; `data` is the bridge call payload.
   */
  encodeProposeForceExit(target: string, value: bigint, data: string): string {
    return encodeFunctionData({
      abi: FORCE_EXIT_PARSED_ABI,
      functionName: "proposeForceExit",
      args: [target as Address, value, data as Hex],
    });
  }

  /**
   * Encode calldata for approveForceExit — guardian signs off on the pending proposal.
   * `guardianSig` must be an EIP-191 personal_sign over the proposal hash.
   */
  encodeApproveForceExit(account: string, guardianSig: string): string {
    return encodeFunctionData({
      abi: FORCE_EXIT_PARSED_ABI,
      functionName: "approveForceExit",
      args: [account as Address, guardianSig as Hex],
    });
  }

  encodeExecuteForceExit(account: string): string {
    return encodeFunctionData({
      abi: FORCE_EXIT_PARSED_ABI,
      functionName: "executeForceExit",
      args: [account as Address],
    });
  }

  encodeCancelForceExit(account: string): string {
    return encodeFunctionData({
      abi: FORCE_EXIT_PARSED_ABI,
      functionName: "cancelForceExit",
      args: [account as Address],
    });
  }

  // ── Convenience: send transactions (requires a WalletClient) ──────────

  async proposeForceExit(target: string, value: bigint, data: string): Promise<Hex> {
    return (await this.contract.write.proposeForceExit([
      target as Address,
      value,
      data as Hex,
    ])) as Hex;
  }

  async approveForceExit(account: string, guardianSig: string): Promise<Hex> {
    return (await this.contract.write.approveForceExit([
      account as Address,
      guardianSig as Hex,
    ])) as Hex;
  }

  async executeForceExit(account: string): Promise<Hex> {
    return (await this.contract.write.executeForceExit([account as Address])) as Hex;
  }

  async cancelForceExit(account: string): Promise<Hex> {
    return (await this.contract.write.cancelForceExit([account as Address])) as Hex;
  }
}
