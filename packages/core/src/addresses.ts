/**
 * Canonical Contract Addresses for Supported Networks
 * These are hardcoded as defaults for NPM distribution.
 *
 * SINGLE SOURCE OF TRUTH for SDK contract addresses (Beta3.1 P2.8).
 * The root `config.{network}.json` files are dev/deploy-time overrides and MUST
 * agree with this table for any network that has a chainId entry here. The
 * `scripts/check-address-consistency.ts` drift check (CI: `pnpm run check:addresses`)
 * enforces that. NOTE: `@aastar/shared-config` is a separate external repo (vendored
 * as git submodules under ext/ and lib/), NOT a workspace package and NOT the SDK's
 * source of truth — do not treat it as canonical here.
 */

import type { Address } from 'viem';
import { optimism, sepolia, optimismSepolia } from 'viem/chains';

export const CANONICAL_ADDRESSES = {
  // --- Optimism (Chain ID: 10) ---
  10: {
    registry: "0x997686219F31405503D32728B1f094F115EF24e7",
    gToken: "0x8d6Fe002dDacCcFBD377F684EC1825f2E1ab7ef6",
    staking: "0x7A1216C2d814D2389698C64eD23AA1aA9Eb6343E",
    sbt: "0x28eBFc5fc03B1d7648254AbF1C7B39DbFdef1a94",
    reputationSystem: "0xA9560898dC0eE4F9Ed3F1db17dbf74dE65e925c2",
    superPaymaster: "0xA2c9A6e95f19f5D2a364CBCbB5f0b32B1B4d140E",
    paymasterFactory: "0x58A7F6E44a57028A255794119F8b37124c9a7eB8",
    paymasterV4: "0x67a70a578E142b950987081e7016906ae4F56Df4",  // = aPNTsPaymasterV4 (AAStar Community PM, Jason)
    paymasterV4Impl: "0xc4dd13F7825409EEC13FBCBdD9D8f6d618207cca",
    // Official community PaymasterV4 instances (one per community, each backed by its own points token).
    aPNTsPaymasterV4: "0x67a70a578E142b950987081e7016906ae4F56Df4",  // AAStar community → aPNTs
    PNTsPaymasterV4: "0x0000000000000000000000000000000000000000",   // Mycelian (Anni) → pnts; not deployed on this chain
    xPNTsFactory: "0x864971a26384d9DCC7115f0bBC428e2623F28b6e",
    blsAggregator: "0x1C305372ecc5a36CBef1FA371392234bCD55eB19",
    blsValidator: "0xA88ADec5A8dc422B57488272d5aD5913d728942A",
    dvtValidator: "0x31Ede6454a56293f7cf2323CA5d5F9a6230558Fb",
    entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    aPNTs: "0x0B41C78081B5A141eb4C3C7E7FD8E58A7Bde553B",
    priceFeed: "0x13e3Ee699D1909E989722E753853AE30b17e08c5",
    simpleAccountFactory: "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985",
    microPaymentChannel: "0x0000000000000000000000000000000000000000",
    agentIdentityRegistry: "0x0000000000000000000000000000000000000000",
    agentReputationRegistry: "0x0000000000000000000000000000000000000000",
    // ERC-8004 agent validation registry (SP v5.4) — not yet deployed on this chain.
    agentValidationRegistry: "0x0000000000000000000000000000000000000000",
    // --- AirAccount v0.17.2-beta.2 stack (not yet deployed on this chain) ---
    aaStarBLSAlgorithm: "0x0000000000000000000000000000000000000000",
    aaStarValidator: "0x0000000000000000000000000000000000000000",
    aaStarBLSAggregator: "0x0000000000000000000000000000000000000000",
    sessionKeyValidator: "0x0000000000000000000000000000000000000000",
    forceExitModule: "0x0000000000000000000000000000000000000000",
    airAccountDelegate: "0x0000000000000000000000000000000000000000",
    calldataParserRegistry: "0x0000000000000000000000000000000000000000",
    airAccountFactoryV7: "0x0000000000000000000000000000000000000000",
    airAccountV7Impl: "0x0000000000000000000000000000000000000000",
    airAccountExtension: "0x0000000000000000000000000000000000000000",
    agentRegistry: "0x0000000000000000000000000000000000000000",
    // SP v5.4 PolicyRegistry (DVT layer-1) — not yet deployed on this chain.
    policyRegistry: "0x0000000000000000000000000000000000000000",
    // SP v5.4 x402 settlement facilitator — not yet deployed on this chain.
    x402Facilitator: "0x0000000000000000000000000000000000000000",
    // SP v5.4 governance TimelockController — not yet deployed on this chain.
    timelockController: "0x0000000000000000000000000000000000000000",
    // Mycelium community PNTs token — Sepolia-only testbed; zero on mainnets.
    // Kept here so the inferred CanonicalAddresses union has `pnts` on every
    // chain (consumers see Address, not Address|undefined per-chain).
    pnts: "0x0000000000000000000000000000000000000000",
  },

  // --- Sepolia (Chain ID: 11155111) ---
  // Source of truth: SuperPaymaster repo `deployments/config.sepolia.json`
  //                  AirAccount repo docs/e2e/E2E_TESTDATA_v0.18.0-beta.2.md
  // Latest sync: 2026-06-20 — AirAccount contracts v0.20.0 (P-256/WebAuthn guardian + recovery
  //   relocated to AirAccountExtension; FULL Sepolia redeploy, docs/DEPLOYMENT-v0.20.0.md).
  //   SuperPaymaster remains v5.4.0-beta.1-redeploy (deployments/config.sepolia.json 2026-06-16).
  //   SP proxy 0x0300... (impl 0x24a945...), Registry 0x3F92... (impl 0x177033...)
  //   v5.4 keys: x402Facilitator 0x326Fc3..., policyRegistry 0x8c2488..., timelockController 0xB734df...
  //   AirAccount v0.20.0 factory 0x99C9300d... (NEW ctor: impl injected as arg 1).
  //   NOTE: #60 syncs the v0.18 read-layer + addresses ONLY; v0.18 runtime-signing
  //   behavioral changes (BLS packer / #45 hash_to_curve binding) are a separate follow-up.
  //   NOTE: official community PaymasterV4s below — `aPNTsPaymasterV4` (AAStar → aPNTs) and
  //   `PNTsPaymasterV4` (Mycelian/Anni → pnts), auto-deployed by SuperPaymaster prepare-test and
  //   synced via config.sepolia.json. `paymasterV4` = the AAStar one (= aPNTsPaymasterV4).
  //   All verified on-chain (PaymasterFactory.getPaymasterList + isTokenSupported + owner).
  11155111: {
    registry: "0x3F920B25f8b65988359C372F66F036E48adFc556",
    gToken: "0x20a051502a7AE6e40cfFd6EBe59057538E698984",
    staking: "0x3B363598746Ea57314d4869B160940948c569D48",
    sbt: "0x072A0D12f4212B6baD7c6d0A633eaffbDE9105bF",
    reputationSystem: "0x7fEd690E1663755e24a1C9d6164336809d68a578",
    superPaymaster: "0x030025f40d509b1a99547bAEb3795bD27F7182b7",  // proxy (impl 0x24a94572...; 2026-06-16 redeploy)
    paymasterFactory: "0x0Aa06EA5295eeD4D48c93c594Db1CBf3626971A5",
    paymasterV4: "0x957852251f44570dc2B60Dde0954f191FF3372eE",  // = aPNTsPaymasterV4 (AAStar; was 0x1f0D4eF, a non-aPNTs proxy)
    paymasterV4Impl: "0x59DCA5861aaDA602fE1BFbfcc36DFAc36C58623d",
    // Official community PaymasterV4 instances (verified on-chain). AAStar's is an ERC-1167 clone of
    // paymasterV4Impl above (version PMV4-Deposit-4.5.0), owner = SuperPaymaster owner 0xb5600060….
    aPNTsPaymasterV4: "0x957852251f44570dc2B60Dde0954f191FF3372eE",  // AAStar community → aPNTs (0x9e66B457)
    PNTsPaymasterV4: "0x0000000000000000000000000000000000000000",   // Mycelian (Anni) → pnts; filled by next prepare-test (on-chain candidate 0xd998013F… supports pnts)
    xPNTsFactory: "0xCec3655525a112882E74Fb7C26AcB267a07724cb",  // 2026-06-16 redeploy (was 0xc312...)
    blsAggregator: "0x15387e161c1b3dAe7c66Fbd5c1F32837B58B2e79",  // SP BLSAggregator 2026-06-16 redeploy (was 0x7ec7...)
    blsValidator: "0x0A71C5a32b8CBC517523D2C88b539Ab22AeF0654",  // deprecated; aggregator verifies BLS inline
    dvtValidator: "0x19BA9829C784E4A41b68960b9c0bA55f83718997",
    entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    aPNTs: "0x9e66B457E0ABb1F139FD8A596d00f784eBA2873b",  // AAStar aPNTs (deployer operator)
    priceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",  // Sepolia Chainlink ETH/USD
    simpleAccountFactory: "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985",
    microPaymentChannel: "0x405851A141Cde827E33247d4D4089Af2814c2FF5",  // SP v5.4 2026-06-16 redeploy (was 0xfCC9...)
    agentIdentityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",  // ERC-8004 vanity addr (beta.3)
    agentReputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    // ERC-8004 agent validation registry (SP v5.4) — present in SP config.
    agentValidationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
    // --- AirAccount v0.20.0 stack (FULL Sepolia redeploy 2026-06-20) ---
    // v0.20.0 ships first-class P-256/WebAuthn guardian support (#119) and a diamond-lite
    // refactor that relocates the cold ECDSA recovery path (propose/approve/execute/cancel)
    // into AirAccountExtension, reached via the V7 fallback→delegatecall boundary (frees the
    // main-account runtime from 11 B → 1,258 B under EIP-170). The version bump
    // (ACCOUNT_VERSION/FACTORY_VERSION → "0.20.0") changes bytecode and therefore redeployed
    // the ENTIRE stack to fresh addresses — all 11 below moved; the v0.19.0-beta.2 addresses
    // are now stale. The recovery event topic0 (RecoveryProposed/Approved/CancelVoted) also
    // changed (trailing uint8 guardianIdx). P-256 guardian feature is Batch 2 (SDK stubbed).
    // Source of truth: AirAccount repo docs/DEPLOYMENT-v0.20.0.md "Core addresses"
    //   (Sepolia 2026-06-20). NOTE: factory ctor is NEW — impl injected as arg 1.
    aaStarBLSAlgorithm: "0xAF525A161CB17e0A1b6254ef0B8d8473bdA05174",  // v0.20.0 (algId 0x01)
    aaStarValidator: "0xfcDfd17a373E037c3F9C8ffE2c781915E7Ae6e11",  // v0.20.0 (ValidatorRouter, set-once validator)
    aaStarBLSAggregator: "0x35775df9a4f4dB42Ea0C46118a12dDd0cEc70609",  // v0.20.0
    sessionKeyValidator: "0x6810CfB7c72D16e044a17694fAa8076e517264D0",  // v0.20.0 (algId 0x08)
    forceExitModule: "0x3fDe77868b74a7979A40a2293a1CD265fbe66EEc",  // v0.20.0
    airAccountDelegate: "0xd2735E54C5f5f2BF523b8a9ddd0E183624c3f2c0",  // v0.20.0
    calldataParserRegistry: "0x7dEea4544446826601014bD94d0F6432A67496F5",  // v0.20.0
    airAccountFactoryV7: "0x4f7BBb00c1086f5c0EBdDBDb4BC39cF348EfB2C3",  // v0.20.1 (re-points to new impl; tierLimitNonce getter)
    airAccountV7Impl: "0xf4a534deCcB1652a28e4b4d388b518008F23f3f3",  // v0.20.1
    airAccountExtension: "0xBE1aBaae2c678959Be4E0708568dDf0Fc8765cb8",  // v0.20.1 (+tierLimitNonce() getter — #132)
    agentRegistry: "0xdE603987C184d25f37f612B9E84481E92719B08B",  // v0.20.1 (bindFactory set-once)
    // SP v5.4 PolicyRegistry (DVT layer-1), deployed on Sepolia.
    // Source of truth: SuperPaymaster repo deployments/config.sepolia.json (v5.4.0-beta.1).
    policyRegistry: "0x8c2488d46d5447418558c38AA6441720df656094",
    // SP v5.4 x402 settlement facilitator (verify/settle EIP-3009 + direct xPNTs).
    x402Facilitator: "0x326Fc3413c8A0185b0179B971C69813B6dFD971B",
    // SP v5.4 governance TimelockController (2-day minDelay; gates PolicyRegistry loosen/unfreeze).
    timelockController: "0xB734df3c0A1809bc06708512363D368Ac51dF1A2",
    // Base PNTs token — authoritative value from the SuperPaymaster Sepolia
    // deployment (deployments/config.sepolia.json) and config.sepolia.json here.
    // Was 0x6A230Fa25b9Ec12eeF8eeb8d2FbE32CF29c6edC6 ("Anni's xPNTsToken"), which
    // drifted from the live deployment; realigned per "Sepolia deployment is the
    // source of truth". A community-specific xPNTs belongs under its own key, not
    // the canonical base `pnts`.
    pnts: "0xC687f8a115D308ECD39658a8EE33bC3c8F75EE31",
  },

  // --- OP Sepolia (Chain ID: 11155420) ---
  11155420: {
    registry: "0xcf6860Ab57de8669756997e414D9c52B6e301972",
    gToken: "0xC341c88453372021d0221834307613c2e99fE718",
    staking: "0x5f57B931C849e8E255F22755506eB2255aB22a7C",
    sbt: "0x2c3Ca1553dC1B8870381E8E56C7b3e3A3ae162f0",
    reputationSystem: "0x891EC0f84D9275839B8dAf74e87B23F2DBd7f9c9",
    superPaymaster: "0x9eC1FE8134A1C05aD34ba2E4e8758dAe0a009B94",
    paymasterFactory: "0x1e3b9d12eAc27867a523d0537902441B0E7D98d8",
    paymasterV4: "0xf250416C940605a1D423ccd059668219cf7D80ea",
    paymasterV4Impl: "0x906123080207F250B1C9F299991512Cb31f35b2f",
    // Official community PaymasterV4 instances — not yet confirmed/deployed on this chain.
    aPNTsPaymasterV4: "0x0000000000000000000000000000000000000000",
    PNTsPaymasterV4: "0x0000000000000000000000000000000000000000",
    xPNTsFactory: "0x7792a49C9E91e0E9B631B27D885d15e971B7482A",
    blsAggregator: "0x6e06b17b1a4D2D973F7E3e026e24b4393315736c",
    blsValidator: "0x260fa905CcE1f5b29Afe9d627c01fAAE4A66A7F5",
    dvtValidator: "0x0087cA806109E150438116cAA414580BB5fa9195",
    entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    aPNTs: "0x3BBcA92Ad828b3dD619c980Ba09f929b9d2BC440",
    priceFeed: "0x61Ec26aA57019C486B10502285c5A3D4A4750AD7",
    simpleAccountFactory: "0x91E6060613810449d098b0b5EC8b51A0fe8C8985",
    microPaymentChannel: "0x0000000000000000000000000000000000000000",
    agentIdentityRegistry: "0x0000000000000000000000000000000000000000",
    agentReputationRegistry: "0x0000000000000000000000000000000000000000",
    // ERC-8004 agent validation registry (SP v5.4) — not yet deployed on this chain.
    agentValidationRegistry: "0x0000000000000000000000000000000000000000",
    // --- AirAccount v0.17.2-beta.2 stack (not yet deployed on this chain) ---
    aaStarBLSAlgorithm: "0x0000000000000000000000000000000000000000",
    aaStarValidator: "0x0000000000000000000000000000000000000000",
    aaStarBLSAggregator: "0x0000000000000000000000000000000000000000",
    sessionKeyValidator: "0x0000000000000000000000000000000000000000",
    forceExitModule: "0x0000000000000000000000000000000000000000",
    airAccountDelegate: "0x0000000000000000000000000000000000000000",
    calldataParserRegistry: "0x0000000000000000000000000000000000000000",
    airAccountFactoryV7: "0x0000000000000000000000000000000000000000",
    airAccountV7Impl: "0x0000000000000000000000000000000000000000",
    airAccountExtension: "0x0000000000000000000000000000000000000000",
    agentRegistry: "0x0000000000000000000000000000000000000000",
    // SP v5.4 PolicyRegistry (DVT layer-1) — not yet deployed on this chain.
    policyRegistry: "0x0000000000000000000000000000000000000000",
    // SP v5.4 x402 settlement facilitator — not yet deployed on this chain.
    x402Facilitator: "0x0000000000000000000000000000000000000000",
    // SP v5.4 governance TimelockController — not yet deployed on this chain.
    timelockController: "0x0000000000000000000000000000000000000000",
    // Mycelium community PNTs token — Sepolia-only testbed; zero on mainnets.
    pnts: "0x0000000000000000000000000000000000000000",
  }
} as const;

