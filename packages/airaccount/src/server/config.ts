import { IStorageAdapter } from "./interfaces/storage-adapter";
import { ISignerAdapter } from "./interfaces/signer-adapter";
import { ILogger } from "./interfaces/logger";

/**
 * Per-version EntryPoint configuration.
 */
export interface EntryPointVersionConfig {
  entryPointAddress: string;
  factoryAddress: string;
  validatorAddress: string;
}

/**
 * Server SDK configuration — replaces NestJS ConfigService.
 */
export interface ServerConfig {
  /** Main network RPC URL. */
  rpcUrl: string;
  /** Bundler RPC URL (e.g. Pimlico, StackUp). */
  bundlerRpcUrl: string;
  /** Chain ID of the target network. */
  chainId: number;

  /** EntryPoint configurations — at least one version must be provided. */
  entryPoints: {
    v06?: EntryPointVersionConfig;
    v07?: EntryPointVersionConfig;
    v08?: EntryPointVersionConfig;
  };

  /** Default EntryPoint version to use when not specified. */
  defaultVersion?: "0.6" | "0.7" | "0.8";

  /** BLS signer seed nodes for gossip discovery. */
  blsSeedNodes?: string[];
  /** Timeout for BLS node discovery in ms. */
  blsDiscoveryTimeout?: number;

  /** KMS endpoint URL (optional, for KMS-based signing). */
  kmsEndpoint?: string;
  /** Whether KMS signing is enabled. */
  kmsEnabled?: boolean;
  /** KMS API key for authenticated requests. */
  kmsApiKey?: string;

  /** Storage adapter (required). */
  storage: IStorageAdapter;
  /** Signer adapter (required). */
  signer: ISignerAdapter;
  /** Logger (optional, defaults to ConsoleLogger). */
  logger?: ILogger;
}

/**
 * Validate a ServerConfig and throw descriptive errors for missing fields.
 */
export function validateConfig(config: ServerConfig): void {
  if (!config.rpcUrl) {
    throw new Error("ServerConfig: rpcUrl is required");
  }
  if (!config.bundlerRpcUrl) {
    throw new Error("ServerConfig: bundlerRpcUrl is required");
  }
  if (!config.chainId) {
    throw new Error("ServerConfig: chainId is required");
  }

  const { entryPoints } = config;
  if (!entryPoints || (!entryPoints.v06 && !entryPoints.v07 && !entryPoints.v08)) {
    throw new Error("ServerConfig: at least one entryPoint version must be configured");
  }

  for (const [key, ep] of Object.entries(entryPoints)) {
    if (ep) {
      if (!ep.entryPointAddress) {
        throw new Error(`ServerConfig: entryPoints.${key}.entryPointAddress is required`);
      }
      if (!ep.factoryAddress) {
        throw new Error(`ServerConfig: entryPoints.${key}.factoryAddress is required`);
      }
      if (!ep.validatorAddress) {
        throw new Error(`ServerConfig: entryPoints.${key}.validatorAddress is required`);
      }
    }
  }

  if (!config.storage) {
    throw new Error("ServerConfig: storage adapter is required");
  }
  if (!config.signer) {
    throw new Error("ServerConfig: signer adapter is required");
  }
}
