import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account, type AbiEvent, type BlockNumber, type BlockTag, keccak256, toBytes, decodeFunctionData, decodeAbiParameters } from 'viem';
import { RegistryABI } from '../abis/index.js';
import { validateAddress, validateRequired, validateAmount } from '../validators/index.js';
import { AAStarError, ErrorCode } from '../errors/index.js';

// ABI-parameter layout of Registry.sol CommunityRoleData, used to decode the `roleData`
// recovered from registerRole calldata. This is an abi.encode struct (NOT a contract ABI),
// so it is defined locally rather than imported from a *.json contract ABI.
const COMMUNITY_ROLE_DATA_PARAMS = [{
    type: 'tuple',
    components: [
        { name: 'name', type: 'string' },
        { name: 'ensName', type: 'string' },
        { name: 'website', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'logoURI', type: 'string' },
        { name: 'stakeAmount', type: 'uint256' }
    ]
}] as const;

/**
 * Reconstruct the ACTIVE members of a role via event indexing.
 *
 * The deployed v5 Registry has NO `getRoleMembers` getter (storage was slimmed;
 * members are not enumerable on-chain). Members are recovered from the membership
 * lifecycle events: `RoleRegistered` (join, emitted by both `registerRole` and
 * `safeMintForRole`) minus `RoleExited` (exit). Per user we keep only the LATEST
 * lifecycle event (ordered by blockNumber, then logIndex) so a join -> exit ->
 * re-join sequence — which naive set subtraction would mishandle — resolves to
 * "active". (RoleRevoked / RoleGranted are OZ AccessControl events with different
 * arg names and are NOT part of the registerRole/exitRole lifecycle.)
 */
const computeActiveRoleMembers = async (
    client: PublicClient,
    address: Address,
    roleId: Hex,
    fromBlock?: BlockNumber | BlockTag,
    toBlock?: BlockNumber | BlockTag
): Promise<Address[]> => {
    const findEvent = (name: string): AbiEvent => {
        const ev = (RegistryABI as readonly any[]).find(
            (item) => item.type === 'event' && item.name === name
        ) as AbiEvent | undefined;
        if (!ev) {
            throw new Error(`${name} event not found in Registry ABI`);
        }
        return ev;
    };
    const roleRegisteredEvent = findEvent('RoleRegistered');
    const roleExitedEvent = findEvent('RoleExited');

    const range = {
        address,
        fromBlock: fromBlock ?? 'earliest',
        toBlock: toBlock ?? 'latest'
    } as const;

    const [joinLogs, exitLogs] = await Promise.all([
        client.getLogs({ ...range, event: roleRegisteredEvent, args: { roleId } } as any),
        client.getLogs({ ...range, event: roleExitedEvent, args: { roleId } } as any)
    ]);

    type Lifecycle = { active: boolean; blockNumber: bigint; logIndex: number };
    const latest = new Map<string, Lifecycle>();
    const addressByKey = new Map<string, Address>();

    const ingest = (logs: readonly any[], active: boolean) => {
        for (const log of logs) {
            const user = (log.args?.user ?? '') as string;
            if (!user) continue;
            const key = user.toLowerCase();
            // We query a confirmed range (toBlock defaults to 'latest' = last mined
            // block), so blockNumber/logIndex are always present. The `?? 0n`/`?? 0`
            // is a defensive fallback that orders any anomalous null entry as OLDEST
            // (lowest priority), so a real confirmed event always wins the latest-slot.
            const blockNumber = (log.blockNumber ?? 0n) as bigint;
            const logIndex = Number(log.logIndex ?? 0);
            const prev = latest.get(key);
            if (!prev || blockNumber > prev.blockNumber ||
                (blockNumber === prev.blockNumber && logIndex >= prev.logIndex)) {
                latest.set(key, { active, blockNumber, logIndex });
                addressByKey.set(key, user as Address); // preserve checksummed address
            }
        }
    };

    ingest(joinLogs, true);
    ingest(exitLogs, false);

    const members: Address[] = [];
    for (const [key, state] of latest) {
        if (state.active) {
            members.push(addressByKey.get(key) as Address);
        }
    }
    return members;
};

export type RoleConfigDetailed = {
    minStake: bigint;
    ticketPrice: bigint;
    slashThreshold: number;
    slashBase: number;
    slashInc: number;
    slashMax: number;
    exitFeePercent: number;
    isActive: boolean;
    minExitFee: bigint;
    description: string;
    owner: Address;
    roleLockDuration: bigint;
};

/**
 * Rich community metadata reconstructed from on-chain data.
 *
 * The deployed v5 Registry stores community `roleData` only in an internal mapping
 * with NO public getter, so this profile is recovered via the event->calldata
 * back-trace pattern: locate the `RoleRegistered(ROLE_COMMUNITY, community)` log,
 * fetch the originating transaction, then decode its `registerRole` calldata to
 * extract the submitted `roleData` struct.
 */