export type CanonicalAddresses = (typeof CANONICAL_ADDRESSES)[keyof typeof CANONICAL_ADDRESSES];
export type SupportedChainId = keyof typeof CANONICAL_ADDRESSES;

/**
 * MushroomDAO launch token-sale stack (aPoints + governance-token sale), keyed by chainId.
 *
 * Kept as a SEPARATE table from {@link CANONICAL_ADDRESSES} on purpose: these are the launch
 * app's own contracts (`MushroomDAO/launch`), not the core SuperPaymaster protocol set, so they
 * stay out of the constants/contract-addresses/drift-check pipeline.
 *
 * De-dup rule: this table stores ONLY the launch-specific contracts (the two sale contracts +
 * BuyHelper) plus the accepted payment stablecoins. It deliberately does NOT store the GToken /
 * aPNTs *payout* token addresses — `TokenSaleClient` reads those on-chain from the sale contract's
 * `gToken()` / `aPNTs()` immutable getters, so there is never a second copy of a token address to
 * drift. (Background: multiple GToken deployments have existed — core canonical `0x20a051…`, an
 * earlier launch test GToken `0x4e6A11…`, and the launch DEPLOYED.md "SuperPaymaster" `0xa592ec…`.
 * The earlier Sepolia sale was constructor-bound to the test token; the Path-A redeploy
 * (2026-06-21, below) rebound it to the core-canonical GToken/aPNTs, so `getPayoutToken()` now
 * resolves on-chain to `0x20a051…` / `0x9e66B…`.)
 */
