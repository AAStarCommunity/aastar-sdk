import { ethers } from "ethers";
import { MODULE_TYPE, AIRACCOUNT_ABI, AIRACCOUNT_ADDRESSES } from "../constants/entrypoint";

export type ModuleTypeId = 1 | 2 | 3; // VALIDATOR | EXECUTOR | HOOK

export interface InstallModuleParams {
  /** The deployed AirAccount address */
  account: string;
  /** ERC-7579 module type: 1=Validator, 2=Executor, 3=Hook */
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
 * const sig = await guardian.signMessage(ethers.getBytes(hash));
 */
export function buildInstallModuleHash(
  chainId: number,
  account: string,
  moduleTypeId: ModuleTypeId,
  module: string,
  moduleInitData: string = "0x",
): string {
  const moduleInitDataHash = ethers.keccak256(moduleInitData);
  const raw = ethers.keccak256(
    ethers.solidityPacked(
      ["string", "uint256", "address", "uint256", "address", "bytes32"],
      ["INSTALL_MODULE", chainId, account, moduleTypeId, module, moduleInitDataHash],
    ),
  );
  return ethers.hashMessage(ethers.getBytes(raw));
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
  const raw = ethers.keccak256(
    ethers.solidityPacked(
      ["string", "uint256", "address", "uint256", "address"],
      ["UNINSTALL_MODULE", chainId, account, moduleTypeId, module],
    ),
  );
  return ethers.hashMessage(ethers.getBytes(raw));
}

/**
 * ModuleManager — ERC-7579 module install/uninstall helpers.
 *
 * Handles the guardian-sig packing required by AAStarAirAccountV7:
 *   installModule(moduleTypeId, module, guardianSigs ‖ moduleInitData)
 *   uninstallModule(moduleTypeId, module, guardianSig1 ‖ guardianSig2 ‖ deInitData)
 */
export class ModuleManager {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly chainId: number;

  constructor(provider: ethers.JsonRpcProvider, chainId: number) {
    this.provider = provider;
    this.chainId = chainId;
  }

  /**
   * Encode calldata for installModule().
   * Caller is responsible for submitting via UserOp (EntryPoint) or direct tx.
   */
  encodeInstall(params: InstallModuleParams): string {
    const sigs = params.guardianSigs ?? [];
    const initData = params.moduleInitData ?? "0x";

    // Pack: guardian sigs (65 bytes each) concatenated with module init data
    const packed =
      sigs.length > 0
        ? ethers.concat([...sigs.map((s) => ethers.getBytes(s)), ethers.getBytes(initData)])
        : ethers.getBytes(initData);

    const iface = new ethers.Interface(AIRACCOUNT_ABI);
    return iface.encodeFunctionData("installModule", [
      params.moduleTypeId,
      params.module,
      packed,
    ]);
  }

  /**
   * Encode calldata for uninstallModule().
   * Always requires 2 guardian signatures.
   */
  encodeUninstall(params: UninstallModuleParams): string {
    const deInitData = params.moduleDeInitData ?? "0x";
    const packed = ethers.concat([
      ethers.getBytes(params.guardianSig1),
      ethers.getBytes(params.guardianSig2),
      ethers.getBytes(deInitData),
    ]);

    const iface = new ethers.Interface(AIRACCOUNT_ABI);
    return iface.encodeFunctionData("uninstallModule", [
      params.moduleTypeId,
      params.module,
      packed,
    ]);
  }

  /** Check if a module is currently installed on the account. */
  async isInstalled(
    account: string,
    moduleTypeId: ModuleTypeId,
    module: string,
  ): Promise<boolean> {
    const contract = new ethers.Contract(account, AIRACCOUNT_ABI, this.provider);
    return contract.isModuleInstalled(moduleTypeId, module, "0x") as Promise<boolean>;
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
   * Uses pre-deployed Sepolia addresses. No guardian sigs required when
   * account threshold <= 40 (default for newly created accounts).
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
        module: addresses.compositeValidator,
      }),
      tierGuardHook: this.encodeInstall({
        account,
        moduleTypeId: MODULE_TYPE.HOOK,
        module: addresses.tierGuardHook,
      }),
    };
  }
}
