/**
 * Signer identity on the 5.4.2 ABI. A missing read is not ok.
 * The refuse-start set is the deployer, SP.owner(), and Registry.owner().
 */
import { describe, expect, it } from 'vitest';
import { encodeFunctionData, encodeFunctionResult, getAddress, type Address, type Hex } from 'viem';
import { checkSignerIdentity, DEPLOYER_ADDRESS, type IdentityChain } from './signerGuard';

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

function addr(who: Address): Hex {
    return encodeFunctionResult({ abi: OWNER_ABI, functionName: 'owner', result: who });
}

function chain(opts: { owners?: Partial<Record<string, Address>>; throwAll?: boolean; calls?: string[] } = {}): IdentityChain {
    const owners = opts.owners ?? {};
    return {
        async call({ to, data, blockHash }) {
            opts.calls?.push(`${to}:${data.slice(0, 10)}:${blockHash}`);
            if (opts.throwAll) throw new Error('rpc exploded with a path /tmp/secret');
            if (blockHash !== BLOCK) throw new Error('wrong block');
            if (data.slice(0, 10) !== OWNER_SEL) throw new Error('unexpected call');
            if (to.toLowerCase() === SP.toLowerCase()) return addr(owners.spOwner ?? OTHER);
            if (to.toLowerCase() === REG.toLowerCase()) return addr(owners.regOwner ?? OTHER);
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
        ...over,
    });
}

describe('signer identity', () => {
    it('deployer, superpaymaster owner and registry owner are refused', async () => {
        const deployer = await check({ signer: DEPLOYER_ADDRESS });
        const spOwner = await check({ chain: chain({ owners: { spOwner: SIGNER } }) });
        const regOwner = await check({ chain: chain({ owners: { regOwner: SIGNER } }) });
        for (const result of [deployer, spOwner, regOwner]) {
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.kind).toBe('privileged');
        }
        if (!deployer.ok) expect(deployer.problems).toContain('signer equals deployer');
        if (!spOwner.ok) expect(spOwner.problems).toContain('signer equals superpaymaster owner');
        if (!regOwner.ok) expect(regOwner.problems).toContain('signer equals registry owner');
    });

    it('a failed read is not ok', async () => {
        const result = await check({ chain: chain({ throwAll: true }) });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.kind).toBe('read-failed');
            expect(result.problems.some((p) => p.startsWith('read failed:'))).toBe(true);
            expect(result.problems.join(' ')).not.toMatch(/secret/);
        }
    });

    it('a clean signer is ok and only owner() is read', async () => {
        const calls: string[] = [];
        const result = await check({ chain: chain({ calls }) });
        expect(result).toEqual({ ok: true });
        expect(calls).toHaveLength(2);
        expect(calls.every((line) => line.includes(OWNER_SEL))).toBe(true);
    });
});