export interface LaunchSaleAddresses {
  /** SaleContractV2 — sells the constructor-bound GToken (governance token). */
  saleGToken: Address;
  /** APNTsSaleContract — sells the constructor-bound aPNTs (aPoints). */
  saleAPNTs: Address;
  /** BuyHelper — gasless entrypoint (EIP-3009 transferWithAuthorization + EIP-712 BuyIntent). */
  buyHelper: Address;
  /** Accepted payment stablecoin: USDC (6-decimal). Also the EIP-3009 token for gasless. */
  usdc: Address;
  /** Accepted payment stablecoin: USDT (6-decimal). Self-pay only. */
  usdt: Address;
  /**
   * Legacy single relayer base URL (Cloudflare Worker) — kept as the FINAL fallback. The SDK
   * appends `/v3/relay`. The primary gasless-relay pool now lives in the single-source DVT config
   * (`getDvtRelayerUrlsForChain`, AirAccount #98 / aastar-sdk #148/#153); `TokenSaleClient`
   * load-balances across it and only falls back here.
   */
  relayerUrl: string;
}

export const LAUNCH_SALE_ADDRESSES: Record<number, LaunchSaleAddresses> = {
  // --- Sepolia (Chain ID: 11155111) ---
  // Path-A reconciliation (2026-06-21): the sale stack was REDEPLOYED bound to the
  // core-canonical SuperPaymaster GToken (0x20a051…) / aPNTs (0x9e66B…) and the
  // inventory funded from the deployer, replacing the earlier test-token-bound
  // deployment. `getPayoutToken()` now resolves on-chain to the canonical tokens.
  11155111: {
    saleGToken: "0xA563fA13E2353aE7D65FCE37F4801288CD11FC3e", // SaleContractV2 → canonical GToken (audit-fix redeploy, #165 / launch#26#27)
    saleAPNTs: "0x9cF028D17b40E5249Ce119a2E642A6eC91a285D0", // APNTsSaleContract → canonical aPNTs
    buyHelper: "0x8d08fBD8297355BC93397820AE1CfFD884BEaA00", // BuyHelper (receiveWithAuthorization; BuyIntent domain verifyingContract; capExempt)
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    usdt: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0", // Aave Sepolia USDT (6-dec)
    // Gasless-relay pool now sourced from DVT_CONFIG (getDvtRelayerUrlsForChain) — single source of
    // truth. This Cloudflare Worker is only the FINAL fallback.
    relayerUrl: "https://mycelium-relayer.jhfnetboy.workers.dev",
  },
  // --- op-mainnet / ethereum-mainnet: reserved for the path-A reconciliation deploy ---
  // When launch deploys to mainnet, redeploy the sale stack bound to the core-canonical
  // SuperPaymaster GToken/aPNTs, then fill the new sale + BuyHelper addresses here.
};

