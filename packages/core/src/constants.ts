/**
 * Common Constants
 */

/**
 * Default faucet API URL for testnet token requests
 */
export const FAUCET_API_URL = "https://faucet-aastar.vercel.app";

/**
 * Service fee rate in basis points (200 = 2%)
 */
export const SERVICE_FEE_RATE = 200;

/**
 * Maximum service fee in basis points (1000 = 10%)
 */
export const MAX_SERVICE_FEE = 1000;

/**
 * Basis points denominator (100% = 10000 basis points)
 */
export const BPS_DENOMINATOR = 10000;

/**
 * Default amount of gas tokens to mint for testing (in token units)
 */
export const DEFAULT_GAS_TOKEN_MINT_AMOUNT = "100";

/**
 * Default amount of USDT to mint for testing (in USDT)
 */
export const DEFAULT_USDT_MINT_AMOUNT = "10";

/**
 * Size of test account pool
 */
export const TEST_ACCOUNT_POOL_SIZE = 20;

/**
 * Minimum stake amount for different node types (in sGT)
 */
export const NODE_STAKE_AMOUNTS = {
  /** Lite Node: 30 sGT minimum stake */
  LITE: 30,
  /** Standard Node: 100 sGT minimum stake */
  STANDARD: 100,
  /** Super Node: 300 sGT minimum stake */
  SUPER: 300,
  /** Enterprise Node: 1000 sGT minimum stake */
  ENTERPRISE: 1000,
} as const;

/**
 * Default aPNTs price in USD (0.02 USD per aPNT)
 */
export const DEFAULT_APNTS_PRICE_USD = "0.02";

/**
 * Registry V3 Role Identifiers (Keccak256)
 */
export const ROLE_ENDUSER = "0x0c34ecc75d3bf122e0609d2576e167f53fb42429262ce8c9b33cab91ff670e3a";
export const ROLE_COMMUNITY = "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
export const ROLE_PAYMASTER_AOA = "0xf86d13979a91272f2c54c4147e588ecbeaad32dd1e0a5332a77356847049a70e";
export const ROLE_PAYMASTER_SUPER = "0xe94d78b6d8fb99b2c21131eb4552924a60f564d8515a3cc90ef300fc9735c074";
export const ROLE_KMS = "0x6fb2b25080d21c908f32ff8ff99eb1d552c210854f7de48a40406764c09c68f8";
export const ROLE_ANODE = "0x3aa2e9509f29532b71f822e18bcde843a8070a508d564188ec8a6adf59eff28a";
