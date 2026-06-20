import { CANONICAL_ADDRESSES } from "@aastar/core";

// Single source of truth: derive AirAccount's CURRENT (non-deprecated) Sepolia
// contract addresses from @aastar/core's CANONICAL_ADDRESSES. core is the
// foundation package and never imports airaccount, so there is no circular dep.
// See AIRACCOUNT_ADDRESSES below for the per-field key mapping.
const CORE_SEPOLIA = CANONICAL_ADDRESSES[11155111];

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

// ── AirAccount Contract Addresses (Sepolia) ──────────────────────

export const AIRACCOUNT_ADDRESSES = {
  sepolia: {
    // M4 factory (legacy — 3-field InitConfig)
    factoryM4: "0x914db0a849f55e68a726c72fd02b7114b1176d88",
    // M5 factory r5 — 6-field InitConfig, guardian acceptance sigs required
    factoryM5: "0xd72a236d84be6c388a8bc7deb64afd54704ae385",
    /** @deprecated defaultCommunityGuardian was address(0); superseded by r6 and r4. Do not use for new accounts. */
    factoryM7r5Prev: "0xa0007c5dB27548D8c1582773856dB1D123107383",

    // ── Deprecated: r6 addresses (2026-03-29 deployment, superseded by r4 audit-final) ──────────
    // Retain for legacy account lookups and historical event indexing ONLY.
    // DO NOT use for new account creation — CREATE2 address will differ from r4.
    /** @deprecated Use {@link factory} (r4 audit-final) for new accounts. */
    factoryM7r6: "0x42f82d77f9cf940686b6a64a369245cb563e0e85",
    /** @deprecated Use {@link accountImpl} (r4 audit-final). */
    accountImplM7r6: "0x2F1B4EB63143D338bE78d0AF878B806f075080c1",
    /** @deprecated Use {@link compositeValidator} (r4 audit-final). */
    compositeValidatorM7r6: "0x4135c539fec5e200fe9762b721f6829b2315cbe1",
    /** @deprecated Use {@link tierGuardHook} (r4 audit-final). */
    tierGuardHookM7r6: "0x73572e9e6138fd53465ee243e2fb4842cf86a787",
    /** @deprecated Use {@link agentSessionKeyValidator} (r4 audit-final). */
    agentSessionKeyValidatorM7r6: "0xa3e52db4b6e0a9d7cd5dd1414a90eedcf950e029",

    // ── Deprecated: r4 audit-final (v0.16.0 era — pre-beta). Retained for existing account recovery. ─
    /** @deprecated Use factory (beta.4) for new accounts. */
    factoryM7r4: "0x61bBAf9E1b8Fd78fF874776cFa50497dB9d43C3F",
    /** @deprecated */
    accountImplM7r4: "0xA674D308ce22230B70412b20Ee5a66fC6B24F49c",
    /** @deprecated Use validatorRouter. */
    validatorRouterM7r4: "0x730a162Ce3202b94cC5B74181B75b11eBB3045B1",
    /** @deprecated */
    compositeValidatorM7r4: "0xB65569950C48AA56dbe876915ca3605fD6FF2980",
    /** @deprecated */
    tierGuardHookM7r4: "0x67f878295cFF7451CBD2A775C4490607AF1b07d7",
    /** @deprecated */
    agentSessionKeyValidatorM7r4: "0x1F06961e133217801F92e1CF552187F594a32873",

    // ── Current: derived from @aastar/core CANONICAL_ADDRESSES[11155111] ───────────
    // SINGLE SOURCE OF TRUTH. Do NOT hand-copy hex here. core is synced on every
    // protocol redeploy (currently AirAccount v0.19.0-beta.2, Sepolia 2026-06-16),
    // and these fields re-derive automatically. The key mapping (airaccount field ←
    // core key) is asserted by entrypoint.addresses.test.ts so it can't silently drift.
    factory: CORE_SEPOLIA.airAccountFactoryV7,
    factoryM7: CORE_SEPOLIA.airAccountFactoryV7,
    accountImpl: CORE_SEPOLIA.airAccountV7Impl,
    validatorRouter: CORE_SEPOLIA.aaStarValidator,
    blsAlgorithm: CORE_SEPOLIA.aaStarBLSAlgorithm,
    blsAggregator: CORE_SEPOLIA.aaStarBLSAggregator,
    // SuperPaymaster proxy — same concept as core's `superPaymaster` proxy.
    superPaymaster: CORE_SEPOLIA.superPaymaster,
    sessionKeyValidator: CORE_SEPOLIA.sessionKeyValidator,
    forceExitModule: CORE_SEPOLIA.forceExitModule,
    airAccountDelegate: CORE_SEPOLIA.airAccountDelegate,
    airAccountExtension: CORE_SEPOLIA.airAccountExtension,
    agentRegistry: CORE_SEPOLIA.agentRegistry,
    calldataParserRegistry: CORE_SEPOLIA.calldataParserRegistry,
    // uniswapV3Parser is airaccount-specific (not in core) — keep hardcoded.
    uniswapV3Parser: "0x5671810ac8aa1857397870e60232579cfc519515",
  },
};