/** Resolve the launch token-sale address group for a chain, or `undefined` if none. */
export function getLaunchSaleAddresses(chainId: number): LaunchSaleAddresses | undefined {
  return LAUNCH_SALE_ADDRESSES[chainId];
}

/**
 * Chain IDs that have a canonical address book in {@link CANONICAL_ADDRESSES}.
 *
 * @example
 * ```ts
 * listSupportedChainIds(); // [10, 11155111, 11155420]
 * ```
 */
export function listSupportedChainIds(): number[] {
  return Object.keys(CANONICAL_ADDRESSES).map(Number);
}

/** True if {@link CANONICAL_ADDRESSES} has an entry for `chainId`. */
export function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return Object.prototype.hasOwnProperty.call(CANONICAL_ADDRESSES, chainId);
}

/**
 * Resolve the canonical contract address book for a chain, keyed by `chainId`,
 * normalized to the key names the role-based client factories expect.
 *
 * The canonical table uses `staking` / `sbt`; the historical client factories
 * (and many consumers) reference `gTokenStaking` / `mySBT`. This helper returns
 * the canonical set plus those aliases so a single object satisfies both, which
 * is what makes `createEndUserClient({ chain })` resolve addresses automatically
 * — no manual `addresses` needed for any supported chain.
 *
 * @param chainId - EVM chain id (e.g. 10 = Optimism, 11155111 = Sepolia).
 * @returns The normalized address record, or `undefined` if the chain has no
 *          canonical entry (caller must then pass `addresses` explicitly).
 *
 * @example
 * ```ts
 * import { optimism } from 'viem/chains';
 * const addrs = getCanonicalAddresses(optimism.id); // chainId 10
 * addrs?.registry; addrs?.mySBT; // alias of `sbt`
 * ```
 */
