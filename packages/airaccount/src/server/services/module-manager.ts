import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
// AIRACCOUNT_ABI is a local human-readable signature array (not in @aastar/core);
// parseAbi is required to feed it to viem's readContract during the ethers->viem migration.
// eslint-disable-next-line no-restricted-imports
import { parseAbi } from "viem";
import { MODULE_TYPE, AIRACCOUNT_ABI, AIRACCOUNT_ADDRESSES } from "../constants/entrypoint";

export type ModuleTypeId = 1 | 2 | 3 | 4; // VALIDATOR | EXECUTOR | FALLBACK | HOOK

/**
 * Guardian-signature domain version (AirAccount contract `GUARDIAN_SIG_VERSION`,
 * AirAccountExtension.sol / AAStarAirAccountBase.sol). Folded into every guardian
 * digest so a signature from an older domain can't be replayed. Bump in lockstep
 * with the contract.
 */
const GUARDIAN_SIG_VERSION = 4;

export interface InstallModuleParams {
  /** The deployed AirAccount address */
  account: string;
  /** ERC-7579 module type: 1=Validator, 2=Executor, 3=Fallback, 4=Hook */
  moduleTypeId: ModuleTypeId;
  /** Module contract address to install */
  module: string;
  /**
   * Guardian slot indices (0..guardianCount-1), parallel to {@link guardianSigs}.
   * Required whenever guardianSigs is non-empty (v0.20.2 mixed-sig encoding): the
   * contract dispatches each sig to the guardian at this slot and bitmaps the slot
   * to prevent double-voting. Omit (with no sigs) for the sigsRequired==0 path.
   */
  signerIdxs?: number[];
  /**
   * Guardian signature blobs, parallel to {@link signerIdxs}:
   *  - ECDSA guardian: 65-byte (r‖s‖v) eth-signed signature over {@link buildInstallModuleHash}
   *  - P-256 guardian: WebAuthn assertion blob
   *    abi.encode(authenticatorData, clientDataJSONPrefix, clientDataJSONSuffix, r, s)
   *
   * When empty, the 0-sig path is used and {@link moduleInitData} is passed raw
   * (backward compatible with accounts whose install threshold yields sigsRequired==0).
   */
  guardianSigs?: string[];
  /** Raw bytes passed to module.onInstall() */
  moduleInitData?: string;
}

export interface UninstallModuleParams {
  account: string;
  moduleTypeId: ModuleTypeId;
  module: string;
  /**
   * Guardian slot indices, parallel to {@link guardianSigs}. Uninstall requires
   * min(guardianCount, 2) sigs; a 0-guardian account degrades to owner-only and
   * may pass empty arrays. NOTE: v0.20.2 dropped module deInit data — uninstall no
   * longer forwards bytes to module.onUninstall().
   */
  signerIdxs?: number[];
  /** Guardian signature blobs (see {@link InstallModuleParams.guardianSigs}). */
  guardianSigs?: string[];
}

/**
 * Build the EIP-191 install digest that an ECDSA guardian must sign (AirAccount
 * v0.20.2, `AirAccountExtension._verifyGuardianSigByIdx`):
 *
 *   innerHash = keccak256(abi.encode(
 *                 GUARDIAN_SIG_VERSION, chainId, account, "INSTALL_MODULE",
 *                 abi.encode(moduleTypeId, module, keccak256(moduleInitData), nonce)
 *               ))
 *
 * Returns `innerHash` (NO EIP-191 prefix). The contract recovers against
 * `toEthSignedMessageHash(innerHash)`, so the guardian signs the returned hash as a
 * raw personal_sign message and viem adds the prefix.
 *
 * `nonce` is the account's current `moduleManagementNonce()` (issue #75 replay
 * guard — increments on every install AND uninstall). Read it on-chain via
 * {@link ModuleManager.readModuleNonce} immediately before collecting signatures.
 *
 * P-256 (passkey) guardians use a different (WebAuthn) challenge and are NOT
 * produced by this helper; supply their assertion blobs directly to encodeInstall.
 *
 * @example
 * const nonce = await mm.readModuleNonce(account);
 * const hash = buildInstallModuleHash(chainId, account, 1, module, nonce, moduleInitData);
 * const sig = await guardian.signMessage({ message: { raw: hash } });
 */
