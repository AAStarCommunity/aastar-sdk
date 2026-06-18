import {
  concat,
  encodeFunctionData,
  hexToBytes,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
// AIRACCOUNT_ABI is a local human-readable signature array (not in @aastar/core);
// parseAbi is required to feed it to viem's readContract during the ethers->viem migration.
// eslint-disable-next-line no-restricted-imports
import { parseAbi } from "viem";
import { MODULE_TYPE, AIRACCOUNT_ABI, AIRACCOUNT_ADDRESSES } from "../constants/entrypoint";
// Byte-exact viem parity helpers (proven in migration/viem/*.parity.test.ts).
import { keccak256 } from "../../migration/viem/hashing";
import { solidityPacked } from "../../migration/viem/abi-encoding";
import { hashMessage } from "../../migration/viem/signatures";

export type ModuleTypeId = 1 | 2 | 3 | 4; // VALIDATOR | EXECUTOR | FALLBACK | HOOK

export interface InstallModuleParams {
  /** The deployed AirAccount address */
  account: string;
  /** ERC-7579 module type: 1=Validator, 2=Executor, 3=Fallback, 4=Hook */
  moduleTypeId: ModuleTypeId;
  /** Module contract address to install */
  module: string;
  /**
   * Guardian signatures + module init data, packed as:
   *   bytes[0..65*sigsRequired] = guardian ECDSA sigs
   *   bytes[65*sigsRequired..]  = module onInstall() init data
   *
   * Sig hash (per guardian, r5 format):
   *   keccak256("INSTALL_MODULE" ‖ chainId ‖ account ‖ moduleTypeId ‖ module ‖ keccak256(moduleInitData)).toEthSignedMessageHash()
   *
   * sigsRequired: 0 if threshold<=40, 1 if <=70, 2 if =100
   */
  guardianSigs?: string[]; // 65-byte hex sigs from guardians
  /** Raw bytes passed to module.onInstall() after guardian sigs */
  moduleInitData?: string;
}

export interface UninstallModuleParams {
  account: string;
  moduleTypeId: ModuleTypeId;
  module: string;
  /** Always requires 2 guardian sigs for uninstall */
  guardianSig1: string;
  guardianSig2: string;
  /** Passed to module.onUninstall() */
  moduleDeInitData?: string;
}

/**
 * Build the EIP-191 install hash that guardians must sign.
 *
 * r5 format: includes keccak256(moduleInitData) to prevent config-swap attacks.
 *
 * @example
 * const hash = buildInstallModuleHash(chainId, account, 1, moduleAddress, moduleInitData);
 * const sig = await guardian.signMessage(hexToBytes(hash));
 */
export function buildInstallModuleHash(
  chainId: number,
  account: string,
  moduleTypeId: ModuleTypeId,
  module: string,
  moduleInitData: string = "0x",
): string {
  const moduleInitDataHash = keccak256(moduleInitData as Hex);
  const raw = keccak256(
    solidityPacked(
      ["string", "uint256", "address", "uint256", "address", "bytes32"],
      ["INSTALL_MODULE", BigInt(chainId), account, BigInt(moduleTypeId), module, moduleInitDataHash],
    ),
  );
  return hashMessage(hexToBytes(raw));
}

/**
 * Build the EIP-191 uninstall hash that guardians must sign.
 */
export function buildUninstallModuleHash(
  chainId: number,
  account: string,
  moduleTypeId: ModuleTypeId,
  module: string,
): string {
  const raw = keccak256(
    solidityPacked(
      ["string", "uint256", "address", "uint256", "address"],
      ["UNINSTALL_MODULE", BigInt(chainId), account, BigInt(moduleTypeId), module],
    ),
  );
  return hashMessage(hexToBytes(raw));
}

/**
 * ModuleManager — ERC-7579 module install/uninstall helpers.
 *
 * Handles the guardian-sig packing required by AAStarAirAccountV7:
 *   installModule(moduleTypeId, module, guardianSigs ‖ moduleInitData)
 *   uninstallModule(moduleTypeId, module, guardianSig1 ‖ guardianSig2 ‖ deInitData)
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
    const sigs = params.guardianSigs ?? [];
    const initData = (params.moduleInitData ?? "0x") as Hex;

    // Pack: guardian sigs (65 bytes each) concatenated with module init data.
    // viem `concat` over hex strings produces the same byte layout as
    // ethers.concat over getBytes(...) — the 0x prefixes are stripped per item.
    const packed: Hex =
      sigs.length > 0 ? concat([...(sigs as Hex[]), initData]) : initData;

    return encodeFunctionData({
      abi: parseAbi(AIRACCOUNT_ABI as readonly string[]),
      functionName: "installModule",
      args: [BigInt(params.moduleTypeId), params.module as Address, packed],
    });
  }

  /**
   * Encode calldata for uninstallModule().
   * Always requires 2 guardian signatures.
   */
  encodeUninstall(params: UninstallModuleParams): string {
    const deInitData = (params.moduleDeInitData ?? "0x") as Hex;
    const packed: Hex = concat([
      params.guardianSig1 as Hex,
      params.guardianSig2 as Hex,
      deInitData,
    ]);

    return encodeFunctionData({
      abi: parseAbi(AIRACCOUNT_ABI as readonly string[]),
      functionName: "uninstallModule",
      args: [BigInt(params.moduleTypeId), params.module as Address, packed],
    });
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

  /** Return the install hash for a guardian to sign (r5 format, includes moduleInitData hash). */
  installHash(account: string, moduleTypeId: ModuleTypeId, module: string, moduleInitData: string = "0x"): string {
    return buildInstallModuleHash(this.chainId, account, moduleTypeId, module, moduleInitData);
  }

  /** Return the uninstall hash for guardians to sign. */
  uninstallHash(account: string, moduleTypeId: ModuleTypeId, module: string): string {
    return buildUninstallModuleHash(this.chainId, account, moduleTypeId, module);
  }

  /**
   * Convenience: build install calldata for the standard M7 module set.
   * Uses pre-deployed Sepolia addresses (r4 audit-final). No guardian sigs required when
   * account threshold <= 40 (default for newly created accounts).
   *
   * Note: beta.3 unifies these into SessionKeyValidator. This helper retains the r4
   * addresses for accounts already deployed on r4; new accounts use SessionKeyValidator.
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
