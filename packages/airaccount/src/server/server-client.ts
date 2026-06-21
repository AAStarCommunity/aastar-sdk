import { ServerConfig, validateConfig } from "./config";
import { ConsoleLogger } from "./interfaces/logger";
import { EthereumProvider } from "./providers/ethereum-provider";
import { AccountManager } from "./services/account-manager";
import { TransferManager } from "./services/transfer-manager";
import { BLSSignatureService } from "./services/bls-signature-service";
import { PaymasterManager } from "./services/paymaster-manager";
import { TokenService } from "./services/token-service";
import { WalletManager } from "./services/wallet-manager";

/**
 * Main facade for the YAAA Server SDK.
 * Wires all services together from a single config object.
 *
 * @example
 * ```ts
 * import { AirAccountServerClient, MemoryStorage, LocalWalletSigner } from '@aastar/airaccount/server';
 *
 * const client = new AirAccountServerClient({
 *   rpcUrl: 'https://sepolia.infura.io/v3/...',
 *   bundlerRpcUrl: 'https://api.pimlico.io/v2/11155111/rpc?apikey=...',
 *   chainId: 11155111,
 *   entryPoints: {
 *     v06: {
 *       entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
 *       factoryAddress: '0x...',
 *       validatorAddress: '0x...',
 *     },
 *   },
 *   storage: new MemoryStorage(),
 *   signer: new LocalWalletSigner('0xPRIVATE_KEY'),
 * });
 *
 * const account = await client.accounts.createAccount('user-123');
 * ```
 *
 * @example KMS-backed signing (production) — inject {@link KmsSignerAdapter} as the
 * `signer`. This is the wiring seam that carries a per-call WebAuthn ceremony
 * assertion (challenge-bound, replay-safe) from `executeTransfer` through to the
 * KMS `/SignHash`. The `userId → { keyId, address }` mapping is app-specific.
 * ```ts
 * import { AirAccountServerClient, KmsManager, KmsSignerAdapter } from '@aastar/airaccount/server';
 *
 * const kms = new KmsManager({ kmsEndpoint, kmsApiKey, kmsEnabled: true });
 * const client = new AirAccountServerClient({
 *   ...rest,
 *   signer: new KmsSignerAdapter(kms, async (userId) => lookupUserKey(userId)),
 * });
 * // Transfer with a one-time WebAuthn assertion (frontend ceremony) on the tiered path:
 * await client.transfers.executeTransfer(userId, {
 *   ...params,
 *   useAirAccountTiering: true,
 *   webAuthnAssertion, // { ChallengeId, Credential } from BeginAuthentication
 * });
 * ```
 */
export class AirAccountServerClient {
  readonly ethereum: EthereumProvider;
  readonly accounts: AccountManager;
  readonly transfers: TransferManager;
  readonly bls: BLSSignatureService;
  readonly paymaster: PaymasterManager;
  readonly tokens: TokenService;
  readonly wallets: WalletManager;

  constructor(config: ServerConfig) {
    validateConfig(config);

    const logger = config.logger ?? new ConsoleLogger("[YAAA]");

    // Core provider
    this.ethereum = new EthereumProvider(config);

    // Service wiring (order matters: dependencies first)
    this.wallets = new WalletManager(config.signer);
    this.tokens = new TokenService(this.ethereum);
    this.paymaster = new PaymasterManager(this.ethereum, config.storage, logger);
    this.accounts = new AccountManager(this.ethereum, config.storage, config.signer, logger);
    this.bls = new BLSSignatureService(
      config,
      this.ethereum,
      config.storage,
      config.signer,
      logger
    );
    this.transfers = new TransferManager(
      this.ethereum,
      this.accounts,
      this.bls,
      this.paymaster,
      this.tokens,
      config.storage,
      config.signer,
      logger
    );
  }
}

/**
 * @deprecated Renamed to {@link AirAccountServerClient}. This alias is kept for
 * backward compatibility and will be removed in a future major version.
 */
export const YAAAServerClient = AirAccountServerClient;
