export enum EntryPointVersion {
  V0_6 = "0.6",
  V0_7 = "0.7",
  V0_8 = "0.8",
}

export interface EntryPointConfig {
  version: EntryPointVersion;
  address: string;
  factoryAddress: string;
  validatorAddress: string;
}

/** Default EntryPoint addresses (same on Sepolia, Mainnet, and OP Mainnet). */
export const ENTRYPOINT_ADDRESSES = {
  [EntryPointVersion.V0_6]: {
    sepolia: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    mainnet: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    optimism: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  },
  [EntryPointVersion.V0_7]: {
    sepolia: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    mainnet: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    optimism: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  },
  [EntryPointVersion.V0_8]: {
    sepolia: "0x0576a174D229E3cFA37253523E645A78A0C91B57",
    mainnet: "0x0576a174D229E3cFA37253523E645A78A0C91B57",
    optimism: "0x0576a174D229E3cFA37253523E645A78A0C91B57",
  },
};

export const ENTRYPOINT_ABI_V6 = [
  "function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external",
  "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)",
  "function getUserOpHash((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external view returns (bytes32)",
  "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address payable beneficiary) external",
];

export const ENTRYPOINT_ABI_V7_V8 = [
  "function simulateValidation((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes) packedUserOp) external",
  "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)",
  "function getUserOpHash((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes) packedUserOp) external view returns (bytes32)",
  "function handleOps((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes)[] ops, address payable beneficiary) external",
];

export const FACTORY_ABI_V6 = [
  "function getAddress(address creator, address signer, address validator, bool useAAStarValidator, uint256 salt) view returns (address)",
  "function createAccountWithAAStarValidator(address creator, address signer, address aaStarValidator, bool useAAStarValidator, uint256 salt) returns (address)",
];

export const FACTORY_ABI_V7_V8 = [
  "function getAddress(address creator, address signer, address validator, bool useAAStarValidator, uint256 salt) view returns (address)",
  "function createAccount(address creator, address signer, address aaStarValidator, bool useAAStarValidator, uint256 salt) returns (address)",
];

export const ACCOUNT_ABI = [
  "function execute(address dest, uint256 value, bytes calldata func) external",
];

export const VALIDATOR_ABI = [
  "function getGasEstimate(uint256 nodeCount) external pure returns (uint256 gasEstimate)",
];

// ── AirAccount M4 Contract Addresses (Sepolia) ──────────────────

export const AIRACCOUNT_ADDRESSES = {
  sepolia: {
    factory: "0x914db0a849f55e68a726c72fd02b7114b1176d88",
    validatorRouter: "0x730a162Ce3202b94cC5B74181B75b11eBB3045B1",
    blsAlgorithm: "0xc2096E8D04beb3C337bb388F5352710d62De0287",
    superPaymaster: "0x16cE0c7d846f9446bbBeb9C5a84A4D140fAeD94A",
  },
};

// ── AirAccount ABIs ──────────────────────────────────────────────

export const AIRACCOUNT_ABI = [
  "function execute(address dest, uint256 value, bytes calldata func) external",
  "function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external",
  "function owner() external view returns (address)",
  "function validator() external view returns (address)",
  "function setValidator(address _validator) external",
  "function setP256Key(bytes32 _x, bytes32 _y) external",
  "function setTierLimits(uint256 _tier1, uint256 _tier2) external",
  "function tier1Limit() external view returns (uint256)",
  "function tier2Limit() external view returns (uint256)",
  "function p256KeyX() external view returns (bytes32)",
  "function p256KeyY() external view returns (bytes32)",
  "function guardianCount() external view returns (uint8)",
  "function getConfigDescription() external view returns (tuple(address accountOwner, address guardAddress, uint256 dailyLimit, uint256 dailyRemaining, uint256 tier1Limit, uint256 tier2Limit, address[3] guardianAddresses, uint8 guardianCount, bool hasP256Key, bool hasValidator))",
];

export const AIRACCOUNT_FACTORY_ABI = [
  "function createAccount(address owner, uint256 salt, tuple(address[3] guardians, uint256 dailyLimit, uint8[] approvedAlgIds) config) external returns (address)",
  "function getAddress(address owner, uint256 salt, tuple(address[3] guardians, uint256 dailyLimit, uint8[] approvedAlgIds) config) external view returns (address)",
  "function createAccountWithDefaults(address owner, uint256 salt, address guardian1, address guardian2, uint256 dailyLimit) external returns (address)",
  "function getAddressWithDefaults(address owner, uint256 salt, address guardian1, address guardian2, uint256 dailyLimit) external view returns (address)",
];

export const GLOBAL_GUARD_ABI = [
  "function remainingDailyAllowance() external view returns (uint256)",
  "function dailyLimit() external view returns (uint256)",
  "function approvedAlgorithms(uint8 algId) external view returns (bool)",
  "function account() external view returns (address)",
];

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];
