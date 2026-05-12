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
  },

  // --- Sepolia (Chain ID: 11155111) ---
  // Source of truth: SuperPaymaster repo `deployments/config.sepolia.json`
  // Latest sync: 2026-05-12 — post v5.3.2 UUPS upgrade
  //   Registry @ Registry-5.3.3, SuperPaymaster @ SuperPaymaster-5.3.2
  //   spImpl currently delegating: 0x6B84C7A49E6A4fB139f279B148359E82dB6370eE
  //   New on-chain deployment from 2026-05-10 DeployLive (deployer 0xb56...adf0E)
  11155111: {
    registry: "0xa62EFc8a9138617E245bd21BcF5b5E406D864525",
    gToken: "0x4e6A1125B8619d6D05c99AB2F30BDFc96C843B67",
    staking: "0x197D243Ee21815a6419406B066626db94D8D7F99",
    sbt: "0xA74820A243B34904290ae4e614cE9cCE6e242fA4",
    reputationSystem: "0xE25E29e32D62f8BE8a61EfD8C7f1d431B95FB8b3",
    superPaymaster: "0x33404ccD9559759b85302cFfB19e66dA25380aDf",  // V5.3.2 Proxy (impl 0x6B84C7A4...)
    paymasterFactory: "0x9c80Fe26bDd01bEb958d6560fcbF2d1F511C4629",
    paymasterV4: "0x1f0D4eF151a79948070D387BaC43b1321F0c41e3",  // Anni's V4 proxy (anniPaymaster)
    paymasterV4Impl: "0xC2a08d1d6e14c7E1306c53A787CEDA50E69b2836",
    xPNTsFactory: "0x0195f1f30276f1455F650207F9A1D2AAeABBEc7D",
    blsAggregator: "0x01E18f6460d1e4581E2c7Dd3A65e3eF26e962F16",
    // blsValidator: standalone BLSValidator was deprecated in P0-1; aggregator
    // verifies BLS inline now. Address kept (0x0A71C5a3...) only for legacy
    // tooling — do not use for new integrations.
    blsValidator: "0x0A71C5a32b8CBC517523D2C88b539Ab22AeF0654",
    dvtValidator: "0x70a06AC908e3589B0B9DC35D657D96Fa1F0Fb1f1",
    entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    aPNTs: "0x4C4EC2e866f0c43DCA4670A6033e962a05B4C772",  // AAStar aPNTs (deployer operator)
    priceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",  // Sepolia Chainlink ETH/USD
    simpleAccountFactory: "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985",
    // SP V5.3 新增合约（Agent Economy + x402 + Streaming Channels）
    microPaymentChannel: "0x5753e9675f68221cA901e495C1696e33F552ea36",
    agentIdentityRegistry: "0x400624Fa1423612B5D16c416E1B4125699467d9a",
    agentReputationRegistry: "0x2D82b2De1A0745454cDCf38f8c022f453d02Ca55",
    // Mycelium community PNTs token (Anni's xPNTsToken)
    pnts: "0x83ca2b02f325B2C2e846BFe7582993acD10E5cc8",
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
  }
} as const;

export type CanonicalAddresses = (typeof CANONICAL_ADDRESSES)[keyof typeof CANONICAL_ADDRESSES];
export type SupportedChainId = keyof typeof CANONICAL_ADDRESSES;
