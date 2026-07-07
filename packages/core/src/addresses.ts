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
    PNTsPaymasterV4: "0x0000000000000000000000000000000000000000",   // Mycelium (Anni) → pnts; not deployed on this chain
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
  // Latest sync: 2026-06-28 — AirAccount contracts v0.20.3 (gasless self-call patch: onlyOwnerOrSelf
  //   on setTierLimits/modifyTierLimitsWithGuardians/setWeightConfig/modifyTierLimitsWithMixedGuardians
  //   so tier/weight config can be submitted as SuperPaymaster-sponsored UserOps — #140. Modifier-only
  //   change → ZERO ABI delta vs v0.20.2; but ACCOUNT_VERSION/FACTORY_VERSION bump redeployed impl+
  //   extension+factory+agentRegistry to fresh addrs). SuperPaymaster v5.4.1-rc.1 (FULL Sepolia redeploy,
  //   deployments/config.sepolia.json 2026-06-27; two-step slash guard + BLS_AGGREGATOR wiring).
  //   SP proxy 0x09DF... (impl 0x027481...), Registry 0xf5Bf... ; v5.4.1 keys: x402Facilitator
  //   0xfe1DB0..., policyRegistry 0x29253b..., timelockController 0x86C86c...
  //   AirAccount v0.20.3 (on-chain verified): impl 0x91Ee5a7 (ACCOUNT_VERSION 0.20.3), extension 0xC3F4Ff,
  //   factory 0x78775786 (FACTORY_VERSION 0.20.2, implementation()→0x91Ee5a7), agentRegistry 0x33B3287.
  //   NOTE: #60 syncs the v0.18 read-layer + addresses ONLY; v0.18 runtime-signing
  //   behavioral changes (BLS packer / #45 hash_to_curve binding) are a separate follow-up.
  //   NOTE: official community PaymasterV4s below — `aPNTsPaymasterV4` (AAStar → aPNTs) and
  //   `PNTsPaymasterV4` (Mycelium/Anni → pnts), auto-deployed by SuperPaymaster prepare-test and
  //   synced via config.sepolia.json. `paymasterV4` = the AAStar one (= aPNTsPaymasterV4).
  //   All verified on-chain (PaymasterFactory.getPaymasterList + isTokenSupported + owner).
  11155111: {
    registry: "0xf5Bf37ca83AfdAab73691bA7eCcDfA69b8708E71",
    gToken: "0x4c09aE57503Aa1E2A43b05621A38DbdD43b0Aa08",
    staking: "0x472297B557c1d0F030f281a5Bb8A535f6c5AB65e",
    sbt: "0x4867B4302bf4C7818b71F55E53A3520Ee1855Aa7",
    reputationSystem: "0x4Ec2D49D75D5D4206B64387A7d6a6C3c5c90fB5A",
    superPaymaster: "0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9",  // proxy (impl 0x0274811E...; v5.4.1-rc.1 2026-06-27 redeploy)
    paymasterFactory: "0xA936F8e3d682B0eCf280E6f5c05fF4204ee87180",
    paymasterV4: "0xf3948753ff21D33f6A5f516621FFF245B23efa0e",  // = aPNTsPaymasterV4 (AAStar)
    paymasterV4Impl: "0xc0F968625E3Ac0A2ad7f107cD5857425F672D268",
    // Official community PaymasterV4 instances (verified on-chain). AAStar's is an ERC-1167 clone of
    // paymasterV4Impl above (version PMV4-Deposit-4.5.0), owner = SuperPaymaster owner 0xb5600060….
    aPNTsPaymasterV4: "0xf3948753ff21D33f6A5f516621FFF245B23efa0e",  // AAStar community → aPNTs (0x696A7370)
    PNTsPaymasterV4: "0xC827747674ab6397c319e284f650D07d8c2a4a46",   // Mycelium (Anni) → pnts; on-chain verified 2026-06-28 (version PMV4-Deposit-4.5.0, isTokenSupported(pnts)==true, owner 0xEcAACb91…)
    xPNTsFactory: "0x67422d2e44a33c8dA99b3b776841bF316bD209a2",  // v5.4.1-rc.1 2026-06-27 redeploy
    // #285/CC-18 (SuperPaymaster #329 slash-consensus unify): switched to the NEW BLSAggregator/DVTValidator
    // deployment. SP executed `applyBLSAggregator()` (tx 0x691db4175bcce842beb1e93481573b4e843ea3e4d86793a2f07230cc611bfd26,
    // block 11216728); SP.BLS_AGGREGATOR now == 0xF51c…8B13 (pendingBLSAgg cleared), so SP recognises the new
    // aggregator on-chain. DVTValidator 0x568b1486… has addValidator×3 + registerBLSPublicKey×3 (slot 1/2/3).
    //   OLD (deprecated): blsAggregator 0x893b8fb7B3d203C288b481400fE05Ade5edD6d11 · dvtValidator 0x9946953af7aAA8F56e8dF4E46F68FFFA0c4F593D
    blsAggregator: "0xF51c029879685Ced8fbCfa4b647c2eAe50Cd8B13",  // NEW/active — SP applied (#285/CC-18)
    blsValidator: "0x0A71C5a32b8CBC517523D2C88b539Ab22AeF0654",  // deprecated; aggregator verifies BLS inline
    dvtValidator: "0x568b1486BFE036e603eA11f0D03Dc47fa62c9E0e",  // NEW/active — SP applied (#285/CC-18)
    entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    aPNTs: "0x696A73701b104c6cCBbAadDD2216788ea08EaB89",  // AAStar aPNTs (v5.4.1-rc.1 redeploy)
    priceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",  // Sepolia Chainlink ETH/USD
    simpleAccountFactory: "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985",
    microPaymentChannel: "0x37578b70B231CC0Eda5991CA633ae99eb35f3818",  // SP v5.4.1-rc.1 2026-06-27 redeploy
    agentIdentityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",  // ERC-8004 vanity addr (beta.3)
    agentReputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    // ERC-8004 agent validation registry (SP v5.4) — present in SP config.
    agentValidationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
    // --- AirAccount stack (Sepolia) — mixed versions ---
    // NOTE: the account triplet (airAccountFactoryV7 / airAccountV7Impl / airAccountExtension) was
    // subsequently redeployed to v0.23.0 (see those lines below: #159 isValidOwnerAuth owner-auth view,
    // FACTORY/ACCOUNT_VERSION 0.23.0 on-chain verified). The BLS/validator/session/recovery contracts in
    // this block below remain at v0.20.0 (not redeployed since). The v0.20.0 history that follows applies
    // to those unchanged contracts.
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
    // v0.27.0 DVT-unification (CC-10 Phase 1 / #274): the algId-0x01 verifier is now the unified DVT
    // validator (router.getAlgorithm(0x01)==0x539B, on-chain verified). It enforces strictly-ascending
    // nodeIds (SDK sorts them — #274) and operator registration via registerWithProof (nodeId=keccak256(pubkey)).
    aaStarBLSAlgorithm: "0x539B9681aFd5BFbCaa655Fe4c6BdcFe1fa7864bC",  // v0.27.0 DVT validator (algId 0x01; router.getAlgorithm(0x01) on-chain verified; validate()==0)
    aaStarValidator: "0xe68d6A7Bb60DA4caE62ceC2439722fc5eEF87a5c",  // v0.27.0 (ValidatorRouter; router.getAlgorithm(0x01)=DVT validator 0x539B on-chain verified)
    aaStarBLSAggregator: "0x35775df9a4f4dB42Ea0C46118a12dDd0cEc70609",  // v0.20.0 (SP-side aggregator; unchanged by DVT-unification)
    sessionKeyValidator: "0x6b044fB27B4763Fd30D02e41EDF2c62af4Aa946f",  // v0.24.0 (algId 0x08; NEW — security fix d #164 block self-call escalation)
    forceExitModule: "0x3fDe77868b74a7979A40a2293a1CD265fbe66EEc",  // v0.20.0
    airAccountDelegate: "0xd2735E54C5f5f2BF523b8a9ddd0E183624c3f2c0",  // v0.20.0
    calldataParserRegistry: "0x7dEea4544446826601014bD94d0F6432A67496F5",  // v0.20.0
    airAccountFactoryV7: "0xf25621DF4c6100cdfe224054C2b09f2963bF487b",  // v0.27.0 (FACTORY_VERSION 0.27.0 on-chain verified; DVT-unification redeploy)
    airAccountV7Impl: "0x4a76dEf9eE4EE44eF6D0B2a327a068B5B7931E1C",  // v0.27.0 (ACCOUNT_VERSION 0.27.0; factory.implementation() on-chain verified)
    airAccountExtension: "0xEcE87546989Da7df573b107D54a0ead0aCB49923",  // v0.27.0 (DVT-unification redeploy)
    agentRegistry: "0x239960EeA98cEC6f02608ED4Bc440b7d8442f3Da",  // v0.27.0 (DVT-unification redeploy)
    // SP v5.4 PolicyRegistry (DVT layer-1), deployed on Sepolia.
    // Source of truth: SuperPaymaster repo deployments/config.sepolia.json (v5.4.0-beta.1).
    policyRegistry: "0x29253bF61310B63866dfb9E9f464B6d95E09f2C1",
    // SP v5.4 x402 settlement facilitator (verify/settle EIP-3009 + direct xPNTs).
    x402Facilitator: "0xfe1DB01e1d6622e722B92ed5993af61325DB92aF",
    // SP v5.4 governance TimelockController (2-day minDelay; gates PolicyRegistry loosen/unfreeze).
    timelockController: "0x86C86c789EDc099801cc6a5F48334F1D67dC9564",
    // Base PNTs token — authoritative value from the SuperPaymaster Sepolia
    // deployment (deployments/config.sepolia.json) and config.sepolia.json here.
    // Was 0x6A230Fa25b9Ec12eeF8eeb8d2FbE32CF29c6edC6 ("Anni's xPNTsToken"), which
    // drifted from the live deployment; realigned per "Sepolia deployment is the
    // source of truth". A community-specific xPNTs belongs under its own key, not
    // the canonical base `pnts`.
    pnts: "0xE6579A90dc498a710008de12119812D0FB7aA224",
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
