/**
 * Role constants and utilities for AAstar SDK
 * @dev All role hashes and configurations match exactly with Registry.sol v3.0.0
 * @source /contracts/src/core/Registry.sol
 */
import { keccak256, toHex, type Hash } from 'viem';

// ========== Role Hash Constants (from Registry.sol lines 32-38) ==========

/**
 * Default Admin Role (OpenZeppelin AccessControl)
 * @description Highest privilege, can grant/revoke all roles
 * @permission Protocol governance only
 * @source OpenZeppelin AccessControl DEFAULT_ADMIN_ROLE
 */
export const DEFAULT_ADMIN_ROLE: Hash = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Community Role
 * @description Community administrator, can issue xPNTs, configure SBT rules
 * @permission Community-level governance
 * @requirement minStake: 30 GT, entryBurn: 3 GT (line 99)
 * @exitFee 5% (500 basis points), min 1 GT
 * @lockDuration 30 days
 * @source Registry.sol line 32: ROLE_COMMUNITY = keccak256("COMMUNITY")
 */
export const ROLE_COMMUNITY: Hash = keccak256(toHex('COMMUNITY'));

/**
 * End User Role
 * @description Community member, can participate and use gasless transactions
 * @permission Basic user level
 * @requirement minStake: 0.3 GT, entryBurn: 0.05 GT (line 100)
 * @additionalRequirement Must hold MySBT from community
 * @exitFee 10% (1000 basis points), min 0.05 GT
 * @lockDuration 7 days
 * @source Registry.sol line 33: ROLE_ENDUSER = keccak256("ENDUSER")
 */
export const ROLE_ENDUSER: Hash = keccak256(toHex('ENDUSER'));

/**
 * Paymaster AOA Role (Account Ownership Authentication)
 * @description Basic Paymaster node operator with account-based auth
 * @permission Infrastructure operator
 * @requirement minStake: 30 GT, entryBurn: 3 GT (line 92)
 * @exitFee 10% (1000 basis points), min 1 GT
 * @lockDuration 30 days
 * @source Registry.sol line 34: ROLE_PAYMASTER_AOA = keccak256("PAYMASTER_AOA")
 */
export const ROLE_PAYMASTER_AOA: Hash = keccak256(toHex('PAYMASTER_AOA'));

/**
 * Paymaster Super Role
 * @description Advanced Paymaster operator, can use SuperPaymaster with aPNTs collateral
 * @permission Infrastructure operator (higher tier)
 * @requirement minStake: 50 GT, entryBurn: 5 GT (line 93)
 * @additionalRequirement aPNTs collateral in SuperPaymaster contract
 * @exitFee 10% (1000 basis points), min 2 GT
 * @lockDuration 30 days
 * @source Registry.sol line 35: ROLE_PAYMASTER_SUPER = keccak256("PAYMASTER_SUPER")
 */
export const ROLE_PAYMASTER_SUPER: Hash = keccak256(toHex('PAYMASTER_SUPER'));

/**
 * DVT Role (Distributed Validator Technology)
 * @description DVT node operator for consensus validation
 * @permission Infrastructure operator
 * @requirement minStake: 30 GT, entryBurn: 3 GT (line 94)
 * @exitFee 10% (1000 basis points), min 1 GT
 * @lockDuration 30 days
 * @source Registry.sol line 36: ROLE_DVT = keccak256("DVT")
 */
export const ROLE_DVT: Hash = keccak256(toHex('DVT'));

/**
 * ANODE Role (Anonymous Node)
 * @description Anonymous infrastructure node operator
 * @permission Infrastructure operator
 * @requirement minStake: 20 GT, entryBurn: 2 GT (line 95)
 * @exitFee 10% (1000 basis points), min 1 GT
 * @lockDuration 30 days
 * @source Registry.sol line 37: ROLE_ANODE = keccak256("ANODE")
 */
export const ROLE_ANODE: Hash = keccak256(toHex('ANODE'));

/**
 * KMS Role (Key Management Service)
 * @description KMS operator for secure key storage and management
 * @permission Infrastructure operator (highest stake)
 * @requirement minStake: 100 GT, entryBurn: 10 GT (line 98)
 * @exitFee 10% (1000 basis points), min 5 GT
 * @lockDuration 30 days
 * @source Registry.sol line 38: ROLE_KMS = keccak256("KMS")
 */
export const ROLE_KMS: Hash = keccak256(toHex('KMS'));

// ========== Role Configuration Types ==========

/**
 * Role configuration structure (matches Registry.sol RoleConfig struct)
 */