export function buildInstallModuleHash(
  chainId: number,
  account: string,
  moduleTypeId: ModuleTypeId,
  module: string,
  nonce: bigint,
  moduleInitData: string = "0x",
): string {
  const opData = encodeAbiParameters(
    [{ type: "uint256" }, { type: "address" }, { type: "bytes32" }, { type: "uint256" }],
    [BigInt(moduleTypeId), module as Address, keccak256(moduleInitData as Hex), nonce],
  );
  return guardianDigest(chainId, account, "INSTALL_MODULE", opData);
}

/**
 * Build the EIP-191 uninstall digest an ECDSA guardian must sign (v0.20.2):
 *   opData = abi.encode(moduleTypeId, module, nonce)
 */
export function buildUninstallModuleHash(
  chainId: number,
  account: string,
  moduleTypeId: ModuleTypeId,
  module: string,
  nonce: bigint,
): string {
  const opData = encodeAbiParameters(
    [{ type: "uint256" }, { type: "address" }, { type: "uint256" }],
    [BigInt(moduleTypeId), module as Address, nonce],
  );
  return guardianDigest(chainId, account, "UNINSTALL_MODULE", opData);
}

/**
 * Shared guardian-digest construction (ECDSA path) — the INNER hash with NO EIP-191
 * prefix: keccak256(abi.encode(GUARDIAN_SIG_VERSION, chainId, account, opLabel, opData)).
 * The contract recovers against `toEthSignedMessageHash(thisHash)`, so each guardian signs
 * the RETURNED hash as a raw message — `signMessage({ message: { raw: digest } })` — and
 * viem applies the EIP-191 prefix. Do NOT pre-prefix here (that would double-prefix and the
 * on-chain ecrecover would fail). Matches `modifyTierLimitsGuardianDigest`
 * (packages/airaccount/src/core/tier/profile.ts).
 */
function guardianDigest(chainId: number, account: string, opLabel: string, opData: Hex): string {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint8" }, { type: "uint256" }, { type: "address" }, { type: "string" }, { type: "bytes" }],
      [GUARDIAN_SIG_VERSION, BigInt(chainId), account as Address, opLabel, opData],
    ),
  );
}

/**
 * ModuleManager — ERC-7579 module install/uninstall helpers (AirAccount v0.20.2).
 *
 * Guardian-gated module governance moved to AirAccountExtension (fallback-routed)
 * and switched to a mixed ECDSA/P-256 encoding:
 *   installModule(moduleTypeId, module, initData)
 *     initData (sigsRequired>0): abi.encode(uint8[] signerIdxs, bytes[] sigs, bytes moduleInitData)
 *     initData (sigsRequired==0): raw moduleInitData
 *   uninstallModule(moduleTypeId, module, deInitData)
 *     deInitData (always): abi.encode(uint8[] signerIdxs, bytes[] sigs)
 */
export class ModuleManager {
  private readonly provider: PublicClient;
  private readonly chainId: number;

  constructor(provider: PublicClient, chainId: number) {
    this.provider = provider;
    this.chainId = chainId;
  }