// ── AirAccount ABIs ──────────────────────────────────────────────

export const AIRACCOUNT_ABI = [
  // ── Core execution ──
  "function execute(address dest, uint256 value, bytes calldata func) external",
  "function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external",
  // ── ERC-7579 Module Management (M7.2) ──
  "function installModule(uint256 moduleTypeId, address module, bytes calldata initData) external",
  "function uninstallModule(uint256 moduleTypeId, address module, bytes calldata deInitData) external",
  "function executeFromExecutor(bytes32 mode, bytes calldata executionCalldata) external returns (bytes[] memory returnData)",
  // ── ERC-7579 Introspection ──
  "function accountId() external pure returns (string memory)",
  "function supportsModule(uint256 moduleTypeId) external pure returns (bool)",
  "function isModuleInstalled(uint256 moduleTypeId, address module, bytes calldata additionalContext) external view returns (bool)",
  // ── ERC-1271 / ERC-165 ──
  "function isValidSignature(bytes32 hash, bytes calldata sig) external view returns (bytes4)",
  "function validateCompositeSignature(bytes32 hash, bytes calldata sig) external returns (uint256)",
  "function supportsInterface(bytes4 interfaceId) external pure returns (bool)",
  // ── State readers ──
  "function owner() external view returns (address)",
  "function entryPoint() external view returns (address)",
  "function validator() external view returns (address)",
  "function guard() external view returns (address)",
  "function guardianCount() external view returns (uint8)",
  "function guardians(uint256 index) external view returns (address)",
  "function p256KeyX() external view returns (bytes32)",
  "function p256KeyY() external view returns (bytes32)",
  // abitype/viem human-readable ABIs use a bare parenthesised tuple `(...)`, not the
  // ethers-style `tuple(...)` keyword (which parseAbi rejects with "Invalid ABI parameter").
  "function getConfigDescription() external view returns ((address accountOwner, address guardAddress, uint256 dailyLimit, uint256 dailyRemaining, uint256 tier1Limit, uint256 tier2Limit, address[3] guardianAddresses, uint8 guardianCount, bool hasP256Key, bool hasValidator, bool hasAggregator, bool hasActiveRecovery))",
  // ── Owner / key management ──
  "function setValidator(address _validator) external",
  "function setP256Key(bytes32 _x, bytes32 _y) external",
  "function setTierLimits(uint256 _tier1, uint256 _tier2) external",
  "function modifyTierLimitsWithGuardians(uint256 _tier1, uint256 _tier2, uint256 deadline, bytes[] calldata guardianSigs) external",
  // ── Algorithm whitelist (v0.17.2-beta.4: single source of truth on the ACCOUNT, not the guard) ──
  "function approvedAlgorithms(uint8 algId) external view returns (bool)",
  "function guardApproveAlgorithm(uint8 algId) external",
  // ── Social / guardian recovery (F28) ──
  // Guardian set: owner adds guardians (max 3); removal needs RECOVERY_THRESHOLD guardian sigs.
  // Recovery lifecycle: a guardian proposes a new owner (starts the timelock), guardians
  // approve to reach 2-of-3 threshold, then anyone executes after the timelock; guardians
  // (not the owner) can vote to cancel. See RecoveryService for the full flow.
  "function addGuardian(address _guardian) external",
  "function removeGuardian(uint8 index, bytes[] calldata guardianSigs) external",
  "function proposeRecovery(address _newOwner) external",
  "function approveRecovery() external",
  "function cancelRecovery() external",
  "function executeRecovery() external",
  "function activeRecovery() external view returns (address newOwner, uint256 proposedAt, uint256 approvalBitmap, uint256 cancellationBitmap)",
  // ── Weighted-signature governance (algId 0x07) ──
  // WeightConfig tuple = (passkeyWeight, ecdsaWeight, blsWeight, guardian0Weight,
  //   guardian1Weight, guardian2Weight, _padding, tier1Threshold, tier2Threshold, tier3Threshold)
  "function setWeightConfig((uint8 passkeyWeight, uint8 ecdsaWeight, uint8 blsWeight, uint8 guardian0Weight, uint8 guardian1Weight, uint8 guardian2Weight, uint8 _padding, uint8 tier1Threshold, uint8 tier2Threshold, uint8 tier3Threshold) config) external",
  "function proposeWeightChange((uint8 passkeyWeight, uint8 ecdsaWeight, uint8 blsWeight, uint8 guardian0Weight, uint8 guardian1Weight, uint8 guardian2Weight, uint8 _padding, uint8 tier1Threshold, uint8 tier2Threshold, uint8 tier3Threshold) proposed) external",
  "function approveWeightChange() external",
  "function cancelWeightChange() external",
  "function executeWeightChange() external",
  "function weightConfig() external view returns (uint8 passkeyWeight, uint8 ecdsaWeight, uint8 blsWeight, uint8 guardian0Weight, uint8 guardian1Weight, uint8 guardian2Weight, uint8 _padding, uint8 tier1Threshold, uint8 tier2Threshold, uint8 tier3Threshold)",
  "function pendingWeightChange() external view returns ((uint8 passkeyWeight, uint8 ecdsaWeight, uint8 blsWeight, uint8 guardian0Weight, uint8 guardian1Weight, uint8 guardian2Weight, uint8 _padding, uint8 tier1Threshold, uint8 tier2Threshold, uint8 tier3Threshold) proposed, uint256 proposedAt, uint256 approvalBitmap)",
  // ── ERC-4337 v0.7 bundler entrypoint (v0.17.2-beta.4) ──
  // Routes a UserOp whose callData starts with the executeUserOp selector to the account,
  // re-deriving the signature algId in-frame (fixes guard-account bundler gas estimation).
  // Only an inner execute()/executeBatch() may be wrapped (else reverts UnsupportedInnerSelector).
  "function executeUserOp((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash) external",
  // ── Events ──
  "event ModuleInstalled(uint256 indexed moduleTypeId, address indexed module)",
  "event ModuleUninstalled(uint256 indexed moduleTypeId, address indexed module)",
  "event OwnerChanged(address indexed oldOwner, address indexed newOwner)",
  // v0.20.0 (#120): recovery events gained a trailing `uint8 guardianIdx` naming the
  // authorizing guardian slot (on P-256 relayer-submitted paths msg.sender is the relayer,
  // not the guardian). topic0 of these three events changed — decoders must use the new shape.
  "event RecoveryProposed(address indexed newOwner, address indexed proposedBy, uint8 guardianIdx)",
  "event RecoveryApproved(address indexed newOwner, address indexed approvedBy, uint256 approvalCount, uint8 guardianIdx)",
  "event RecoveryCancelVoted(address indexed votedBy, uint256 cancelCount, uint8 guardianIdx)",
  "event RecoveryExecuted(address indexed oldOwner, address indexed newOwner)",
];