export type CommunityProfile = {
    name: string;
    ensName: string;
    website: string;
    description: string;
    logoURI: string;
    stakeAmount: bigint;
    /** burnAmount from the RoleRegistered event. */
    burnAmount: bigint;
    /** Block timestamp recorded in the RoleRegistered event. */
    registeredAt: bigint;
    /** Transaction hash that registered the community (calldata source). */
    txHash: Hash;
    /** Raw ABI-encoded roleData bytes from the registration calldata. */
    rawRoleData: Hex;
};

export type RegistryActions = {
    // Role Management
    configureRole: (args: { roleId: Hex, config: RoleConfigDetailed, account?: Account | Address }) => Promise<Hash>;
    syncExitFees: (args: { roles: Hex[], account?: Account | Address }) => Promise<Hash>;
    /** @deprecated The deployed Registry ABI has no `createNewRole` — this wrapper now calls `configureRole(roleId, config)` with `roleOwner` merged into `config.owner`. Prefer {@link configureRole}. */
    createNewRole: (args: { roleId: Hex, config: RoleConfigDetailed, roleOwner: Address, account?: Account | Address }) => Promise<Hash>;
    registerRole: (args: { roleId: Hex, user: Address, data: Hex, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated The deployed Registry ABI has no `registerRoleSelf` — this wrapper now calls `registerRole(roleId, <caller>, data)` deriving the caller from `account`. Prefer {@link registerRole}. */
    registerRoleSelf: (args: { roleId: Hex, data: Hex, account?: Account | Address }) => Promise<Hash>;
    safeMintForRole: (args: { roleId: Hex, user: Address, data: Hex, account?: Account | Address }) => Promise<Hash>;
    hasRole: (args: { roleId: Hex, user: Address }) => Promise<boolean>;
    getRoleConfig: (args: { roleId: Hex }) => Promise<RoleConfigDetailed>;
    /** @deprecated Removed in the v5.x contract refactor — `roleLockDuration` is now a field of the role config. Throws {@link ErrorCode.NOT_IMPLEMENTED}; set it via {@link configureRole} (config.roleLockDuration). */
    setRoleLockDuration: (args: { roleId: Hex, duration: bigint, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Removed in the v5.x contract refactor — the role owner is now a field of the role config. Throws {@link ErrorCode.NOT_IMPLEMENTED}; set it via {@link configureRole} (config.owner). */
    setRoleOwner: (args: { roleId: Hex, newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    exitRole: (args: { roleId: Hex, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Removed in the v5.x contract refactor — there is no per-user role-metadata getter. Throws {@link ErrorCode.NOT_IMPLEMENTED}; use {@link getCommunityProfile} (event back-trace) for a community's roleData or {@link getRoleConfig} for role config. */
    roleMetadata: (args: { roleId: Hex, user: Address }) => Promise<Hex>;
    
    // Community Management
    /** @deprecated The deployed v5 Registry ABI has no `communityByName` function — use {@link getCommunityByName}. This wrapper now delegates to `getCommunityByName` so it no longer reverts on-chain. */
    communityByName: (args: { name: string }) => Promise<Address>;
    /** @deprecated The deployed v5 Registry ABI has no `communityByENS` function — use {@link getCommunityByENS}. This wrapper now delegates to `getCommunityByENS` so it no longer reverts on-chain. */
    communityByENS: (args: { ensName: string }) => Promise<Address>;
    // On-chain community registry getters (ABI-confirmed: getCommunityByName/getCommunityByENS).
    getCommunityByName: (args: { name: string }) => Promise<Address>;
    getCommunityByENS: (args: { ensName: string }) => Promise<Address>;
    // Stake / membership reads (ABI-confirmed: getRoleStake/getEffectiveStake).
    getRoleStake: (args: { roleId: Hex, user: Address }) => Promise<bigint>;
    getEffectiveStake: (args: { user: Address, roleId: Hex }) => Promise<bigint>;
    // Rich community metadata via event->calldata back-trace (no on-chain getter exists).
    getCommunityProfile: (args: { community: Address, fromBlock?: BlockNumber | BlockTag, toBlock?: BlockNumber | BlockTag }) => Promise<CommunityProfile | null>;
    
    // Credit & Reputation
    getCreditLimit: (args: { user: Address }) => Promise<bigint>;
    globalReputation: (args: { user: Address }) => Promise<bigint>;
    /** @deprecated Removed in the v5.x contract refactor — there is no append-one `addLevelThreshold` (only the replace-all {@link setLevelThresholds}). Throws {@link ErrorCode.NOT_IMPLEMENTED}; read {@link levelThresholds}, append, and call {@link setLevelThresholds}. */
    addLevelThreshold: (args: { threshold: bigint, account?: Account | Address }) => Promise<Hash>;
    batchUpdateGlobalReputation: (args: { proposalId: bigint, users: Address[], newScores: bigint[], epoch: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    /** Set the credit limit for a reputation level/tier (owner-gated). ABI: setCreditTier(uint256 level, uint256 limit). */
    setCreditTier: (args: { level: bigint, limit: bigint, account?: Account | Address }) => Promise<Hash>;
    /** Replace the full reputation level-threshold array (owner-gated). ABI: setLevelThresholds(uint256[] thresholds). */
    setLevelThresholds: (args: { thresholds: bigint[], account?: Account | Address }) => Promise<Hash>;
    /**
     * Update an operator's per-user blacklist in batch with a proof.
     * ABI: updateOperatorBlacklist(address operator, address[] users, bool[] statuses, bytes proof).
     */
    updateOperatorBlacklist: (args: { operator: Address, users: Address[], statuses: boolean[], proof: Hex, account?: Account | Address }) => Promise<Hash>;
    /** Sync a user's role stake from the GTokenStaking contract (staking-gated). ABI: syncStakeFromStaking(address user, bytes32 roleId, uint256 newAmount). */
    syncStakeFromStaking: (args: { user: Address, roleId: Hex, newAmount: bigint, account?: Account | Address }) => Promise<Hash>;
    /** Monotonic nonce bumped on each operator-blacklist update (view). ABI: blacklistNonce() -> uint256. */
    blacklistNonce: () => Promise<bigint>;
    
    // Contract References
    setBLSAggregator: (args: { aggregator: Address, account?: Account | Address }) => Promise<Hash>;
    setMySBT: (args: { sbt: Address, account?: Account | Address }) => Promise<Hash>;
    setSuperPaymaster: (args: { paymaster: Address, account?: Account | Address }) => Promise<Hash>;
    setStaking: (args: { staking: Address, account?: Account | Address }) => Promise<Hash>;
    setReputationSource: (args: { source: Address, account?: Account | Address }) => Promise<Hash>;
    
    blsAggregator: () => Promise<Address>;
    MYSBT: () => Promise<Address>;
    SUPER_PAYMASTER: () => Promise<Address>;
    GTOKEN_STAKING: () => Promise<Address>;
    /** @deprecated Removed in the v5.x contract refactor — there is no single-address `reputationSource` getter (sources are now a set). Throws {@link ErrorCode.NOT_IMPLEMENTED}; use {@link isReputationSource}({ source }) to test membership. */
    reputationSource: () => Promise<Address>;
    isReputationSource: (args: { source: Address }) => Promise<boolean>;
    /** @deprecated Removed in the v5.x contract refactor — not in the deployed Registry ABI. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    lastReputationEpoch: (args: { user: Address }) => Promise<bigint>;

    // View Functions
    /** @deprecated The deployed Registry ABI has no `roleConfigs` mapping getter — this wrapper now reads the ABI-confirmed `getRoleConfig(roleId)`. Prefer {@link getRoleConfig}. */
    roleConfigs: (args: { roleId: Hex }) => Promise<RoleConfigDetailed>;
    getRoleUserCount: (args: { roleId: Hex }) => Promise<bigint>;
    /**
     * Active members of a role, derived by event indexing.
     *
     * The deployed v5 Registry slimmed its storage: there is NO `getRoleMembers`
     * getter in the ABI (members are not enumerable on-chain), so this is reconstructed
     * from the membership-lifecycle events — `RoleRegistered` (join, emitted by both
     * `registerRole` and `safeMintForRole`) minus `RoleExited` (exit). For each user we
     * keep their LATEST lifecycle event (by block number, then log index) so a user who
     * exited and later re-registered is correctly counted as active.
     *
     * ⚠️ The result is only as complete as the underlying `getLogs` response. Many RPC
     * providers cap the block range or the number of logs returned and may SILENTLY
     * truncate — in which case the member list will be incomplete with no error. This
     * helper does NOT paginate. For large histories, pass a bounded `fromBlock`/`toBlock`
     * window (and page yourself), or use an indexed data source (subgraph/indexer).
     */
    getRoleMembers: (args: { roleId: Hex, fromBlock?: BlockNumber | BlockTag, toBlock?: BlockNumber | BlockTag }) => Promise<Address[]>;
    /**
     * Count of active members for a role, derived from the same event indexing as
     * {@link getRoleMembers} (i.e. `getRoleMembers(...).length`).
     *
     * NOTE: this differs from {@link getRoleUserCount}, which reads the on-chain
     * `roleMembers[roleId].length` counter directly. Prefer `getRoleUserCount` when you
     * only need a count and an authoritative on-chain value is acceptable; use this when
     * you also need the member addresses or want a count consistent with `getRoleMembers`
     * over a specific block range. Subject to the same `getLogs` truncation caveat as
     * {@link getRoleMembers} — prefer `getRoleUserCount` for an authoritative count.
     */
    getRoleMemberCount: (args: { roleId: Hex, fromBlock?: BlockNumber | BlockTag, toBlock?: BlockNumber | BlockTag }) => Promise<number>;
    getUserRoles: (args: { user: Address }) => Promise<Hex[]>;
    /** @deprecated Removed in the v5.x contract refactor — Registry storage was slimmed and members are not enumerable by index (no `roleMembers(roleId,index)` getter). Throws {@link ErrorCode.NOT_IMPLEMENTED}; use {@link getRoleMembers} (event-derived) instead. */
    roleMembers: (args: { roleId: Hex, index: bigint }) => Promise<Address>;
    /** @deprecated The deployed Registry ABI has no `userRoles(user,index)` indexed getter — this wrapper now reads `getUserRoles(user)` and returns the entry at `index`. Prefer {@link getUserRoles}. */
    userRoles: (args: { user: Address, index: bigint }) => Promise<Hex>;
    /** @deprecated The deployed Registry ABI has no `userRoleCount` — this wrapper now returns `getUserRoles(user).length`. Prefer {@link getUserRoles}. (NOTE: distinct from {@link getRoleUserCount}, which counts users of a role.) */
    userRoleCount: (args: { user: Address }) => Promise<bigint>;
    creditTierConfig: (args: { tierIndex: bigint }) => Promise<bigint>;
    levelThresholds: (args: { levelIndex: bigint }) => Promise<bigint>;
    /** @deprecated Removed in the v5.x contract refactor — Registry has no exit-fee calculator. Throws {@link ErrorCode.NOT_IMPLEMENTED}; use the GTokenStaking `previewExitFee({ user, roleId })` action instead. */
    calculateExitFee: (args: { roleId: Hex, amount: bigint }) => Promise<bigint>;
    /** @deprecated The deployed Registry ABI has no `roleStakes` mapping getter — this wrapper now reads the ABI-confirmed `getRoleStake(roleId, user)`. Prefer {@link getRoleStake}. */
    roleStakes: (args: { roleId: Hex, user: Address }) => Promise<bigint>;
    
    // Constants (Role IDs)
    ROLE_COMMUNITY: () => Promise<Hex>;
    ROLE_ENDUSER: () => Promise<Hex>;
    ROLE_PAYMASTER_SUPER: () => Promise<Hex>;
    ROLE_PAYMASTER_AOA: () => Promise<Hex>;
    ROLE_DVT: () => Promise<Hex>;
    ROLE_KMS: () => Promise<Hex>;
    ROLE_ANODE: () => Promise<Hex>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // AccessControl
    /** @deprecated Removed in the v5.x contract refactor — the Registry dropped the OZ AccessControl surface (no `grantRole`). Throws {@link ErrorCode.NOT_IMPLEMENTED}; use {@link registerRole} to add a user to a role. */
    grantRole: (args: { roleId: Hex, user: Address, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Removed in the v5.x contract refactor — the Registry has no admin `revokeRole` (only the caller can self-exit). Throws {@link ErrorCode.NOT_IMPLEMENTED}; a user removes their own role via {@link exitRole}. */
    revokeRole: (args: { roleId: Hex, user: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: () => Promise<string>;
};

export const registryActions = (address: Address) => (client: PublicClient | WalletClient): RegistryActions => ({
    // Role Management
    async configureRole({ roleId, config, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateRequired(config, 'config');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'configureRole',
                args: [roleId, config],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'configureRole');
        }
    },

    async createNewRole({ roleId, config, roleOwner, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateRequired(config, 'config');
            validateAddress(roleOwner, 'roleOwner');
            // On-chain fn: configureRole(roleId, config). The legacy `createNewRole` does not
            // exist; the separate `roleOwner` arg is now the config's `owner` field, so merge it in.
            const mergedConfig = { ...config, owner: roleOwner };
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'configureRole',
                args: [roleId, mergedConfig],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'createNewRole');
        }
    },

    async registerRole({ roleId, user, data, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'registerRole',
                args: [roleId, user, data],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'registerRole');
        }
    },

    async registerRoleSelf({ roleId, data, account }) {
        try {
            validateRequired(roleId, 'roleId');
            // On-chain fn: registerRole(roleId, user, roleData). The legacy self-register
            // entrypoint does not exist; "self" means the caller registers their own address,
            // so resolve the caller from `account` (or the wallet client's bound account).
            const self =
                typeof account === 'string'
                    ? account
                    : (account as any)?.address ?? (client as any).account?.address;
            validateAddress(self as Address, 'account');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'registerRole',
                args: [roleId, self, data],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'registerRoleSelf');
        }
    },

    async safeMintForRole({ roleId, user, data, account }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'safeMintForRole',
                args: [roleId, user, data],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'safeMintForRole');
        }
    },

    async hasRole({ roleId, user }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'hasRole',
                args: [roleId, user]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'hasRole');
        }
    },

    async getRoleConfig({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            const result = await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getRoleConfig',
                args: [roleId]
            }) as any;
            
            if (Array.isArray(result)) {
                return {
                    minStake: result[0],
                    ticketPrice: result[1],
                    slashThreshold: result[2],
                    slashBase: result[3],
                    slashInc: result[4],
                    slashMax: result[5],
                    exitFeePercent: result[6],
                    isActive: result[7],
                    minExitFee: result[8],
                    description: result[9],
                    owner: result[10],
                    roleLockDuration: result[11]
                };
            }
            return result as RoleConfigDetailed;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getRoleConfig');
        }
    },

    async setRoleLockDuration({ roleId, duration }) {
        // Removed in the v5.x contract refactor: roleLockDuration is a field of the role config
        // now, set atomically via configureRole. Validate then throw rather than revert on-chain.
        validateRequired(roleId, 'roleId');
        validateRequired(duration, 'duration');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'setRoleLockDuration was removed in the v5.x contract refactor; set ' +
            'config.roleLockDuration via configureRole({ roleId, config }) instead.'
        );
    },

    async setRoleOwner({ roleId, newOwner }) {
        // Removed in the v5.x contract refactor: the role owner is a field of the role config
        // now, set atomically via configureRole. Validate then throw rather than revert on-chain.
        validateRequired(roleId, 'roleId');
        validateAddress(newOwner, 'newOwner');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'setRoleOwner was removed in the v5.x contract refactor; set config.owner via ' +
            'configureRole({ roleId, config }) instead.'
        );
    },

    async exitRole({ roleId, account }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'exitRole',
                args: [roleId],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'exitRole');
        }
    },

    async syncExitFees({ roles, account }) {
        validateRequired(roles, 'roles');
        if (roles.length === 0) throw new Error('syncExitFees: roles array must not be empty');
        try {
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'syncExitFees',
                args: [roles],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'syncExitFees');
        }
    },

    async roleMetadata({ roleId, user }) {
        // Removed in the v5.x contract refactor: there is no per-user role-metadata getter
        // (roleData is no longer stored retrievably). Validate then throw rather than revert.
        validateRequired(roleId, 'roleId');
        validateAddress(user, 'user');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'roleMetadata was removed in the v5.x contract refactor; there is no per-user ' +
            'role-metadata getter. Use getCommunityProfile({ community }) to recover a community\'s ' +
            'roleData via event back-trace, or getRoleConfig({ roleId }) for the role config.'
        );
    },

    // Community Management
    /**
     * @deprecated Legacy alias. `communityByName` does NOT exist in the deployed v5
     * Registry ABI (it would revert with "function does not exist"); the real getter is
     * `getCommunityByName`. This wrapper now delegates to the ABI-confirmed function so
     * existing callers keep working. Prefer {@link getCommunityByName} directly.
     */
    async communityByName({ name }) {
        try {
            validateRequired(name, 'name');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getCommunityByName',
                args: [name]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityByName');
        }
    },

    /**
     * @deprecated Legacy alias. `communityByENS` does NOT exist in the deployed v5
     * Registry ABI (it would revert with "function does not exist"); the real getter is
     * `getCommunityByENS`. This wrapper now delegates to the ABI-confirmed function so
     * existing callers keep working. Prefer {@link getCommunityByENS} directly.
     */
    async communityByENS({ ensName }) {
        try {
            validateRequired(ensName, 'ensName');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getCommunityByENS',
                args: [ensName]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'communityByENS');
        }
    },

    // getCommunityByName / getCommunityByENS are the names that actually exist in the
    // Registry ABI (the legacy communityByName/communityByENS wrappers above reference
    // function names that are NOT present in the deployed v5 ABI and would revert).
    async getCommunityByName({ name }) {
        try {
            validateRequired(name, 'name');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getCommunityByName',
                args: [name]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getCommunityByName');
        }
    },

    async getCommunityByENS({ ensName }) {
        try {
            validateRequired(ensName, 'ensName');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getCommunityByENS',
                args: [ensName]
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getCommunityByENS');
        }
    },

    async getRoleStake({ roleId, user }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getRoleStake',
                args: [roleId, user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getRoleStake');
        }
    },

    async getEffectiveStake({ user, roleId }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getEffectiveStake',
                args: [user, roleId]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getEffectiveStake');
        }
    },

    async getCommunityProfile({ community, fromBlock, toBlock }) {
        try {
            validateAddress(community, 'community');

            // ROLE_COMMUNITY is a compile-time keccak256("COMMUNITY") constant, not a getter.
            const roleCommunity = keccak256(toBytes('COMMUNITY'));

            // Pull the RoleRegistered event definition from the centralized @aastar/core ABI.
            const roleRegisteredEvent = (RegistryABI as readonly any[]).find(
                (item) => item.type === 'event' && item.name === 'RoleRegistered'
            ) as AbiEvent | undefined;
            if (!roleRegisteredEvent) {
                throw new Error('RoleRegistered event not found in Registry ABI');
            }

            // Step 1: filter logs by the indexed [roleId=ROLE_COMMUNITY, user=community] topics.
            const logs = await (client as PublicClient).getLogs({
                address,
                event: roleRegisteredEvent,
                args: { roleId: roleCommunity, user: community },
                fromBlock: fromBlock ?? 'earliest',
                toBlock: toBlock ?? 'latest'
            } as any);

            if (!logs || logs.length === 0) {
                // No on-chain registration found for this community.
                return null;
            }

            // Use the most recent registration log.
            const log = logs[logs.length - 1] as any;
            const txHash = log.transactionHash as Hash;
            const eventArgs = (log.args ?? {}) as { burnAmount?: bigint; timestamp?: bigint };
            if (!txHash) {
                return null;
            }

            // Step 2: fetch the originating transaction to recover its calldata.
            const tx = await (client as PublicClient).getTransaction({ hash: txHash });
            const input = (tx as any)?.input as Hex | undefined;
            if (!input || input === '0x') {
                return null;
            }

            // Step 3: decode the registration calldata. roleData lives in the calldata,
            // never in an event topic, so this back-trace is the only on-chain source.
            const decoded = decodeFunctionData({ abi: RegistryABI, data: input });
            // Both registration entrypoints present in the deployed Registry ABI carry
            // roleData at calldata arg index 2:
            //   registerRole(roleId, user, roleData)
            //   safeMintForRole(roleId, user, roleData)
            let rawRoleData: Hex | undefined;
            const fnArgs = (decoded.args ?? []) as readonly unknown[];
            if (decoded.functionName === 'registerRole' || decoded.functionName === 'safeMintForRole') {
                rawRoleData = fnArgs[2] as Hex;
            }
            if (!rawRoleData || rawRoleData === '0x') {
                return null;
            }

            // Step 4: decode roleData into the community profile struct. Field layout matches
            // Registry.sol CommunityRoleData (string name, ensName, website, description,
            // logoURI, uint256 stakeAmount) — the same encoding the SDK uses to build it.
            const [profile] = decodeAbiParameters(COMMUNITY_ROLE_DATA_PARAMS, rawRoleData) as [{
                name: string; ensName: string; website: string; description: string; logoURI: string; stakeAmount: bigint;
            }];

            return {
                name: profile.name,
                ensName: profile.ensName,
                website: profile.website,
                description: profile.description,
                logoURI: profile.logoURI,
                stakeAmount: profile.stakeAmount,
                burnAmount: eventArgs.burnAmount ?? 0n,
                registeredAt: eventArgs.timestamp ?? 0n,
                txHash,
                rawRoleData
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getCommunityProfile');
        }
    },

    // Credit & Reputation
    async getCreditLimit({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getCreditLimit',
                args: [user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getCreditLimit');
        }
    },

    async globalReputation({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'globalReputation',
                args: [user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'globalReputation');
        }
    },

    async addLevelThreshold({ threshold }) {
        // Removed in the v5.x contract refactor: there is no append-one threshold setter, only
        // the replace-all setLevelThresholds(uint256[]). Renaming this to setLevelThresholds with
        // a single-element array would DESTRUCTIVELY overwrite all existing thresholds, so we
        // throw instead. Validate then throw rather than revert on-chain.
        validateAmount(threshold, 'threshold');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'addLevelThreshold was removed in the v5.x contract refactor; the contract only exposes ' +
            'the replace-all setLevelThresholds(uint256[]). Read levelThresholds, append your value, ' +
            'and call setLevelThresholds({ thresholds }).'
        );
    },

    async batchUpdateGlobalReputation({ proposalId, users, newScores, epoch, proof, account }) {
        try {
            validateAmount(proposalId, 'proposalId');
            validateRequired(users, 'users');
            validateRequired(newScores, 'newScores');
            validateAmount(epoch, 'epoch');
            validateRequired(proof, 'proof');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'batchUpdateGlobalReputation',
                args: [proposalId, users, newScores, epoch, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'batchUpdateGlobalReputation');
        }
    },

    // Contract References
    async setBLSAggregator({ aggregator, account }) {
        try {
            validateAddress(aggregator, 'aggregator');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setBLSAggregator',
                args: [aggregator],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setBLSAggregator');
        }
    },

    async setMySBT({ sbt, account }) {
        try {
            validateAddress(sbt, 'sbt');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setMySBT',
                args: [sbt],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setMySBT');
        }
    },

    async setSuperPaymaster({ paymaster, account }) {
        try {
            validateAddress(paymaster, 'paymaster');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setSuperPaymaster',
                args: [paymaster],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setSuperPaymaster');
        }
    },

    async setStaking({ staking, account }) {
        try {
            validateAddress(staking, 'staking');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setStaking',
                args: [staking],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setStaking');
        }
    },

    async setReputationSource({ source, account }) {
        try {
            validateAddress(source, 'source');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setReputationSource',
                args: [source],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setReputationSource');
        }
    },

    async blsAggregator() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'blsAggregator',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'blsAggregator');
        }
    },

    async MYSBT() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'MYSBT',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'MYSBT');
        }
    },

    async SUPER_PAYMASTER() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'SUPER_PAYMASTER',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'SUPER_PAYMASTER');
        }
    },

    async GTOKEN_STAKING() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'GTOKEN_STAKING',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'GTOKEN_STAKING');
        }
    },

    async reputationSource() {
        // Removed in the v5.x contract refactor: reputation sources are now a set, so there is
        // no single-address `reputationSource` getter. Throw rather than revert on-chain.
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'reputationSource was removed in the v5.x contract refactor; reputation sources are now ' +
            'a set. Use isReputationSource({ source }) to test whether an address is a source.'
        );
    },

    async isReputationSource({ source }) {
        try {
            validateAddress(source, 'source');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'isReputationSource',
                args: [source]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isReputationSource');
        }
    },

    async lastReputationEpoch({ user }) {
        // Removed in the v5.x contract refactor: not in the deployed Registry ABI.
        validateAddress(user, 'user');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'lastReputationEpoch was removed in the v5.x contract refactor; it is no longer exposed by the Registry.'
        );
    },

    // View Functions
    async roleConfigs({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            // On-chain fn: getRoleConfig(roleId) — the legacy `roleConfigs` mapping getter was removed.
            const result = await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getRoleConfig',
                args: [roleId]
            }) as any;

            if (Array.isArray(result)) {
                return {
                    minStake: result[0],
                    ticketPrice: result[1],
                    slashThreshold: result[2],
                    slashBase: result[3],
                    slashInc: result[4],
                    slashMax: result[5],
                    exitFeePercent: result[6],
                    isActive: result[7],
                    minExitFee: result[8],
                    description: result[9],
                    owner: result[10],
                    roleLockDuration: result[11]
                };
            }
            return result as RoleConfigDetailed;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleConfigs');
        }
    },

    async getRoleUserCount({ roleId }) {
        try {
            validateRequired(roleId, 'roleId');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getRoleUserCount',
                args: [roleId]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getRoleUserCount');
        }
    },

    async getRoleMembers({ roleId, fromBlock, toBlock }) {
        try {
            validateRequired(roleId, 'roleId');
            // No on-chain getter exists — derive ACTIVE members via event indexing.
            return await computeActiveRoleMembers(client as PublicClient, address, roleId, fromBlock, toBlock);
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getRoleMembers');
        }
    },

    async getRoleMemberCount({ roleId, fromBlock, toBlock }) {
        try {
            validateRequired(roleId, 'roleId');
            // Event-derived count, consistent with getRoleMembers. For the authoritative
            // on-chain counter use getRoleUserCount (reads roleMembers[roleId].length).
            const members = await computeActiveRoleMembers(client as PublicClient, address, roleId, fromBlock, toBlock);
            return members.length;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getRoleMemberCount');
        }
    },

    async getUserRoles({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getUserRoles',
                args: [user]
            }) as Promise<Hex[]>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getUserRoles');
        }
    },

    async roleMembers({ roleId, index }) {
        // Removed in the v5.x contract refactor: Registry storage was slimmed and members are
        // NOT enumerable by index (no `roleMembers(roleId,index)` getter). Note: getRoleUserCount
        // returns a COUNT, not the member at an index, so it is not a substitute. Validate then throw.
        validateRequired(roleId, 'roleId');
        validateRequired(index, 'index');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'roleMembers was removed in the v5.x contract refactor; members are not enumerable ' +
            'on-chain. Use getRoleMembers({ roleId }) (event-derived) to list members.'
        );
    },

    async userRoles({ user, index }) {
        try {
            validateAddress(user, 'user');
            validateRequired(index, 'index');
            // On-chain fn: getUserRoles(user) -> bytes32[]. The legacy indexed `userRoles(user,index)`
            // getter was removed, so read the full array and return the requested element.
            const roles = await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getUserRoles',
                args: [user]
            }) as Hex[];
            const i = Number(index);
            if (i < 0 || i >= roles.length) {
                throw new AAStarError(
                    ErrorCode.INVALID_PARAMETER,
                    `userRoles: index ${i} out of range (user has ${roles.length} role(s)).`
                );
            }
            return roles[i];
        } catch (error) {
            if (error instanceof AAStarError) throw error;
            throw AAStarError.fromViemError(error as Error, 'userRoles');
        }
    },

    async userRoleCount({ user }) {
        try {
            validateAddress(user, 'user');
            // On-chain fn: getUserRoles(user) -> bytes32[]. The legacy `userRoleCount` getter was
            // removed; this is a user's role count = getUserRoles(user).length. (Distinct from
            // getRoleUserCount, which counts the USERS of a role.)
            const roles = await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getUserRoles',
                args: [user]
            }) as Hex[];
            return BigInt(roles.length);
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'userRoleCount');
        }
    },

    async creditTierConfig({ tierIndex }) {
        try {
            validateAmount(tierIndex, 'tierIndex');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'creditTierConfig',
                args: [tierIndex]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'creditTierConfig');
        }
    },

    async levelThresholds({ levelIndex }) {
        try {
            validateAmount(levelIndex, 'levelIndex');
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'levelThresholds',
                args: [levelIndex]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'levelThresholds');
        }
    },

    async calculateExitFee({ roleId, amount }) {
        // Removed in the v5.x contract refactor: the Registry has no exit-fee calculator;
        // exit-fee math lives in GTokenStaking (previewExitFee). The worklist-suggested
        // `syncExitFees` is an unrelated WRITE, not a fee getter. Validate then throw.
        validateRequired(roleId, 'roleId');
        validateAmount(amount, 'amount');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'calculateExitFee was removed from the Registry in the v5.x contract refactor; use the ' +
            'GTokenStaking previewExitFee({ user, roleId }) action (returns fee + net amount) instead.'
        );
    },

    async roleStakes({ roleId, user }) {
        try {
            validateRequired(roleId, 'roleId');
            validateAddress(user, 'user');
            // On-chain fn: getRoleStake(roleId, user) — the legacy `roleStakes` mapping getter was removed.
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'getRoleStake',
                args: [roleId, user]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'roleStakes');
        }
    },

    // Role IDs are compile-time constants in the contract — `bytes32 constant ROLE_X =
    // keccak256("X")` (see IRegistry.sol). They are NOT on-chain getters, so they must be
    // computed locally; calling them as contract functions reverts ("execution reverted").
    async ROLE_COMMUNITY() {
        return keccak256(toBytes('COMMUNITY'));
    },

    async ROLE_ENDUSER() {
        return keccak256(toBytes('ENDUSER'));
    },

    async ROLE_PAYMASTER_SUPER() {
        return keccak256(toBytes('PAYMASTER_SUPER'));
    },

    async ROLE_PAYMASTER_AOA() {
        return keccak256(toBytes('PAYMASTER_AOA'));
    },

    async ROLE_DVT() {
        return keccak256(toBytes('DVT'));
    },

    async ROLE_KMS() {
        return keccak256(toBytes('KMS'));
    },

    async ROLE_ANODE() {
        return keccak256(toBytes('ANODE'));
    },

    // Ownership
    async owner() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'owner',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'owner');
        }
    },

    async transferOwnership({ newOwner, account }) {
        try {
            validateAddress(newOwner, 'newOwner');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'transferOwnership',
                args: [newOwner],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transferOwnership');
        }
    },

    async renounceOwnership({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'renounceOwnership',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'renounceOwnership');
        }
    },
    
    // AccessControl
    async grantRole({ roleId, user }) {
        // Removed in the v5.x contract refactor: the Registry dropped the OZ AccessControl
        // surface. Validate then throw rather than revert on-chain.
        validateRequired(roleId, 'roleId');
        validateAddress(user, 'user');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'grantRole was removed in the v5.x contract refactor; use registerRole({ roleId, user, data }) ' +
            'to add a user to a role.'
        );
    },

    async revokeRole({ roleId, user }) {
        // Removed in the v5.x contract refactor: there is no admin role-revocation. A user can
        // only self-exit via exitRole, so dropping the `user` arg and calling exitRole would
        // silently change semantics (exit the CALLER's role, not `user`'s). Validate then throw.
        validateRequired(roleId, 'roleId');
        validateAddress(user, 'user');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'revokeRole was removed in the v5.x contract refactor; there is no admin revocation. ' +
            'A user removes their own role via exitRole({ roleId }) (self-exit only).'
        );
    },

    // Credit & Reputation (admin)
    async setCreditTier({ level, limit, account }) {
        try {
            validateRequired(level, 'level');
            validateRequired(limit, 'limit');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setCreditTier',
                args: [level, limit],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setCreditTier');
        }
    },

    async setLevelThresholds({ thresholds, account }) {
        try {
            validateRequired(thresholds, 'thresholds');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'setLevelThresholds',
                args: [thresholds],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setLevelThresholds');
        }
    },

    async updateOperatorBlacklist({ operator, users, statuses, proof, account }) {
        try {
            validateAddress(operator, 'operator');
            validateRequired(users, 'users');
            validateRequired(statuses, 'statuses');
            validateRequired(proof, 'proof');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'updateOperatorBlacklist',
                args: [operator, users, statuses, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'updateOperatorBlacklist');
        }
    },

    async syncStakeFromStaking({ user, roleId, newAmount, account }) {
        try {
            validateAddress(user, 'user');
            validateRequired(roleId, 'roleId');
            validateRequired(newAmount, 'newAmount');
            return await (client as any).writeContract({
                address,
                abi: RegistryABI,
                functionName: 'syncStakeFromStaking',
                args: [user, roleId, newAmount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'syncStakeFromStaking');
        }
    },

    async blacklistNonce() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'blacklistNonce',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'blacklistNonce');
        }
    },

    // Version
    async version() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: RegistryABI,
                functionName: 'version',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    }
});
