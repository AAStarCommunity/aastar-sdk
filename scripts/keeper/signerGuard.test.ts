/**
 * Signer identity. Without a pause config the refuse-start set is the deployer,
 * SP.owner(), and Registry.owner() on the 5.4.2 owner() selector.
 * With the pause duty, holding any pinned role is not ok. A missing read is not ok.
 */
import { describe, expect, it } from 'vitest';
import { encodeFunctionData, encodeFunctionResult, getAddress, type Address, type Hex } from 'viem';
import { checkSignerIdentity, DEPLOYER_ADDRESS, type IdentityChain } from './signerGuard';
import { PINNED_ROLES, REGISTRY_PAUSE_ABI, SUPER_PAYMASTER_PAUSE_ABI } from './spPausePin';

const BLOCK = ('0x' + '11'.repeat(32)) as Hex;
const SIGNER = getAddress('0x1111111111111111111111111111111111111111');
const SP = getAddress('0x2222222222222222222222222222222222222222');
const REG = getAddress('0x3333333333333333333333333333333333333333');
const OTHER = getAddress('0x9999999999999999999999999999999999999999');

const OWNER_ABI = [{
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
}] as const;

const OWNER_SEL = encodeFunctionData({ abi: OWNER_ABI, functionName: 'owner' }).slice(0, 10);

const sel = (abi: typeof SUPER_PAYMASTER_PAUSE_ABI, name: string) =>
    encodeFunctionData({ abi, functionName: name }).slice(0, 10);

const HAS_ROLE = encodeFunctionData({
    abi: REGISTRY_PAUSE_ABI,
    functionName: 'hasRole',
    args: [PINNED_ROLES.ROLE_PAYMASTER_SUPER!, SIGNER],
}).slice(0, 10);
const ROLE_CONFIG = encodeFunctionData({
    abi: REGISTRY_PAUSE_ABI,
    functionName: 'getRoleConfig',
    args: [PINNED_ROLES.ROLE_PAYMASTER_SUPER!],
}).slice(0, 10);
const REPUTATION = encodeFunctionData({
    abi: REGISTRY_PAUSE_ABI,
    functionName: 'isReputationSource',
    args: [SIGNER],
}).slice(0, 10);

function addr(who: Address): Hex {
    return encodeFunctionResult({ abi: SUPER_PAYMASTER_PAUSE_ABI, functionName: 'owner', result: who });
}

function roleConfig(owner: Address): Hex {
    return encodeFunctionResult({
        abi: REGISTRY_PAUSE_ABI,
        functionName: 'getRoleConfig',
        result: {
            minStake: 1n,
            ticketPrice: 0n,
            slashThreshold: 0,
            slashBase: 0,
            slashInc: 0,
            slashMax: 0,
            exitFeePercent: 0,
            isActive: true,
            minExitFee: 0n,
            description: 'role',
            owner,
            roleLockDuration: 0n,
        },
    });
}