// M7 factory ABI — ERC-7579 modules pre-installed, ERC-7828 chain-qualified addresses
// InitConfig: (address[3] guardians, uint256 dailyLimit, uint8[] approvedAlgIds, uint256 minDailyLimit, address[] initialTokens, (uint256 tier1Limit, uint256 tier2Limit, uint256 dailyLimit)[] initialTokenConfigs)
export const AIRACCOUNT_FACTORY_ABI = [
  // Full config creation
  "function createAccount(address owner, uint256 salt, (address[3] guardians, uint256 dailyLimit, uint8[] approvedAlgIds, uint256 minDailyLimit, address[] initialTokens, (uint256 tier1Limit, uint256 tier2Limit, uint256 dailyLimit)[] initialTokenConfigs) config) external returns (address)",
  "function getAddress(address owner, uint256 salt, (address[3] guardians, uint256 dailyLimit, uint8[] approvedAlgIds, uint256 minDailyLimit, address[] initialTokens, (uint256 tier1Limit, uint256 tier2Limit, uint256 dailyLimit)[] initialTokenConfigs) config) external view returns (address)",
  // Default guardian setup (requires guardian acceptance sigs — M5.3+)
  "function createAccountWithDefaults(address owner, uint256 salt, address guardian1, bytes guardian1Sig, address guardian2, bytes guardian2Sig, uint256 dailyLimit) external returns (address)",
  "function getAddressWithDefaults(address owner, uint256 salt, address guardian1, address guardian2, uint256 dailyLimit) external view returns (address)",
  // Agent-account creation (V7: agentKey + human-guardian2 co-owned account, registered in AgentRegistry)
  "function createAgentAccount(address agentKey, bytes32 agentId, address guardian2, bytes guardian2Sig, bytes agentKeySig, uint48 deadline, uint256 dailyLimit) external returns (address account)",
  "function getAgentAddress(address humanOwner, address agentKey, bytes32 agentId) external view returns (address)",
  "function setAgentRegistry(address _agentRegistry) external",
  "function agentRegistry() external view returns (address)",
  // M7 immutable state
  "function implementation() external view returns (address)",
  "function entryPoint() external view returns (address)",
  "function defaultCommunityGuardian() external view returns (address)",
  "function defaultValidatorModule() external view returns (address)",
  "function defaultHookModule() external view returns (address)",
  // M7.4 ERC-7828 chain-qualified address helpers
  "function getChainQualifiedAddress(address account) external view returns (bytes32)",
  "function getAddressWithChainId(address owner, uint256 salt, (address[3] guardians, uint256 dailyLimit, uint8[] approvedAlgIds, uint256 minDailyLimit, address[] initialTokens, (uint256 tier1Limit, uint256 tier2Limit, uint256 dailyLimit)[] initialTokenConfigs) config) external view returns (address account, bytes32 chainQualified)",
  // Events
  "event AccountCreated(address indexed account, address indexed owner, uint256 salt)",
];

