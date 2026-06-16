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
    paymasterV4: "0x67a70a578E142b950987081e7016906ae4F56Df4",  // AAStar Community PM (Jason)
    paymasterV4Impl: "0xc4dd13F7825409EEC13FBCBdD9D8f6d618207cca",
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
  // Latest sync: 2026-06-16 — SuperPaymaster v5.4.0-beta.1-redeploy (fresh Sepolia
  //   redeploy, deployments/config.sepolia.json updateTime 2026-06-16) + AirAccount
  //   contracts v0.19.0-beta.2 (pin only; surface identical to v0.18.0-beta.2, same addresses).
  //   SP proxy 0x0300... (impl 0x24a945...), Registry 0x3F92... (impl 0x177033...)
  //   v5.4 keys: x402Facilitator 0x326Fc3..., policyRegistry 0x8c2488..., timelockController 0xB734df...
  //   AirAccount v0.19.0-beta.2 factory 0x1b69... (NEW ctor: impl injected as arg 1).
  //   NOTE: #60 syncs the v0.18 read-layer + addresses ONLY; v0.18 runtime-signing
  //   behavioral changes (BLS packer / #45 hash_to_curve binding) are a separate follow-up.
  //   NOTE: `paymasterV4` below is a per-community AOA proxy (not in core config);
  //   verify against the community's own deployment before use.
  11155111: {
    registry: "0x3F920B25f8b65988359C372F66F036E48adFc556",
    gToken: "0x20a051502a7AE6e40cfFd6EBe59057538E698984",
    staking: "0x3B363598746Ea57314d4869B160940948c569D48",
    sbt: "0x072A0D12f4212B6baD7c6d0A633eaffbDE9105bF",
    reputationSystem: "0x7fEd690E1663755e24a1C9d6164336809d68a578",
    superPaymaster: "0x030025f40d509b1a99547bAEb3795bD27F7182b7",  // proxy (impl 0x24a94572...; 2026-06-16 redeploy)
    paymasterFactory: "0x0Aa06EA5295eeD4D48c93c594Db1CBf3626971A5",
    paymasterV4: "0x1f0D4eF151a79948070D387BaC43b1321F0c41e3",  // Anni's V4 proxy — NOT in core config, verify separately
    paymasterV4Impl: "0x59DCA5861aaDA602fE1BFbfcc36DFAc36C58623d",
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
    // --- AirAccount v0.19.0-beta.2 stack (FULL Sepolia redeploy 2026-06-16) ---
    // v0.19 has NO new Solidity logic (feature set identical to v0.18.0-beta.2), but it
    // bumped ACCOUNT_VERSION/FACTORY_VERSION/accountId() → "0.19.0", which changes bytecode
    // and therefore redeployed the ENTIRE stack to fresh addresses. All 11 below moved —
    // the v0.18.0-beta.2 addresses are now stale. Verified by the v0.19 36-scenario on-chain
    // E2E (Safe-guardian recovery #42 + KMS contract-side #67) + DVT real-node validate=0.
    // Source of truth: AirAccount repo CHANGELOG.md [v0.19.0-beta.2] "Deployed (Sepolia 2026-06-16)".
    // NOTE: factory ctor is NEW — impl injected as arg 1.
    aaStarBLSAlgorithm: "0x68c381Ad3A2e3380F22840008027E9Ec2783F43A",  // v0.19.0-beta.2 (#45 on-chain hash_to_curve; Ownable2Step; aggregator() getter)
    aaStarValidator: "0xC20A986Bcd5bF5Cc2fE5fFde6b155B8419E0389e",  // v0.19.0-beta.2 (ValidatorRouter, set-once validator)
    aaStarBLSAggregator: "0x77f7bf95B8602b7851f392F412257539242947e0",  // v0.19.0-beta.2 (new ctor (blsAlgorithm, entryPoint))
    sessionKeyValidator: "0x70de2e36004d6Ddc24DEB80e1Ef76c03EdC0c2AE",  // v0.19.0-beta.2 (cap + velocity)
    forceExitModule: "0xd882a16Ea37Be463D1885EF4a397Dbbf157dC211",  // v0.19.0-beta.2 (TOCTOU re-verify)
    airAccountDelegate: "0xA8D7f70c9D36bC4a4eb14F0dCEE19053FCB3309f",  // v0.19.0-beta.2
    calldataParserRegistry: "0xb8Af1C039dF88F6bD9fE36Ca683492a3c09e7D17",  // v0.19.0-beta.2
    airAccountFactoryV7: "0x52c5190E7308Ea9B149157FF016cC99B6C6bf984",  // v0.19.0-beta.2 (NEW ctor: implementation injected as arg 1)
    airAccountV7Impl: "0x7fe62d512f0b8238DE6Ff17175DcE40eA312bBF2",  // v0.19.0-beta.2
    airAccountExtension: "0xD61C0F3DE6D98070E9986743d35A56d56855A249",  // v0.19.0-beta.2 (module-install timelock)
    agentRegistry: "0x3895b3E6fEf4e121E6289dC7881A0eEd5283C652",  // v0.19.0-beta.2 (bindFactory set-once)
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