  /**
   * Encode calldata for installModule().
   * Caller is responsible for submitting via UserOp (EntryPoint) or direct tx.
   */
  encodeInstall(params: InstallModuleParams): string {
    const initData = (params.moduleInitData ?? "0x") as Hex;
    const sigs = (params.guardianSigs ?? []) as Hex[];

    let packed: Hex;
    if (sigs.length > 0) {
      const signerIdxs = params.signerIdxs;
      if (!signerIdxs || signerIdxs.length !== sigs.length) {
        throw new Error(
          "installModule: signerIdxs is required and must be parallel to guardianSigs " +
            "(AirAccount v0.20.2 mixed-sig encoding)",
        );
      }
      // sigsRequired > 0 path: abi.encode(uint8[] signerIdxs, bytes[] sigs, bytes moduleInitData)
      packed = encodeAbiParameters(
        [{ type: "uint8[]" }, { type: "bytes[]" }, { type: "bytes" }],
        [signerIdxs, sigs, initData],
      );
    } else {
      // sigsRequired == 0 path: raw module init data (backward compatible).
      packed = initData;
    }

    return encodeFunctionData({
      abi: parseAbi(AIRACCOUNT_ABI as readonly string[]),
      functionName: "installModule",
      args: [BigInt(params.moduleTypeId), params.module as Address, packed],
    });
  }

  /**
   * Encode calldata for uninstallModule().
   * deInitData is ALWAYS abi.encode(uint8[], bytes[]) — the contract decodes it
   * unconditionally (unlike install, there is no raw 0-sig passthrough).
   */
  encodeUninstall(params: UninstallModuleParams): string {
    const signerIdxs = params.signerIdxs ?? [];
    const sigs = (params.guardianSigs ?? []) as Hex[];
    if (signerIdxs.length !== sigs.length) {
      throw new Error("uninstallModule: signerIdxs and guardianSigs must be equal length");
    }

    const packed = encodeAbiParameters(
      [{ type: "uint8[]" }, { type: "bytes[]" }],
      [signerIdxs, sigs],
    );

    return encodeFunctionData({
      abi: parseAbi(AIRACCOUNT_ABI as readonly string[]),
      functionName: "uninstallModule",
      args: [BigInt(params.moduleTypeId), params.module as Address, packed],
    });
  }

  /** Read the account's current module-management nonce (issue #75 replay guard). */
  async readModuleNonce(account: string): Promise<bigint> {
    return (await this.provider.readContract({
      address: account as Address,
      abi: parseAbi(["function moduleManagementNonce() view returns (uint256)"]),
      functionName: "moduleManagementNonce",
    })) as bigint;
  }

  /** Check if a module is currently installed on the account. */
  async isInstalled(
    account: string,
    moduleTypeId: ModuleTypeId,
    module: string,
  ): Promise<boolean> {
    return (await this.provider.readContract({
      address: account as Address,
      abi: parseAbi(AIRACCOUNT_ABI as readonly string[]),
      functionName: "isModuleInstalled",
      args: [BigInt(moduleTypeId), module as Address, "0x"],
    })) as boolean;
  }

  /** Return the install digest for an ECDSA guardian to sign. */
  installHash(
    account: string,
    moduleTypeId: ModuleTypeId,
    module: string,
    nonce: bigint,
    moduleInitData: string = "0x",
  ): string {
    return buildInstallModuleHash(this.chainId, account, moduleTypeId, module, nonce, moduleInitData);
  }

  /** Return the uninstall digest for ECDSA guardians to sign. */
  uninstallHash(account: string, moduleTypeId: ModuleTypeId, module: string, nonce: bigint): string {
    return buildUninstallModuleHash(this.chainId, account, moduleTypeId, module, nonce);
  }

  /**
   * Convenience: build install calldata for the standard M7 module set on the
   * 0-sig path (no guardian signatures). Valid only for accounts whose install
   * threshold yields sigsRequired==0; accounts requiring guardian consensus must
   * use {@link encodeInstall} with signerIdxs + guardianSigs.
   */
  encodeInstallDefaultModules(account: string): {
    compositeValidator: string;
    tierGuardHook: string;
  } {
    const addresses = AIRACCOUNT_ADDRESSES.sepolia;
    return {
      compositeValidator: this.encodeInstall({
        account,
        moduleTypeId: MODULE_TYPE.VALIDATOR,
        module: addresses.compositeValidatorM7r4,
      }),
      tierGuardHook: this.encodeInstall({
        account,
        moduleTypeId: MODULE_TYPE.HOOK,
        module: addresses.tierGuardHookM7r4,
      }),
    };
  }
}