// v0.17.2-beta.4: the guard is now pure spend accounting. The algorithm whitelist
// moved to the ACCOUNT (see AIRACCOUNT_ABI.approvedAlgorithms). checkTransaction/
// checkTokenTransaction were renamed to recordSpend/recordTokenSpend, and
// approveAlgorithm/approvedAlgorithms/AlgorithmNotApproved were removed from the guard.
export const GLOBAL_GUARD_ABI = [
  "function remainingDailyAllowance() external view returns (uint256)",
  "function dailyLimit() external view returns (uint256)",
  "function account() external view returns (address)",
  // Spend accounting (record* — algId dropped from the ETH path; kept for per-token tier math)
  "function recordSpend(uint256 value) external returns (bool)",
  "function recordTokenSpend(address token, uint256 amount, uint8 algId) external returns (bool)",
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

// ── M7 Module ABIs ───────────────────────────────────────────────

// AgentSessionKeyValidator — ERC-7579 Validator module for AI agent capability delegation.
// Supports velocity limits, selector allowlists, spend caps, and hierarchical delegation chains.
export const AGENT_SESSION_KEY_VALIDATOR_ABI = [
  // ERC-7579 lifecycle
  "function onInstall(bytes calldata data) external",
  "function onUninstall(bytes calldata data) external",
  "function isInitialized(address smartAccount) external view returns (bool)",
  // Session management
  "function grantAgentSession(address sessionKey, (uint48 expiry, uint16 velocityLimit, uint32 velocityWindow, bool revoked, address[] callTargets, bytes4[] selectorAllowlist) cfg) external",
  "function delegateSession(address account, address subKey, (uint48 expiry, uint16 velocityLimit, uint32 velocityWindow, bool revoked, address[] callTargets, bytes4[] selectorAllowlist) subCfg) external",
  "function revokeAgentSession(address sessionKey) external",
  // Validation
  "function validateUserOp((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash) external returns (uint256 validationData)",
  "function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata data) external pure returns (bytes4)",
  // Enforcement
  "function enforceSessionScope(address account, address sessionKey, address callTarget, bytes4 selector) external view",
  // State readers
  "function agentSessions(address account, address sessionKey) external view returns (uint48 expiry, uint16 velocityLimit, uint32 velocityWindow, bool revoked, address[] memory callTargets, bytes4[] memory selectorAllowlist)",
  "function sessionStates(address account, address sessionKey) external view returns (uint256 callCount, uint256 windowStart)",
  "function sessionKeyOwner(address sessionKey) external view returns (address)",
  "function delegatedBy(address account, address subKey) external view returns (address parentKey)",
  // Events
  "event AgentSessionGranted(address indexed account, address indexed sessionKey, uint48 expiry)",
  "event AgentSessionRevoked(address indexed account, address indexed sessionKey)",
  "event AgentSessionDelegated(address indexed parentAccount, address indexed parentKey, address indexed subKey, uint48 expiry)",
];

// TierGuardHook — ERC-7579 Hook module wrapping tier-based spending enforcement.
// Enforces per-execution ETH/token tier limits via preCheck/postCheck hooks.
export const TIER_GUARD_HOOK_ABI = [
  // ERC-7579 lifecycle
  "function onInstall(bytes calldata data) external",
  "function onUninstall(bytes calldata data) external",
  "function isInitialized(address smartAccount) external view returns (bool)",
  // ERC-7579 Hook interface
  "function preCheck(address msgSender, uint256 msgValue, bytes calldata msgData) external returns (bytes memory hookData)",
  "function postCheck(bytes calldata hookData) external",
  // State readers
  "function accountGuard(address account) external view returns (address)",
  "function accountTier1(address account) external view returns (uint256)",
  "function accountTier2(address account) external view returns (uint256)",
];

// AirAccountCompositeValidator — ERC-7579 Validator merging weighted + cumulative T2/T3 signature schemes.
// Routes validation to the account's built-in algId dispatch via nonce-key routing.
export const AIR_ACCOUNT_COMPOSITE_VALIDATOR_ABI = [
  // ERC-7579 lifecycle
  "function onInstall(bytes calldata data) external",
  "function onUninstall(bytes calldata data) external",
  "function isInitialized(address smartAccount) external view returns (bool)",
  // ERC-7579 Validator interface
  "function validateUserOp((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash) external returns (uint256 validationData)",
  "function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata data) external view returns (bytes4 magicValue)",
];

// ForceExitModule — ERC-7579 Executor module for guardian-gated L2→L1 emergency withdrawals.
// Requires 2-of-3 guardian approvals before executing the force exit.
export const FORCE_EXIT_MODULE_ABI = [
  // ERC-7579 lifecycle
  "function onInstall(bytes calldata data) external",
  "function onUninstall(bytes calldata data) external",
  "function isInitialized(address smartAccount) external view returns (bool)",
  // Force exit flow
  "function proposeForceExit(address target, uint256 value, bytes calldata data) external",
  "function approveForceExit(address account, bytes calldata guardianSig) external",
  "function executeForceExit(address account) external",
  "function cancelForceExit(address account) external",
  // State readers
  "function accountL2Type(address account) external view returns (uint8)",
  "function getPendingExit(address account) external view returns (address target, uint256 value, bytes memory data, uint256 proposedAt, uint256 approvalBitmap, address[3] memory guardians)",
  // Events
  "event ExitProposed(address indexed account, address indexed target, uint256 value)",
  "event ExitApproved(address indexed account, address indexed guardian, uint256 bitmap)",
  "event ExitExecuted(address indexed account, address indexed target, uint256 value)",
  "event ExitCancelled(address indexed account)",
];

// ERC-7579 Module type IDs (spec: 1=validator, 2=executor, 3=fallback, 4=hook)
export const MODULE_TYPE = {
  VALIDATOR: 1,
  EXECUTOR: 2,
  FALLBACK: 3,
  HOOK: 4,
} as const;

// AirAccount algorithm IDs (algId values for signature dispatch)
export const ALG_ID = {
  BLS: 0x01,
  ECDSA: 0x02,
  P256: 0x03,
  CUMULATIVE_T2: 0x04,  // P256 + BLS
  CUMULATIVE_T3: 0x05,  // P256 + BLS + Guardian ECDSA
  COMBINED_T1: 0x06,    // P256 AND ECDSA simultaneously
  WEIGHTED: 0x07,       // Weighted multi-signature
  SESSION_KEY: 0x08,    // Time-limited session key (SessionKeyValidator)
  AGENT_SESSION_KEY: 0x09, // AI agent session key (AgentSessionKeyValidator)
} as const;

// ── M6 继承合约 ABIs ─────────────────────────────────────────────

// SessionKeyValidator — M6 基础 session key（algId=0x08）
// 支持 ECDSA + P256 两种 session key，带合约/selector 作用域限制
export const SESSION_KEY_VALIDATOR_ABI = [
  // Session struct (8 fields) — authoritative tuple shape from
  // airaccount-contract/src/validators/SessionKeyValidator.sol and
  // packages/core/src/abis/SessionKeyValidator.json. The grant/build/read
  // functions take/return this tuple as a single arg — NOT flat params.
  // Canonical tuple type: (uint48,address,bytes4,bool,uint16,uint32,address[],bytes4[])
  // ECDSA session key
  "function grantSession(address account, address sessionKey, (uint48 expiry, address contractScope, bytes4 selectorScope, bool revoked, uint16 velocityLimit, uint32 velocityWindow, address[] callTargets, bytes4[] selectorAllowlist) cfg, bytes calldata ownerSig) external",
  "function grantSessionDirect(address account, address sessionKey, (uint48 expiry, address contractScope, bytes4 selectorScope, bool revoked, uint16 velocityLimit, uint32 velocityWindow, address[] callTargets, bytes4[] selectorAllowlist) cfg) external",
  "function revokeSession(address account, address sessionKey) external",
  "function isSessionActive(address account, address sessionKey) external view returns (bool)",
  "function getSession(address account, address sessionKey) external view returns ((uint48 expiry, address contractScope, bytes4 selectorScope, bool revoked, uint16 velocityLimit, uint32 velocityWindow, address[] callTargets, bytes4[] selectorAllowlist))",
  "function buildGrantHash(address account, address sessionKey, (uint48 expiry, address contractScope, bytes4 selectorScope, bool revoked, uint16 velocityLimit, uint32 velocityWindow, address[] callTargets, bytes4[] selectorAllowlist) cfg) external view returns (bytes32)",
  // P256 session key
  "function grantP256Session(address account, bytes32 p256KeyX, bytes32 p256KeyY, (uint48 expiry, address contractScope, bytes4 selectorScope, bool revoked, uint16 velocityLimit, uint32 velocityWindow, address[] callTargets, bytes4[] selectorAllowlist) cfg, bytes calldata ownerSig) external",
  "function grantP256SessionDirect(address account, bytes32 p256KeyX, bytes32 p256KeyY, (uint48 expiry, address contractScope, bytes4 selectorScope, bool revoked, uint16 velocityLimit, uint32 velocityWindow, address[] callTargets, bytes4[] selectorAllowlist) cfg) external",
  "function revokeP256Session(address account, bytes32 p256KeyX, bytes32 p256KeyY) external",
  "function isP256SessionActive(address account, bytes32 p256KeyX, bytes32 p256KeyY) external view returns (bool)",
  "function getP256Session(address account, bytes32 p256KeyHash) external view returns ((uint48 expiry, address contractScope, bytes4 selectorScope, bool revoked, uint16 velocityLimit, uint32 velocityWindow, address[] callTargets, bytes4[] selectorAllowlist))",
  "function buildP256GrantHash(address account, bytes32 p256KeyX, bytes32 p256KeyY, (uint48 expiry, address contractScope, bytes4 selectorScope, bool revoked, uint16 velocityLimit, uint32 velocityWindow, address[] callTargets, bytes4[] selectorAllowlist) cfg) external view returns (bytes32)",
  // Events
  "event SessionGranted(address indexed account, address indexed sessionKey, uint48 expiry, address contractScope, bytes4 selectorScope)",
  "event SessionRevoked(address indexed account, address indexed sessionKey)",
  "event P256SessionGranted(address indexed account, bytes32 indexed p256KeyHash, uint48 expiry)",
  "event P256SessionRevoked(address indexed account, bytes32 indexed p256KeyHash)",
];

// CalldataParserRegistry — DeFi 协议解析器注册表
// 让 guard 能识别 Uniswap/Railgun 等协议的 calldata，精确核算 token 消费
export const CALLDATA_PARSER_REGISTRY_ABI = [
  "function registerParser(address dest, address parser) external",
  "function getParser(address dest) external view returns (address)",
  "function transferOwnership(address newOwner) external",
  "function parserFor(address dest) external view returns (address)",
  "event ParserRegistered(address indexed dest, address indexed parser)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
];

// AirAccountDelegate — EIP-7702 EOA 委托为 AirAccount（M7 新增）
// EOA 通过 EIP-7702 授权后，调用 initialize() 即获得 AirAccount 能力
export const AIR_ACCOUNT_DELEGATE_ABI = [
  // EIP-7702 初始化（仅限 EOA 自身调用）
  "function initialize(address guardian1, bytes calldata g1Sig, address guardian2, bytes calldata g2Sig, uint256 dailyLimit) external",
  // ERC-4337 执行
  "function validateUserOp((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256)",
  "function execute(address dest, uint256 value, bytes calldata data) external",
  "function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata data) external",
  // 社会恢复（Rescue，EIP-7702 术语避免与 AirAccount Recovery 混淆）
  "function initiateRescue(address rescueTo) external",
  "function approveRescue() external",
  "function executeRescue() external",
  // Events
  "event DelegateInitialized(address indexed eoa, address guard, address g1, address g2)",
  "event RescueInitiated(address indexed eoa, address rescueTo, address indexed initiator)",
  "event RescueApproved(address indexed eoa, address indexed guardian, uint8 approvals)",
  "event RescueExecuted(address indexed eoa, address rescueTo, uint256 ethAmount)",
  "event RescueCancelled(address indexed eoa)",
];
