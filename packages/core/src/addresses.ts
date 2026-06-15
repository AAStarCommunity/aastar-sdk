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
  //                  AirAccount repo docs/DEPLOYMENT-v0.17.2-beta.3.md
  // Latest sync: 2026-06-15 — SuperPaymaster v5.4.0-beta.1 + AirAccount v0.17.2-beta.3
  //   SP proxy 0xFb09... (impl 0xE84Ae83E...), Registry 0xB5Fb... (impl 0x0B5ce703...)
  //   v5.4 adds: x402Facilitator 0xFe95a77e..., policyRegistry 0x37e4E40e..., timelockController 0x6cEc100c...
  //   AirAccount router NEW 0x3c2b... (M3 governance timelock), finalized.
  //   NOTE: `paymasterV4` below is a per-community AOA proxy (not in core config);
  //   verify against the community's own deployment before use.
  11155111: {
    registry: "0xB5Fb8920F7AcD8b395934bd1F21222b32A30eF1A",
    gToken: "0x46B82966f8a40f0Bbb8C13aCfBA746631CC2ec72",
    staking: "0x574820E26Acb7D9a1202708C6183d6A8aC957dA6",
    sbt: "0x754CeB687aCFC72136B02a1cb7cE2F911B63F1f8",
    reputationSystem: "0xDD4D6162F426998E8B8FC97D0a8a5912cd70e6E0",
    superPaymaster: "0xFb090E82bD041C6e9787eDEbE1D3BE55b3c7266a",  // proxy (impl 0xE84Ae83E...)
    paymasterFactory: "0x60B8f728Abca14B82a4EC72f00Ff5437e0702e90",
    paymasterV4: "0x1f0D4eF151a79948070D387BaC43b1321F0c41e3",  // Anni's V4 proxy — NOT in core config, verify separately
    paymasterV4Impl: "0x59aEAec186a8883c165adf5C72a64df2fD9af068",
    xPNTsFactory: "0xc312CAFcb49dFe3aB76bFB2F3e37CaEdBa65ccd9",  // beta.3 (was 0xC4f5...)
    blsAggregator: "0x7ec72505220a13040c80EF2B895Bf3405b6ed3e9",  // SP BLSAggregator beta.3 (was 0xCDCdb8...)
    blsValidator: "0x0A71C5a32b8CBC517523D2C88b539Ab22AeF0654",  // deprecated; aggregator verifies BLS inline
    dvtValidator: "0xB60C82158734def92D0d2163C93927cf19b86a95",
    entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    aPNTs: "0x9f0E11e0D33Ec0a5c9608990E7B3498B5EE3210B",  // AAStar aPNTs (deployer operator)
    priceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",  // Sepolia Chainlink ETH/USD
    simpleAccountFactory: "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985",
    microPaymentChannel: "0xbD1807328Dd654512B13d6320C9Cc78685a405Ed",  // beta.3 (was 0x5753...)
    agentIdentityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",  // ERC-8004 vanity addr (beta.3)
    agentReputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    // --- AirAccount stack: beta.3 base; account contracts upgraded to v0.17.2-beta.4 ---
    // beta.4 reuses the beta.3 router/sessionKey/forceExit/BLS (per the beta.4 migration notes);
    // only Factory/Impl/Extension/Delegate/AgentRegistry change for bundler-compat.
    aaStarBLSAlgorithm: "0xB82127182A855B82eED05e47536FcE568b626457",  // unchanged
    aaStarValidator: "0x3c2b06f50300912794f29de031b33dd37bb8d6c6",  // beta.3 router (reused by beta.4)
    aaStarBLSAggregator: "0xBAc3f24946d0eb15189E1c01e38182e5B078Bbc1",  // unchanged
    sessionKeyValidator: "0x655ca2e9a2d1178f7fbcea1856560d1e0c657ebf",  // beta.3 (reused by beta.4)
    forceExitModule: "0xdb396ca2dc279f9bcb95fa3d8275f77c9f0c8702",  // beta.3 (reused by beta.4)
    airAccountDelegate: "0x4bda4849b80cc444fb2da65beec0724005c6675c",  // v0.17.2-beta.4 (bundler-compat)
    calldataParserRegistry: "0x076EE45d2a97F70FCb2e45809DC5f9b72BB4883F",  // unchanged
    airAccountFactoryV7: "0x3a9127a5f0b4ca734d54629d0c3ad9f52739c071",  // v0.17.2-beta.4
    airAccountV7Impl: "0x0321Fa7261Ad5945e4B3f0c73aFD7D9392E39796",  // v0.17.2-beta.4
    airAccountExtension: "0x20FB2A65a52Fc6507FdD51260f055017a2BA2860",  // v0.17.2-beta.4
    agentRegistry: "0xe1320c35485b4d7817866a8d0d8f77dd58202253",  // v0.17.2-beta.4
    // SP v5.4 PolicyRegistry (DVT layer-1), deployed on Sepolia.
    // Source of truth: SuperPaymaster repo deployments/config.sepolia.json (v5.4.0-beta.1).
    policyRegistry: "0x37e4E40e69Fb7d5C3fbAA0F52A4002D27472Ff29",
    // SP v5.4 x402 settlement facilitator (verify/settle EIP-3009 + direct xPNTs).
    x402Facilitator: "0xFe95a77e4Db593E6EA88000Aad9cD1230BAB4512",
    // SP v5.4 governance TimelockController (2-day minDelay; gates PolicyRegistry loosen/unfreeze).
    timelockController: "0x6cEc100c9CDc6ee7D9EDe0533edD3554E641DdBF",
    // Base PNTs token — authoritative value from the SuperPaymaster Sepolia
    // deployment (deployments/config.sepolia.json) and config.sepolia.json here.
    // Was 0x6A230Fa25b9Ec12eeF8eeb8d2FbE32CF29c6edC6 ("Anni's xPNTsToken"), which
    // drifted from the live deployment; realigned per "Sepolia deployment is the
    // source of truth". A community-specific xPNTs belongs under its own key, not
    // the canonical base `pnts`.
    pnts: "0x5aa8b75eF1650CF3C67b17b474677eD5C847A435",
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
    simpleAccountFactory: "0x91E6060613810449d098b0b5Ec8b51A0FE8c8985",
    microPaymentChannel: "0x0000000000000000000000000000000000000000",
    agentIdentityRegistry: "0x0000000000000000000000000000000000000000",
    agentReputationRegistry: "0x0000000000000000000000000000000000000000",
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
