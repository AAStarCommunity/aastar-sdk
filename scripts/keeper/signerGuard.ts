/**
 * Signer identity for the price keeper (DSR B1).
 * Every read is at one block hash. A failed read is not "ok".
 */
import {
    decodeFunctionResult,
    encodeFunctionData,
    isAddress,
    type Address,
    type Hex,
} from 'viem';
import { PINNED_ROLES, REGISTRY_PAUSE_ABI, SUPER_PAYMASTER_PAUSE_ABI } from './spPausePin.js';

export const DEPLOYER_ADDRESS: Address = '0xb5600060e6de5E11D3636731964218E53caadf0E';

const MAX_ROLE_LOGS = 5_000;

export interface IdentityChain {
    call(tx: { to: Address; data: Hex; blockHash: Hex }): Promise<Hex>;
}

export interface RoleLog {
    roleId: Hex;
}

export type IdentityFailureKind = 'privileged' | 'read-failed' | 'sp-mismatch';

export type IdentityResult = { ok: true } | { ok: false; kind: IdentityFailureKind; problems: string[] };

/** Code hash, implementation, or REGISTRY does not match the rc.8 pin. A missing RPC read is not one of these. */
export function isSpIdentityMismatch(problem: string): boolean {
    return problem === 'superpaymaster codehash mismatch'
        || problem === 'implementation mismatch'
        || problem === 'implementation codehash mismatch'
        || problem === 'implementation slot not an address'
        || problem === 'REGISTRY mismatch'
        || problem === 'REGISTRY() not an address';
}

function isPrivilege(problem: string): boolean {
    return problem.startsWith('signer equals ')
        || problem.startsWith('signer holds ')
        || problem.startsWith('signer owns ')
        || problem.startsWith('signer is ')
        || problem === 'configured role is not in the pinned set';
}

function failureKind(problems: string[], deploymentProblem?: string): IdentityFailureKind {
    if (problems.some(isPrivilege)) return 'privileged';
    if (deploymentProblem && isSpIdentityMismatch(deploymentProblem)) {
        const extras = problems.filter((problem) => problem !== deploymentProblem);
        if (extras.length === 0) return 'sp-mismatch';
    }
    return 'read-failed';
}

function bad(problems: string[], deploymentProblem?: string): IdentityResult {
    const copied = [...problems];
    return { ok: false, kind: failureKind(copied, deploymentProblem), problems: copied };
}

function norm(addr: string): string {
    return addr.toLowerCase();
}

function isBytes32(value: unknown): value is Hex {
    return typeof value === 'string' && value.length === 66 && value.startsWith('0x');
}

function decodeAddress(data: Hex): Address | null {
    if (data.length !== 66) return null;
    const body = data.slice(2);
    for (let i = 0; i < 24; i++) if (body[i] !== '0') return null;
    const addr = `0x${body.slice(24)}`;
    if (!isAddress(addr)) return null;
    return addr;
}

function decodeBool(data: Hex): boolean | null {
    if (data.length !== 66) return null;
    const body = data.slice(2);
    let nonzero = 0;
    for (let i = 0; i < body.length; i++) {
        if (body[i] !== '0') nonzero++;
    }
    if (nonzero === 0) return false;
    if (nonzero === 1 && body[body.length - 1] === '1') return true;
    return null;
}

async function readRaw(chain: IdentityChain, to: Address, data: Hex, blockHash: Hex, label: string, problems: string[]): Promise<Hex | null> {
    try {
        const out = await chain.call({ to, data, blockHash });
        if (typeof out !== 'string' || out.length < 2 || out.length > 20_000 || !out.startsWith('0x')) {
            problems.push(`read failed: ${label}`);
            return null;
        }
        return out;
    } catch {
        problems.push(`read failed: ${label}`);
        return null;
    }
}