function chain(opts: { hasRole?: boolean; owners?: Partial<Record<string, Address>>; throwAll?: boolean; calls?: string[]; reputation?: boolean; ownerOnly?: boolean } = {}): IdentityChain {
    const owners = opts.owners ?? {};
    return {
        async call({ to, data, blockHash }) {
            opts.calls?.push(`${to}:${data.slice(0, 10)}:${blockHash}`);
            if (opts.throwAll) throw new Error('rpc exploded with a path /tmp/secret');
            if (blockHash !== BLOCK) throw new Error('wrong block');
            const id = data.slice(0, 10);
            if (opts.ownerOnly) {
                if (id !== OWNER_SEL) throw new Error('unexpected call');
                if (to.toLowerCase() === SP.toLowerCase()) return addr(owners.spOwner ?? OTHER);
                if (to.toLowerCase() === REG.toLowerCase()) return addr(owners.regOwner ?? OTHER);
                throw new Error('unexpected call');
            }
            if (id === HAS_ROLE) {
                return encodeFunctionResult({ abi: REGISTRY_PAUSE_ABI, functionName: 'hasRole', result: opts.hasRole ?? false });
            }
            if (id === ROLE_CONFIG) return roleConfig(owners.roleOwner ?? OTHER);
            if (id === REPUTATION) {
                return encodeFunctionResult({ abi: REGISTRY_PAUSE_ABI, functionName: 'isReputationSource', result: opts.reputation ?? false });
            }
            const pick = (name: string) => owners[name] ?? OTHER;
            if (to.toLowerCase() === SP.toLowerCase()) {
                if (id === sel(SUPER_PAYMASTER_PAUSE_ABI, 'owner')) return addr(pick('spOwner'));
                if (id === sel(SUPER_PAYMASTER_PAUSE_ABI, 'pendingOwner')) return addr(pick('pendingSp'));
                if (id === sel(SUPER_PAYMASTER_PAUSE_ABI, 'guardian')) return addr(pick('guardian'));
                if (id === sel(SUPER_PAYMASTER_PAUSE_ABI, 'BLS_AGGREGATOR')) return addr(pick('bls'));
            }
            if (id === sel(REGISTRY_PAUSE_ABI, 'owner')) return addr(pick('regOwner'));
            if (id === sel(REGISTRY_PAUSE_ABI, 'pendingOwner')) return addr(pick('pendingReg'));
            if (id === sel(REGISTRY_PAUSE_ABI, 'blsAggregator')) return addr(pick('regBls'));
            throw new Error('unexpected call');
        },
    };
}

async function check(over: Partial<Parameters<typeof checkSignerIdentity>[0]> = {}) {
    return checkSignerIdentity({
        chain: chain(),
        blockHash: BLOCK,
        signer: SIGNER,
        sp: SP,
        registry: REG,
        pauseDutyEnabled: false,
        roleLogs: null,
        ...over,
    });
}

