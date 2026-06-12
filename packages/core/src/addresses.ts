/**
 * Canonical Contract Addresses for Supported Networks
 * These are hardcoded as defaults for NPM distribution.
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
    // Mycelium community PNTs token — Sepolia-only testbed; zero on mainnets.
    // Kept here so the inferred CanonicalAddresses union has `pnts` on every
    // chain (consumers see Address, not Address|undefined per-chain).
    pnts: "0x0000000000000000000000000000000000000000",
  },

  // --- Sepolia (Chain ID: 11155111) ---
  // Source of truth: SuperPaymaster repo `deployments/config.sepolia.json`
  // Latest sync: 2026-05-29 — post audit-core-toolchain redeploy (updateTime 2026-05-29 21:57:56)
  //   Registry @ Registry-5.3.x (impl 0x24F262702A72Bc5E0255c0ed513b6a2021Ee1129)
  //   SuperPaymaster proxy 0xFb09... (impl spImpl 0x8E2d93Bb9176b5796fFA91587BD2a755510C9819)
  //   ERC-8004 agent registries now use the 0x8004… vanity addresses.
  //   NOTE: `paymasterV4` below is a per-community AOA proxy (not in core config);
  //   verify against the community's own deployment before use.
  11155111: {
    registry: "0xB5Fb8920F7AcD8b395934bd1F21222b32A30eF1A",
    gToken: "0x46B82966f8a40f0Bbb8C13aCfBA746631CC2ec72",
    staking: "0x574820E26Acb7D9a1202708C6183d6A8aC957dA6",
    sbt: "0x754CeB687aCFC72136B02a1cb7cE2F911B63F1f8",
    reputationSystem: "0xDD4D6162F426998E8B8FC97D0a8a5912cd70e6E0",
    superPaymaster: "0xFb090E82bD041C6e9787eDEbE1D3BE55b3c7266a",  // proxy (impl 0x8E2d93Bb...)
    paymasterFactory: "0x60B8f728Abca14B82a4EC72f00Ff5437e0702e90",
    paymasterV4: "0x1f0D4eF151a79948070D387BaC43b1321F0c41e3",  // Anni's V4 proxy — NOT in core config, verify separately
    paymasterV4Impl: "0x59aEAec186a8883c165adf5C72a64df2fD9af068",
    xPNTsFactory: "0xC4f5A121c426734CC1c0DbE57f6A2Dd764E278e4",
    blsAggregator: "0xCDCdb8e2b62cdDCC3918f4d120322C6eB5910276",
    // blsValidator: standalone BLSValidator was deprecated in P0-1; aggregator
    // verifies BLS inline now. Not in core config — legacy address kept for
    // tooling only; do not use for new integrations.
    blsValidator: "0x0A71C5a32b8CBC517523D2C88b539Ab22AeF0654",
    dvtValidator: "0xB60C82158734def92D0d2163C93927cf19b86a95",
    entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    aPNTs: "0x9f0E11e0D33Ec0a5c9608990E7B3498B5EE3210B",  // AAStar aPNTs (deployer operator)
    priceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",  // Sepolia Chainlink ETH/USD
    simpleAccountFactory: "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985",
    // SP V5.3 新增合约（Agent Economy + x402 + Streaming Channels）
    microPaymentChannel: "0x5753e9675f68221cA901e495C1696e33F552ea36",
    agentIdentityRegistry: "0x400624Fa1423612B5D16c416E1B4125699467d9a",
    agentReputationRegistry: "0x2D82b2De1A0745454cDCf38f8c022f453d02Ca55",
    // NOTE: config.sepolia.json also has agentValidationRegistry
    // (0x8004Cb1BF31DAf7788923b405b754f57acEB4272). It is intentionally NOT added
    // here yet: CANONICAL_ADDRESSES is a homogeneous union (every chain must share
    // the same keys), and no SDK client consumes the validation registry today.
    // Add it to ALL chain blocks (0x0 on chains without it) when an SDK client needs it.
    // --- AirAccount v0.17.2-beta.2 stack (synced 2026-06-03 from airaccount-contract) ---
    aaStarBLSAlgorithm: "0xB82127182A855B82eED05e47536FcE568b626457",
    aaStarValidator: "0x29edC0e59C7cCcd89334139556Bc254bBC1B1E2F",
    aaStarBLSAggregator: "0xBAc3f24946d0eb15189E1c01e38182e5B078Bbc1",
    sessionKeyValidator: "0xc1e2534D9Cae27Fd9776e612229115604A9e07E9",
    forceExitModule: "0xc7128A1F66DFf7B607d595371FCAEeAdC485CFC9",  // v0.17.2-beta.2 (LOW-3 stale-guardian fix)
    airAccountDelegate: "0x8603AAF6C3f07fdae810B323c95a198D796EC52E",
    calldataParserRegistry: "0x076EE45d2a97F70FCb2e45809DC5f9b72BB4883F",
    airAccountFactoryV7: "0xc6c7FA51814f109Dea73757c73c378a25b2BAeE9",
    airAccountV7Impl: "0x05274e4Af481e5c23287571F71C52afCCC5Df127",
    airAccountExtension: "0x6e3E6d7e6DFb383CeaAe6A9ae478745FFc5cAac0",
    agentRegistry: "0xc60E7D1d13027Ed63a899926ba1a9A2692f1D9EB",
    // Mycelium community PNTs token (Anni's xPNTsToken)
    pnts: "0x6A230Fa25b9Ec12eeF8eeb8d2FbE32CF29c6edC6",
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
    // Mycelium community PNTs token — Sepolia-only testbed; zero on mainnets.
    pnts: "0x0000000000000000000000000000000000000000",
  }
} as const;

export type CanonicalAddresses = (typeof CANONICAL_ADDRESSES)[keyof typeof CANONICAL_ADDRESSES];
export type SupportedChainId = keyof typeof CANONICAL_ADDRESSES;
