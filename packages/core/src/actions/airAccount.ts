import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { AAStarAirAccountV7ABI } from '../abis/index.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';
// Reuse the canonical ERC-4337 v0.7 tuple already exported by superPaymaster.ts
// to avoid a duplicate `PackedUserOperation` export from actions/index.ts.
import type { PackedUserOperation } from './superPaymaster.js';

export type { PackedUserOperation };

// AAStarGlobalGuard.TokenConfig — per-token spend limits enforced by the guard.
export type TokenConfig = {
    tier1Limit: bigint;
    tier2Limit: bigint;
    dailyLimit: bigint;
};

// AAStarAirAccountBase.InitConfig — account bootstrap parameters (3 guardians fixed-size).
export type InitConfig = {
    guardians: readonly [Address, Address, Address];
    dailyLimit: bigint;
    approvedAlgIds: readonly number[];
    minDailyLimit: bigint;
    initialTokens: readonly Address[];
    initialTokenConfigs: readonly TokenConfig[];
};

// pendingModuleInstall() tuple result.
export type PendingModuleInstall = {
    module: Address;
    moduleTypeId: number;
    proposedAt: number;
    executeAfter: number;
    initDataHash: Hex;
};

export type AirAccountActions = {
    // --- Reads ---
    accountId: () => Promise<string>;
    isValidSignature: (args: { hash: Hex, sig: Hex }) => Promise<Hex>;
    requiredTier: (args: { txValue: bigint }) => Promise<number>;
    supportsModule: (args: { moduleTypeId: bigint }) => Promise<boolean>;
    p256KeyX: () => Promise<Hex>;
    p256KeyY: () => Promise<Hex>;
    parserRegistry: () => Promise<Address>;
    moduleManagementNonce: () => Promise<bigint>;
    moduleInstallTimelock: () => Promise<bigint>;
    pendingModuleInstall: () => Promise<PendingModuleInstall>;

    // --- Writes (P256 / tier / validator config) ---
    setP256Key: (args: { x: Hex, y: Hex, account?: Account | Address }) => Promise<Hash>;
    setTierLimits: (args: { tier1: bigint, tier2: bigint, account?: Account | Address }) => Promise<Hash>;
    setValidator: (args: { validator: Address, account?: Account | Address }) => Promise<Hash>;
    setParserRegistry: (args: { registry: Address, account?: Account | Address }) => Promise<Hash>;

    // --- Writes (execution / lifecycle) ---
    /**
     * Execute calls via an installed executor module (ERC-7579 `executeFromExecutor`).
     * NOTE: this is a state-changing tx, so it resolves to the transaction `Hash` — the
     * on-chain `bytes[] returnData` is NOT recoverable from a write. If you need the
     * decoded return data, `simulateContract`/`call` the same function separately.
     */
    executeFromExecutor: (args: { mode: Hex, executionCalldata: Hex, account?: Account | Address }) => Promise<Hash>;
    validateUserOp: (args: { userOp: PackedUserOperation, userOpHash: Hex, missingAccountFunds: bigint, account?: Account | Address }) => Promise<Hash>;
    initializeAgentAccount: (args: { entryPoint: Address, owner: Address, config: InitConfig, guardAddr: Address, account?: Account | Address }) => Promise<Hash>;

    // --- Writes (guard governance) ---
    guardAddTokenConfig: (args: { token: Address, config: TokenConfig, account?: Account | Address }) => Promise<Hash>;
    guardApproveAlgorithm: (args: { algId: number, account?: Account | Address }) => Promise<Hash>;
    guardDecreaseDailyLimit: (args: { newLimit: bigint, account?: Account | Address }) => Promise<Hash>;
    guardDecreaseTokenDailyLimit: (args: { token: Address, newLimit: bigint, account?: Account | Address }) => Promise<Hash>;

    // --- Writes (module install timelock) ---
    proposeModuleInstall: (args: { moduleTypeId: bigint, module: Address, initData: Hex, account?: Account | Address }) => Promise<Hash>;
    executeModuleInstall: (args: { moduleInitData: Hex, account?: Account | Address }) => Promise<Hash>;
    cancelModuleInstall: (args: { account?: Account | Address }) => Promise<Hash>;
    setModuleInstallTimelock: (args: { newTimelock: bigint, guardianSigs: Hex, account?: Account | Address }) => Promise<Hash>;
};

const ABI = AAStarAirAccountV7ABI;