export function getCanonicalAddresses(
  chainId: number,
): (CanonicalAddresses & { gTokenStaking: Address; mySBT: Address }) | undefined {
  if (!isSupportedChainId(chainId)) return undefined;
  const a = CANONICAL_ADDRESSES[chainId];
  return {
    ...a,
    // Aliases bridging the canonical table's key names to the client factories'.
    gTokenStaking: a.staking as Address,
    mySBT: a.sbt as Address,
  };
}

// Human labels for the supported chains, taken verbatim from viem/chains (`.name`)
// so the SDK stays in lockstep with viem and never invents its own chain identity.
const SUPPORTED_CHAIN_LABELS: Record<number, string> = {
  [optimism.id]: optimism.name,
  [sepolia.id]: sepolia.name,
  [optimismSepolia.id]: optimismSepolia.name,
};

/**
 * A friendly, human-readable list of the supported chains for error messages —
 * e.g. `"OP Mainnet (10), Sepolia (11155111), OP Sepolia (11155420)"`. Names come
 * from viem/chains so callers recognize them by the same label viem uses.
 */
export function describeSupportedChains(): string {
  return listSupportedChainIds()
    .map((id) => `${SUPPORTED_CHAIN_LABELS[id] ?? `chainId ${id}`} (${id})`)
    .join(', ');
}