export interface RoleConfig {
    minStake: bigint;           // Minimum GToken stake required
    entryBurn: bigint;          // Amount burned on entry
    slashThreshold: number;     // Slash threshold (0-100)
    slashBase: number;          // Base slash percentage
    slashIncrement: number;     // Increment per offense
    slashMax: number;           // Maximum slash percentage
    exitFeePercent: bigint;     // Exit fee percentage (basis points, 1000 = 10%)
    minExitFee: bigint;         // Minimum exit fee
    isActive: boolean;          // Whether role is active
    description: string;        // Role description
}

/**
 * Role requirement check result
 */
export interface RoleRequirement {
    hasRole: boolean;
    hasEnoughGToken: boolean;
    hasEnoughAPNTs: boolean;
    hasSBT: boolean;
    missingRequirements: string[];
}

// ========== Role Name Mapping ==========

export const ROLE_NAMES: Record<string, string> = {
    [DEFAULT_ADMIN_ROLE]: 'Default Admin',
    [ROLE_COMMUNITY]: 'Community Admin',
    [ROLE_ENDUSER]: 'End User',
    [ROLE_PAYMASTER_AOA]: 'Paymaster (AOA)',
    [ROLE_PAYMASTER_SUPER]: 'Paymaster (Super)',
    [ROLE_DVT]: 'DVT Operator',
    [ROLE_ANODE]: 'Anonymous Node',
    [ROLE_KMS]: 'KMS Operator'
};

/**
 * Get human-readable role name
 */
export function getRoleName(roleHash: Hash): string {
    return ROLE_NAMES[roleHash] || 'Unknown Role';
}

/**
 * Role permission levels (for UI sorting/filtering)
 */
export enum RolePermissionLevel {
    PROTOCOL = 100,      // Default Admin
    KMS = 80,            // Key Management (highest stake)
    OPERATOR = 50,       // Infrastructure Operators
    COMMUNITY = 30,      // Community Admin
    USER = 10            // End Users
}

export const ROLE_PERMISSION_LEVELS: Record<string, RolePermissionLevel> = {
    [DEFAULT_ADMIN_ROLE]: RolePermissionLevel.PROTOCOL,
    [ROLE_KMS]: RolePermissionLevel.KMS,
    [ROLE_PAYMASTER_SUPER]: RolePermissionLevel.OPERATOR,
    [ROLE_PAYMASTER_AOA]: RolePermissionLevel.OPERATOR,
    [ROLE_DVT]: RolePermissionLevel.OPERATOR,
    [ROLE_ANODE]: RolePermissionLevel.OPERATOR,
    [ROLE_COMMUNITY]: RolePermissionLevel.COMMUNITY,
    [ROLE_ENDUSER]: RolePermissionLevel.USER
};

/**
 * Exact stake requirements from Registry.sol constructor (lines 92-100)
 * @warning These are initial values, always query contract for current configuration
 */
export const INITIAL_ROLE_STAKES = {
    [ROLE_PAYMASTER_AOA]: {
        minStake: '30 GT',
        entryBurn: '3 GT',
        exitFeePercent: '10%',
        minExitFee: '1 GT',
        lockDuration: '30 days',
        line: 92
    },
    [ROLE_PAYMASTER_SUPER]: {
        minStake: '50 GT',
        entryBurn: '5 GT',
        exitFeePercent: '10%',
        minExitFee: '2 GT',
        lockDuration: '30 days',
        additionalRequirement: 'aPNTs collateral in SuperPaymaster',
        line: 93
    },
    [ROLE_DVT]: {
        minStake: '30 GT',
        entryBurn: '3 GT',
        exitFeePercent: '10%',
        minExitFee: '1 GT',
        lockDuration: '30 days',
        line: 94
    },
    [ROLE_ANODE]: {
        minStake: '20 GT',
        entryBurn: '2 GT',
        exitFeePercent: '10%',
        minExitFee: '1 GT',
        lockDuration: '30 days',
        line: 95
    },
    [ROLE_KMS]: {
        minStake: '100 GT',
        entryBurn: '10 GT',
        exitFeePercent: '10%',
        minExitFee: '5 GT',
        lockDuration: '30 days',
        line: 98
    },
    [ROLE_COMMUNITY]: {
        minStake: '30 GT',
        entryBurn: '3 GT',
        exitFeePercent: '5%',
        minExitFee: '1 GT',
        lockDuration: '30 days',
        line: 99
    },
    [ROLE_ENDUSER]: {
        minStake: '0.3 GT',
        entryBurn: '0.05 GT',
        exitFeePercent: '10%',
        minExitFee: '0.05 GT',
        lockDuration: '7 days',
        additionalRequirement: 'Must hold MySBT from community',
        line: 100
    }
} as const;

/**
 * All defined roles array (for iteration)
 */
export const ALL_ROLES = [
    ROLE_COMMUNITY,
    ROLE_ENDUSER,
    ROLE_PAYMASTER_AOA,
    ROLE_PAYMASTER_SUPER,
    ROLE_DVT,
    ROLE_ANODE,
    ROLE_KMS
] as const;