describe('signer identity', () => {
    it('deployer, superpaymaster owner and registry owner are refused', async () => {
        const deployer = await check({ signer: DEPLOYER_ADDRESS, chain: chain({ ownerOnly: true }) });
        const spOwner = await check({ chain: chain({ ownerOnly: true, owners: { spOwner: SIGNER } }) });
        const regOwner = await check({ chain: chain({ ownerOnly: true, owners: { regOwner: SIGNER } }) });
        for (const result of [deployer, spOwner, regOwner]) {
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.kind).toBe('privileged');
        }
        if (!deployer.ok) expect(deployer.problems).toContain('signer equals deployer');
        if (!spOwner.ok) expect(spOwner.problems).toContain('signer equals superpaymaster owner');
        if (!regOwner.ok) expect(regOwner.problems).toContain('signer equals registry owner');
    });

    it('a failed read is not ok', async () => {
        const result = await check({ chain: chain({ throwAll: true, ownerOnly: true }) });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.kind).toBe('read-failed');
            expect(result.problems.some((p) => p.startsWith('read failed:'))).toBe(true);
            expect(result.problems.join(' ')).not.toMatch(/secret/);
        }
    });

    it('a clean signer is ok and only owner() is read', async () => {
        const calls: string[] = [];
        const result = await check({ chain: chain({ calls, ownerOnly: true }) });
        expect(result).toEqual({ ok: true });
        expect(calls).toHaveLength(2);
        expect(calls.every((line) => line.includes(OWNER_SEL))).toBe(true);
    });

    it('a signer that holds a role is refused', async () => {
        const result = await check({ chain: chain({ hasRole: true }), pauseDutyEnabled: true, roleLogs: [] });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.kind).toBe('privileged');
            expect(result.problems).toContain('signer holds a role');
        }
    });

    it('deployer, superpaymaster owner, guardian and registry owner are refused', async () => {
        const deployer = await check({ signer: DEPLOYER_ADDRESS, pauseDutyEnabled: true, roleLogs: [] });
        const spOwner = await check({ chain: chain({ owners: { spOwner: SIGNER } }), pauseDutyEnabled: true, roleLogs: [] });
        const guardian = await check({ chain: chain({ owners: { guardian: SIGNER } }), pauseDutyEnabled: true, roleLogs: [] });
        const regOwner = await check({ chain: chain({ owners: { regOwner: SIGNER } }), pauseDutyEnabled: true, roleLogs: [] });
        for (const result of [deployer, spOwner, guardian, regOwner]) expect(result.ok).toBe(false);
        if (!deployer.ok) expect(deployer.problems).toContain('signer equals deployer');
        if (!spOwner.ok) expect(spOwner.problems).toContain('signer equals superpaymaster owner');
        if (!guardian.ok) expect(guardian.problems).toContain('signer equals superpaymaster guardian');
        if (!regOwner.ok) expect(regOwner.problems).toContain('signer equals registry owner');
    });

    it('missing role logs are not ok, and a role outside the pin is not ok', async () => {
        const missing = await check({ pauseDutyEnabled: true, roleLogs: null });
        expect(missing.ok).toBe(false);
        if (!missing.ok) expect(missing.problems).toContain('role logs missing');
        const foreign = ('0x' + 'ab'.repeat(32)) as Hex;
        const extra = await check({ pauseDutyEnabled: true, roleLogs: [{ roleId: foreign }] });
        expect(extra.ok).toBe(false);
        if (!extra.ok) expect(extra.problems).toContain('configured role is not in the pinned set');
    });

    it('pending owners, bls aggregators, a role-config owner and a reputation source are refused', async () => {
        const cases: { owners?: Partial<Record<string, Address>>; reputation?: boolean; problem: string }[] = [
            { owners: { pendingSp: SIGNER }, problem: 'signer equals superpaymaster pending owner' },
            { owners: { bls: SIGNER }, problem: 'signer equals superpaymaster bls aggregator' },
            { owners: { pendingReg: SIGNER }, problem: 'signer equals registry pending owner' },
            { owners: { regBls: SIGNER }, problem: 'signer equals registry bls aggregator' },
            { owners: { roleOwner: SIGNER }, problem: 'signer owns a role config' },
            { reputation: true, problem: 'signer is a reputation source' },
        ];
        for (const item of cases) {
            const result = await check({
                chain: chain({ owners: item.owners, reputation: item.reputation }),
                pauseDutyEnabled: true,
                roleLogs: [],
            });
            expect(result.ok, item.problem).toBe(false);
            if (!result.ok) expect(result.problems).toContain(item.problem);
        }
    });

    it('a clean signer with an empty role log is ok', async () => {
        const result = await check({ pauseDutyEnabled: true, roleLogs: [] });
        expect(result).toEqual({ ok: true });
    });

    it('an unverified superpaymaster skips role reads', async () => {
        const calls: string[] = [];
        const base = chain({ calls });
        const guarded: IdentityChain = {
            async call(tx) {
                if (tx.data.slice(0, 10) === HAS_ROLE) throw new Error('hasRole must not run');
                return base.call(tx);
            },
        };
        const mismatch = await check({
            chain: guarded,
            roleLogs: null,
            pauseDutyEnabled: true,
            deploymentProblem: 'superpaymaster codehash mismatch',
        });
        expect(mismatch.ok).toBe(false);
        if (!mismatch.ok) {
            expect(mismatch.kind).toBe('sp-mismatch');
            expect(mismatch.problems).toContain('superpaymaster codehash mismatch');
        }
        expect(calls.some((line) => line.includes(HAS_ROLE))).toBe(false);

        const owner = await check({
            chain: chain({ owners: { spOwner: SIGNER } }),
            roleLogs: null,
            pauseDutyEnabled: true,
            deploymentProblem: 'implementation mismatch',
        });
        expect(owner.ok).toBe(false);
        if (!owner.ok) {
            expect(owner.kind).toBe('privileged');
            expect(owner.problems).toContain('signer equals superpaymaster owner');
        }

        const unread = await check({
            chain: chain({ throwAll: true }),
            roleLogs: null,
            pauseDutyEnabled: true,
            deploymentProblem: 'REGISTRY mismatch',
        });
        expect(unread.ok).toBe(false);
        if (!unread.ok) expect(unread.kind).toBe('read-failed');
    });
});