async function readAddress(chain: IdentityChain, to: Address, fn: 'owner' | 'pendingOwner' | 'guardian' | 'BLS_AGGREGATOR' | 'blsAggregator', blockHash: Hex, label: string, problems: string[]): Promise<Address | null> {
    const useRegistry = fn === 'blsAggregator';
    const data = encodeFunctionData({
        abi: useRegistry ? REGISTRY_PAUSE_ABI : SUPER_PAYMASTER_PAUSE_ABI,
        functionName: fn,
    });
    const raw = await readRaw(chain, to, data, blockHash, label, problems);
    if (!raw) return null;
    const addr = decodeAddress(raw);
    if (!addr) {
        problems.push(`read failed: ${label}`);
        return null;
    }
    return addr;
}

function same(signer: Address, other: Address | null, problem: string, problems: string[]): void {
    if (other && norm(signer) === norm(other)) problems.push(problem);
}

export async function checkSignerIdentity(input: {
    chain: IdentityChain;
    blockHash: Hex;
    signer: Address;
    sp: Address;
    registry: Address;
    deployers?: readonly Address[];
    pauseDutyEnabled: boolean;
    roleLogs?: readonly RoleLog[] | null;
    /** Set when the rc.8 deployment did not verify. Role reads against that SP are skipped. */
    deploymentProblem?: string;
}): Promise<IdentityResult> {
    if (!isBytes32(input.blockHash) || !isAddress(input.signer) || !isAddress(input.sp) || !isAddress(input.registry)) {
        return bad(['signer identity: bad parameters']);
    }
    if (typeof input.pauseDutyEnabled !== 'boolean') return bad(['signer identity: bad parameters']);
    const deployers: string[] = [norm(DEPLOYER_ADDRESS)];
    const extra = input.deployers ?? [];
    if (extra.length > 32) return bad(['signer identity: bad parameters']);
    for (const item of extra) {
        if (!isAddress(item)) return bad(['signer identity: bad parameters']);
        const n = norm(item);
        if (!deployers.includes(n)) deployers.push(n);
    }
    const signer = input.signer;
    const sp = input.sp;
    const registry = input.registry;
    const blockHash = input.blockHash;
    const pause = input.pauseDutyEnabled;
    const problems: string[] = [];
    if (deployers.includes(norm(signer))) problems.push('signer equals deployer');

    const spOwner = await readAddress(input.chain, sp, 'owner', blockHash, 'SP.owner', problems);
    same(signer, spOwner, 'signer equals superpaymaster owner', problems);
    const registryOwnerAbi = encodeFunctionData({ abi: REGISTRY_PAUSE_ABI, functionName: 'owner' });
    const registryOwnerRaw = await readRaw(input.chain, registry, registryOwnerAbi, blockHash, 'Registry.owner', problems);
    const registryOwner = registryOwnerRaw ? decodeAddress(registryOwnerRaw) : null;
    if (registryOwnerRaw && !registryOwner) problems.push('read failed: Registry.owner');
    same(signer, registryOwner, 'signer equals registry owner', problems);

    if (typeof input.deploymentProblem === 'string') {
        if (!pause || input.deploymentProblem.length === 0 || input.deploymentProblem.length > 500) {
            return bad(['signer identity: bad parameters']);
        }
        problems.push(input.deploymentProblem);
        if (!spOwner || !registryOwner) {
            if (!problems.some((problem) => problem.startsWith('read failed:'))) problems.push('read failed: owner');
        }
        return bad(problems, input.deploymentProblem);
    }

    // Without a 5.5.0 SuperPaymaster configured, the refuse-start set is exactly the
    // deployer, SP.owner(), and Registry.owner() (DSR on #446).
    if (!pause) {
        if (problems.length) return bad(problems);
        if (!spOwner || !registryOwner) return bad(problems.length ? problems : ['read failed: owner']);
        return { ok: true };
    }

    // Role logs are optional. Startup and the hourly check read every pinned role
    // directly. Logs are passed only after a catch-up slice completes, to see roles
    // outside that pin.
    const copiedRoles: Hex[] = [];
    if (input.roleLogs != null) {
        if (!Array.isArray(input.roleLogs)) return bad([...problems, 'role logs missing']);
        if (input.roleLogs.length > MAX_ROLE_LOGS) return bad([...problems, 'role logs unbounded']);
        for (const log of input.roleLogs) {
            if (!log || !isBytes32(log.roleId)) return bad([...problems, 'role log malformed']);
            copiedRoles.push(log.roleId.toLowerCase() as Hex);
        }
    }

    const pendingSp = await readAddress(input.chain, sp, 'pendingOwner', blockHash, 'SP.pendingOwner', problems);
    same(signer, pendingSp, 'signer equals superpaymaster pending owner', problems);
    const guardian = await readAddress(input.chain, sp, 'guardian', blockHash, 'SP.guardian', problems);
    same(signer, guardian, 'signer equals superpaymaster guardian', problems);
    const bls = await readAddress(input.chain, sp, 'BLS_AGGREGATOR', blockHash, 'SP.BLS_AGGREGATOR', problems);
    same(signer, bls, 'signer equals superpaymaster bls aggregator', problems);
    const pendingReg = await readAddress(input.chain, registry, 'pendingOwner', blockHash, 'Registry.pendingOwner', problems);
    same(signer, pendingReg, 'signer equals registry pending owner', problems);
    const regBls = await readAddress(input.chain, registry, 'blsAggregator', blockHash, 'Registry.blsAggregator', problems);
    same(signer, regBls, 'signer equals registry bls aggregator', problems);

    const pinned = new Set<string>();
    for (const id of Object.values(PINNED_ROLES)) pinned.add(id.toLowerCase());
    const extraIds: Hex[] = [];
    const seen = new Set<string>();
    for (const id of copiedRoles) {
        if (seen.has(id)) continue;
        seen.add(id);
        if (!pinned.has(id)) {
            problems.push('configured role is not in the pinned set');
            extraIds.push(id);
        }
    }

    const readHasRole = async (id: Hex): Promise<void> => {
        const data = encodeFunctionData({
            abi: REGISTRY_PAUSE_ABI,
            functionName: 'hasRole',
            args: [id, signer],
        });
        const raw = await readRaw(input.chain, registry, data, blockHash, 'Registry.hasRole', problems);
        if (!raw) return;
        const holds = decodeBool(raw);
        if (holds === null) {
            problems.push('read failed: Registry.hasRole');
            return;
        }
        if (holds) problems.push('signer holds a role');
    };
    const readRoleOwner = async (id: Hex): Promise<void> => {
        const data = encodeFunctionData({ abi: REGISTRY_PAUSE_ABI, functionName: 'getRoleConfig', args: [id] });
        const raw = await readRaw(input.chain, registry, data, blockHash, 'Registry.getRoleConfig', problems);
        if (!raw) return;
        try {
            const decoded = decodeFunctionResult({ abi: REGISTRY_PAUSE_ABI, functionName: 'getRoleConfig', data: raw });
            const owner = Array.isArray(decoded) ? decoded[10] : (decoded as { owner?: unknown }).owner;
            if (typeof owner !== 'string' || !isAddress(owner)) {
                problems.push('read failed: Registry.getRoleConfig');
                return;
            }
            if (norm(owner) === norm(signer)) problems.push('signer owns a role config');
        } catch {
            problems.push('read failed: Registry.getRoleConfig');
        }
    };

    for (const id of Object.values(PINNED_ROLES)) await readHasRole(id);
    for (const id of extraIds) await readHasRole(id);
    for (const id of Object.values(PINNED_ROLES)) await readRoleOwner(id);
    for (const id of extraIds) await readRoleOwner(id);

    const repData = encodeFunctionData({ abi: REGISTRY_PAUSE_ABI, functionName: 'isReputationSource', args: [signer] });
    const repRaw = await readRaw(input.chain, registry, repData, blockHash, 'Registry.isReputationSource', problems);
    if (repRaw) {
        const rep = decodeBool(repRaw);
        if (rep === null) problems.push('read failed: Registry.isReputationSource');
        else if (rep) problems.push('signer is a reputation source');
    }

    if (problems.length) return bad(problems);
    if (!spOwner || !registryOwner || !pendingSp || !guardian || !bls || !pendingReg || !regBls) {
        return bad(problems.length ? problems : ['read failed: identity']);
    }
    return { ok: true };
}