export const airAccountActions = (address: Address) => (client: PublicClient | WalletClient): AirAccountActions => ({
    // ===== Reads =====
    async accountId() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'accountId', args: []
            }) as string;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'accountId');
        }
    },

    async isValidSignature({ hash, sig }) {
        try {
            validateRequired(hash, 'hash');
            validateRequired(sig, 'sig');
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'isValidSignature', args: [hash, sig]
            }) as Hex;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isValidSignature');
        }
    },

    async requiredTier({ txValue }) {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'requiredTier', args: [txValue]
            }) as number;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'requiredTier');
        }
    },

    async supportsModule({ moduleTypeId }) {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'supportsModule', args: [moduleTypeId]
            }) as boolean;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'supportsModule');
        }
    },

    async p256KeyX() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'p256KeyX', args: []
            }) as Hex;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'p256KeyX');
        }
    },

    async p256KeyY() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'p256KeyY', args: []
            }) as Hex;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'p256KeyY');
        }
    },

    async parserRegistry() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'parserRegistry', args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'parserRegistry');
        }
    },

    async moduleManagementNonce() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'moduleManagementNonce', args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'moduleManagementNonce');
        }
    },

    async moduleInstallTimelock() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'moduleInstallTimelock', args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'moduleInstallTimelock');
        }
    },

    async pendingModuleInstall() {
        try {
            const r = await (client as PublicClient).readContract({
                address, abi: ABI, functionName: 'pendingModuleInstall', args: []
            }) as readonly [Address, number, number, number, Hex];
            return {
                module: r[0],
                moduleTypeId: r[1],
                proposedAt: r[2],
                executeAfter: r[3],
                initDataHash: r[4],
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'pendingModuleInstall');
        }
    },

    // ===== Writes: P256 / tier / validator config =====
    async setP256Key({ x, y, account }) {
        try {
            validateRequired(x, 'x');
            validateRequired(y, 'y');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'setP256Key', args: [x, y],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setP256Key');
        }
    },

    async setTierLimits({ tier1, tier2, account }) {
        try {
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'setTierLimits', args: [tier1, tier2],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setTierLimits');
        }
    },

    async setValidator({ validator, account }) {
        try {
            validateAddress(validator, 'validator');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'setValidator', args: [validator],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setValidator');
        }
    },

    async setParserRegistry({ registry, account }) {
        try {
            validateAddress(registry, 'registry');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'setParserRegistry', args: [registry],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setParserRegistry');
        }
    },

    // ===== Writes: execution / lifecycle =====
    async executeFromExecutor({ mode, executionCalldata, account }) {
        try {
            validateRequired(mode, 'mode');
            validateRequired(executionCalldata, 'executionCalldata');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'executeFromExecutor', args: [mode, executionCalldata],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'executeFromExecutor');
        }
    },

    async validateUserOp({ userOp, userOpHash, missingAccountFunds, account }) {
        try {
            validateRequired(userOp, 'userOp');
            validateRequired(userOpHash, 'userOpHash');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'validateUserOp', args: [userOp, userOpHash, missingAccountFunds],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'validateUserOp');
        }
    },

    async initializeAgentAccount({ entryPoint, owner, config, guardAddr, account }) {
        try {
            validateAddress(entryPoint, 'entryPoint');
            validateAddress(owner, 'owner');
            validateAddress(guardAddr, 'guardAddr');
            validateRequired(config, 'config');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'initializeAgentAccount', args: [entryPoint, owner, config, guardAddr],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'initializeAgentAccount');
        }
    },

    // ===== Writes: guard governance =====
    async guardAddTokenConfig({ token, config, account }) {
        try {
            validateAddress(token, 'token');
            validateRequired(config, 'config');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'guardAddTokenConfig', args: [token, config],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'guardAddTokenConfig');
        }
    },

    async guardApproveAlgorithm({ algId, account }) {
        try {
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'guardApproveAlgorithm', args: [algId],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'guardApproveAlgorithm');
        }
    },

    async guardDecreaseDailyLimit({ newLimit, account }) {
        try {
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'guardDecreaseDailyLimit', args: [newLimit],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'guardDecreaseDailyLimit');
        }
    },

    async guardDecreaseTokenDailyLimit({ token, newLimit, account }) {
        try {
            validateAddress(token, 'token');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'guardDecreaseTokenDailyLimit', args: [token, newLimit],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'guardDecreaseTokenDailyLimit');
        }
    },

    // ===== Writes: module install timelock =====
    async proposeModuleInstall({ moduleTypeId, module, initData, account }) {
        try {
            validateAddress(module, 'module');
            validateRequired(initData, 'initData');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'proposeModuleInstall', args: [moduleTypeId, module, initData],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'proposeModuleInstall');
        }
    },

    async executeModuleInstall({ moduleInitData, account }) {
        try {
            validateRequired(moduleInitData, 'moduleInitData');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'executeModuleInstall', args: [moduleInitData],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'executeModuleInstall');
        }
    },

    async cancelModuleInstall({ account }) {
        try {
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'cancelModuleInstall', args: [],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'cancelModuleInstall');
        }
    },

    async setModuleInstallTimelock({ newTimelock, guardianSigs, account }) {
        try {
            validateRequired(guardianSigs, 'guardianSigs');
            return await (client as any).writeContract({
                address, abi: ABI, functionName: 'setModuleInstallTimelock', args: [newTimelock, guardianSigs],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setModuleInstallTimelock');
        }
    },
});
